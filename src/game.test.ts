import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MODES,
  STORAGE_KEY,
  accuracy,
  generateQuestion,
  loadResults,
  parseAnswer,
  remaining,
  saveResults,
  startSession,
  submitAnswer,
  type Level,
} from "./game";

describe("question generation", () => {
  for (const { id: mode } of MODES)
    for (let level = 1; level <= 5; level++) {
      it(`${mode}, level ${level}: exact answers and valid ranges`, () => {
        for (let i = 0; i < 250; i++) {
          const q = generateQuestion(mode, level as Level);
          expect(
            Number.isSafeInteger(q.a) &&
              Number.isSafeInteger(q.b) &&
              Number.isSafeInteger(q.answer),
          ).toBe(true);
          if (mode === "addition") expect(q.answer).toBe(q.a + q.b);
          if (mode === "subtraction") expect(q.answer).toBe(q.a - q.b);
          if (mode === "multiplication")
            expect(q.answer).toBe((q.a * q.b) / 100);
          if (mode === "division") {
            expect(q.b).not.toBe(0);
            expect(q.answer * q.b).toBe(q.a * 100);
          }
          if (level < 4) {
            expect(q.a).toBeGreaterThanOrEqual(0);
            expect(q.b).toBeGreaterThanOrEqual(0);
            expect(q.answer).toBeGreaterThanOrEqual(0);
          }
          if (level < 5) {
            expect(
              q.a % 100 === 0 && q.b % 100 === 0 && q.answer % 100 === 0,
            ).toBe(true);
          }
          if (level === 5)
            expect(q.a % 100 !== 0 || q.b % 100 !== 0).toBe(true);
          const a = Math.abs(q.a),
            b = Math.abs(q.b),
            answer = Math.abs(q.answer);
          if (mode === "addition" || mode === "subtraction") {
            const [min, max] = [
              [0, 900],
              [1000, 9900],
              [10000, 99900],
              [1000, 99900],
              [1, 9999],
            ][level - 1];
            expect(a).toBeGreaterThanOrEqual(min);
            expect(a).toBeLessThanOrEqual(max);
            expect(b).toBeGreaterThanOrEqual(min);
            expect(b).toBeLessThanOrEqual(max);
          } else if (mode === "multiplication") {
            const [amin, amax, bmin, bmax] = [
              [100, 500, 100, 500],
              [200, 1200, 200, 1200],
              [1000, 9900, 200, 1200],
              [200, 9900, 200, 1200],
              [10, 990, 10, 990],
            ][level - 1];
            expect(a).toBeGreaterThanOrEqual(amin);
            expect(a).toBeLessThanOrEqual(amax);
            expect(b).toBeGreaterThanOrEqual(bmin);
            expect(b).toBeLessThanOrEqual(bmax);
          } else {
            const [bmin, bmax, qmin, qmax] = [
              [100, 500, 100, 500],
              [200, 1200, 200, 1200],
              [200, 1200, 1000, 9900],
              [200, 1200, 200, 9900],
              [200, 1200, 1, 999],
            ][level - 1];
            expect(b).toBeGreaterThanOrEqual(bmin);
            expect(b).toBeLessThanOrEqual(bmax);
            expect(answer).toBeGreaterThanOrEqual(qmin);
            expect(answer).toBeLessThanOrEqual(qmax);
          }
        }
      });
    }
  it("does not immediately repeat the same question", () => {
    let previous = generateQuestion("addition", 1);
    for (let i = 0; i < 100; i++) {
      const next = generateQuestion("addition", 1, previous);
      expect(next.key).not.toBe(previous.key);
      previous = next;
    }
  });
});

describe("answer input", () => {
  it.each([
    ["0,5", 50],
    ["0.50", 50],
    ["-12,34", -1234],
    ["001", 100],
    ["0", 0],
    ["-0", -0],
    ["99.99", 9999],
  ])("parses %s exactly", (input, value) =>
    expect(parseAnswer(input)).toBe(value),
  );
  it.each([
    "",
    "-",
    ".",
    "1,",
    "1.234",
    "1,2,3",
    "1e2",
    "NaN",
    "Infinity",
    "1.234,5",
  ])("rejects incomplete or invalid %s", (input) =>
    expect(parseAnswer(input)).toBeNull(),
  );
});

describe("session rules", () => {
  const now = 1_000_000;
  const base = () => ({
    ...startSession("addition", 1, now),
    question: { a: 300, b: 500, answer: 800, key: "fixed" },
  });
  it("starts at exactly 60 seconds", () =>
    expect(remaining(base(), now)).toBe(60_000));
  it("advances only for a correct answer", () => {
    const s = base();
    const next = submitAnswer(s, "8", now + 200);
    expect(next.feedback).toBe("correct");
    expect(next.session.correct).toBe(1);
    expect(next.session.wrong).toBe(0);
    expect(next.session.question.key).not.toBe("fixed");
    expect(next.session.deadline).toBe(s.deadline);
  });
  it("retains the question and removes 10 seconds for every wrong answer", () => {
    const s = base();
    const one = submitAnswer(s, "9", now + 1000);
    const two = submitAnswer(one.session, "7", now + 2000);
    expect(two.session.wrong).toBe(2);
    expect(two.session.question).toBe(s.question);
    expect(remaining(two.session, now + 2000)).toBe(38_000);
  });
  it("finishes immediately when a penalty consumes all remaining time", () => {
    const next = submitAnswer(base(), "0", now + 51_000);
    expect(next.session.status).toBe("finished");
    expect(next.session.wrong).toBe(1);
    expect(remaining(next.session, now + 51_000)).toBe(0);
  });
  it("rejects answers at or after the deadline", () => {
    const next = submitAnswer(base(), "8", now + 60_000);
    expect(next.session.status).toBe("finished");
    expect(next.session.correct).toBe(0);
    expect(next.session.wrong).toBe(0);
    expect(next.feedback).toBeNull();
  });
  it("does not count empty or unfinished input", () => {
    const s = base();
    expect(submitAnswer(s, "-", now).session).toBe(s);
    expect(submitAnswer(s, "", now).session).toBe(s);
  });
  it("does not accept further submissions after finish", () => {
    const s = { ...base(), status: "finished" as const };
    expect(submitAnswer(s, "8", now).session).toBe(s);
  });
  it("uses elapsed wall time, including time spent outside the tab", () =>
    expect(remaining(base(), now + 80_000)).toBe(0));
  it("calculates accuracy for repeated attempts and empty sessions", () => {
    expect(accuracy(0, 0)).toBe(0);
    expect(accuracy(1, 2)).toBe(33);
  });
});

describe("local history", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("continues safely when browser storage is unavailable", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    });
    expect(loadResults()).toEqual([]);
    expect(saveResults([])).toBe(false);
  });
  it("ignores corrupt data and caps history at 50 results", () => {
    let raw = "{broken";
    vi.stubGlobal("localStorage", {
      getItem: () => raw,
      setItem: (key: string, value: string) => {
        expect(key).toBe(STORAGE_KEY);
        raw = value;
      },
    });
    expect(loadResults()).toEqual([]);
    const result = {
      id: "a",
      date: new Date().toISOString(),
      mode: "addition" as const,
      level: 1 as const,
      correct: 3,
      wrong: 0,
    };
    expect(saveResults(Array.from({ length: 60 }, () => result))).toBe(true);
    expect(loadResults()).toHaveLength(50);
    raw = JSON.stringify([
      { ...result, correct: -1 },
      { ...result, date: "invalid" },
      result,
    ]);
    expect(loadResults()).toEqual([result]);
  });
});
