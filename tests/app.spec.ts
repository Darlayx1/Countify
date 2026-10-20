import { expect, test, type Page } from "@playwright/test";

async function answerCurrent(page: Page) {
  const text = (await page.getByTestId("question").innerText())
    .replace(/\s/g, "")
    .replace(/,/g, ".")
    .replace(/[()]/g, "");
  const match = text.match(/^(-?\d+(?:\.\d+)?)([+−×÷])(-?\d+(?:\.\d+)?)=\?$/)!;
  const a = Number(match[1]),
    b = Number(match[3]);
  const value =
    match[2] === "+"
      ? a + b
      : match[2] === "−"
        ? a - b
        : match[2] === "×"
          ? a * b
          : a / b;
  await page.keyboard.type(String(Number(value.toFixed(2))));
  await page.keyboard.press("Enter");
}

test("correct answers, repeated penalties, final result, replay and history", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-10-20T12:00:00Z"));
  await page.goto("./");
  await expect(
    page.getByRole("heading", { name: /Sedikit latihan\./ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Mulai latihan" }).click();
  await answerCurrent(page);
  await expect(page.getByTestId("correct-count")).toHaveText("1");
  const question = (await page.getByTestId("question").textContent())!;
  // Level one addition never reaches 999: every submission here is wrong.
  for (let i = 0; i < 2; i++) {
    await page.keyboard.type("999");
    await page.keyboard.press("Enter");
  }
  await expect(page.getByTestId("wrong-count")).toHaveText("2");
  await expect(page.getByTestId("question")).toHaveText(question);
  for (let i = 0; i < 4; i++) {
    await page.keyboard.type("999");
    await page.keyboard.press("Enter");
  }
  await expect(
    page.getByRole("heading", { name: "Rekor baru. Hebat!" }),
  ).toBeVisible();
  await expect(page.getByTestId("wrong-count")).toHaveText("6");
  await page.getByRole("button", { name: "Latihan lagi" }).click();
  await expect(page.getByTestId("correct-count")).toHaveText("0");
  await page.getByRole("button", { name: "Akhiri latihan" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Ya, akhiri" }).click();
  await page.getByRole("button", { name: "Riwayat", exact: true }).click();
  await expect(page.locator(".history-row")).toHaveCount(1);
  await page.reload();
  await page.getByRole("button", { name: "Riwayat", exact: true }).click();
  await expect(page.locator(".history-row")).toHaveCount(1);
});

test("absolute deadline ends the session after a background-like jump", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-10-20T12:00:00Z"));
  await page.goto("./");
  await page.getByRole("button", { name: "Mulai latihan" }).click();
  await page.clock.setFixedTime(new Date("2026-10-20T12:01:01Z"));
  await expect(
    page.getByRole("heading", { name: "Awal yang berani!" }),
  ).toBeVisible();
  await page.keyboard.type("8");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("correct-count")).toHaveText("0");
});

test("level five accepts decimal and negative answers with the number pad", async ({
  page,
}) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Level 5 Ahli" }).click();
  await page.getByRole("button", { name: "Pembagian", exact: true }).click();
  await page.getByRole("button", { name: "Mulai latihan" }).click();
  await expect(
    page.getByRole("button", { name: "Pemisah desimal" }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Ubah tanda negatif" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Ubah tanda negatif" }).click();
  await page.getByRole("button", { name: "0", exact: true }).click();
  await page.getByRole("button", { name: "Pemisah desimal" }).click();
  await page.getByRole("button", { name: "5", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Jawaban" })).toHaveValue(
    "-0,5",
  );
  await page.getByRole("button", { name: "Bersihkan jawaban" }).click();
  await answerCurrent(page);
  await expect(page.getByTestId("correct-count")).toHaveText("1");
});

test("empty answers are ignored and help dialog traps focus", async ({
  page,
}) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Mulai latihan" }).click();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("wrong-count")).toHaveText("0");
  await page.getByRole("button", { name: "Cara bermain" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("dialog").locator(":focus")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
});

for (const width of [320, 390, 768, 1024, 1440]) {
  test(`responsive layout at ${width}px, including longest decimal questions`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("./");
    await page.getByRole("button", { name: "Level 5 Ahli" }).click();
    await expect(
      page.getByRole("button", { name: "Mulai latihan" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.evaluate(() => {
      let index = 0;
      Math.random = () => (index++ % 2 === 0 ? 0.99999 : 0.25);
    });
    await page.getByRole("button", { name: "Mulai latihan" }).click();
    await expect(page.getByRole("textbox", { name: "Jawaban" })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    const equation = page.getByTestId("question");
    expect(
      await equation.evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
  });
}

test("blocked localStorage does not prevent completing a session", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get: () => {
        throw new Error("unavailable");
      },
    });
  });
  await page.clock.setFixedTime(new Date("2026-10-20T12:00:00Z"));
  await page.goto("./");
  await page.getByRole("button", { name: "Mulai latihan" }).click();
  await page.clock.setFixedTime(new Date("2026-10-20T12:01:01Z"));
  await expect(
    page.getByText("Penyimpanan tidak tersedia. Hasil sementara di sesi ini."),
  ).toBeVisible();
});
