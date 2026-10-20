export type Mode = "addition" | "subtraction" | "multiplication" | "division";
export type Level = 1 | 2 | 3 | 4 | 5;
export interface Question {
  a: number;
  b: number;
  answer: number;
  key: string;
}
export interface Session {
  mode: Mode;
  level: Level;
  question: Question;
  deadline: number;
  correct: number;
  wrong: number;
  status: "playing" | "finished";
}
export interface Result {
  id: string;
  date: string;
  mode: Mode;
  level: Level;
  correct: number;
  wrong: number;
}
export const MODES: {
  id: Mode;
  name: string;
  symbol: string;
  description: string;
}[] = [
  {
    id: "addition",
    name: "Penjumlahan",
    symbol: "+",
    description: "Satukan angka, asah logika.",
  },
  {
    id: "subtraction",
    name: "Pengurangan",
    symbol: "−",
    description: "Temukan selisih dengan tepat.",
  },
  {
    id: "multiplication",
    name: "Perkalian",
    symbol: "×",
    description: "Bangun kecepatan berpikir.",
  },
  {
    id: "division",
    name: "Pembagian",
    symbol: "÷",
    description: "Bagi angkanya, lipatgandakan fokus.",
  },
];
export const LEVELS = ["Dasar", "Pemula", "Menengah", "Mahir", "Ahli"];
export const STORAGE_KEY = "countify:results:v1";

// Every number is stored in hundredths. All operations remain integer-exact.
export function generateQuestion(
  mode: Mode,
  level: Level,
  previous?: Question,
  random = Math.random,
): Question {
  const integer = (min: number, max: number) =>
    min + Math.floor(random() * (max - min + 1));
  const sign = () => (random() < 0.5 ? -1 : 1);
  let question: Question;
  let attempts = 0;
  do {
    let a = 0,
      b = 0,
      answer = 0;
    if (mode === "addition" || mode === "subtraction") {
      const ranges = [
        [0, 9],
        [10, 99],
        [100, 999],
        [10, 999],
      ];
      if (level === 5) {
        a = integer(1, 9999) * sign();
        b = integer(1, 9999) * sign();
        if (a % 100 === 0 && b % 100 === 0) a += a > 0 ? 1 : -1;
      } else {
        const [min, max] = ranges[level - 1];
        a = integer(min, max) * 100;
        b = integer(min, max) * 100;
        if (level === 4) {
          a *= sign();
          b *= sign();
        }
        if (mode === "subtraction" && level < 4 && a < b) [a, b] = [b, a];
      }
      answer = mode === "addition" ? a + b : a - b;
    } else if (mode === "multiplication") {
      if (level === 5) {
        a = integer(1, 99) * 10 * sign();
        b = integer(1, 99) * 10 * sign();
        if (a % 100 === 0 && b % 100 === 0) a += a > 0 ? 10 : -10;
      } else {
        a =
          integer(
            level === 1 ? 1 : level === 3 ? 10 : 2,
            level === 1 ? 5 : level >= 3 ? 99 : 12,
          ) * 100;
        b = integer(level === 1 ? 1 : 2, level === 1 ? 5 : 12) * 100;
        if (level === 4) {
          a *= sign();
          b *= sign();
        }
      }
      answer = (a * b) / 100;
    } else {
      b = integer(level === 1 ? 1 : 2, level === 1 ? 5 : 12) * 100;
      answer =
        level === 5
          ? integer(1, 999)
          : integer(
              level === 1 ? 1 : level === 3 ? 10 : 2,
              level === 1 ? 5 : level >= 3 ? 99 : 12,
            ) * 100;
      if (level >= 4) {
        b *= sign();
        answer *= sign();
      }
      if (level === 5 && answer % 100 === 0) answer += answer > 0 ? 1 : -1;
      a = (b * answer) / 100;
      if (level === 5 && a % 100 === 0) {
        answer += answer > 0 ? 1 : -1;
        a = (b * answer) / 100;
      }
    }
    question = { a, b, answer, key: `${mode}:${a}:${b}` };
    attempts++;
  } while (question.key === previous?.key && attempts < 30);
  return question;
}

export function formatNumber(hundredths: number): string {
  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 2,
    useGrouping: false,
  }).format(hundredths / 100);
}

export function parseAnswer(input: string): number | null {
  if (!/^-?\d+(?:[.,]\d{1,2})?$/.test(input)) return null;
  const [whole, fraction = ""] = input
    .replace(",", ".")
    .replace("-", "")
    .split(".");
  const value = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(value)
    ? value * (input.startsWith("-") ? -1 : 1)
    : null;
}

export function startSession(
  mode: Mode,
  level: Level,
  now = Date.now(),
): Session {
  return {
    mode,
    level,
    question: generateQuestion(mode, level),
    deadline: now + 60_000,
    correct: 0,
    wrong: 0,
    status: "playing",
  };
}

export function remaining(session: Session, now = Date.now()): number {
  return Math.max(0, session.deadline - now);
}

export function submitAnswer(
  session: Session,
  input: string,
  now = Date.now(),
): { session: Session; feedback: "correct" | "wrong" | null } {
  if (session.status === "finished") return { session, feedback: null };
  if (remaining(session, now) === 0)
    return { session: { ...session, status: "finished" }, feedback: null };
  const answer = parseAnswer(input);
  if (answer === null) return { session, feedback: null };
  if (answer === session.question.answer) {
    return {
      session: {
        ...session,
        correct: session.correct + 1,
        question: generateQuestion(
          session.mode,
          session.level,
          session.question,
        ),
      },
      feedback: "correct",
    };
  }
  const deadline = session.deadline - 10_000;
  return {
    session: {
      ...session,
      wrong: session.wrong + 1,
      deadline,
      status: deadline <= now ? "finished" : "playing",
    },
    feedback: "wrong",
  };
}

export function accuracy(correct: number, wrong: number): number {
  return correct + wrong ? Math.round((correct / (correct + wrong)) * 100) : 0;
}

export function loadResults(): Result[] {
  try {
    const parsed: unknown = JSON.parse(
      localStorage.getItem(STORAGE_KEY) || "[]",
    );
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (r): r is Result =>
          r &&
          typeof r.id === "string" &&
          typeof r.date === "string" &&
          !Number.isNaN(Date.parse(r.date)) &&
          MODES.some((m) => m.id === r.mode) &&
          Number.isInteger(r.level) &&
          r.level >= 1 &&
          r.level <= 5 &&
          Number.isInteger(r.correct) &&
          r.correct >= 0 &&
          Number.isInteger(r.wrong) &&
          r.wrong >= 0,
      )
      .slice(0, 50);
  } catch {
    return [];
  }
}

export function saveResults(results: Result[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(results.slice(0, 50)));
    return true;
  } catch {
    return false;
  }
}
