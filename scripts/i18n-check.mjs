import { chromium, firefox, webkit, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const base = process.env.TEST_URL || "http://localhost:4173";
await mkdir("artifacts", { recursive: true });
for (const [name, engine] of [
  ["chromium", chromium],
  ["firefox", firefox],
  ["webkit", webkit],
]) {
  const browser = await engine.launch();
  const context = await browser.newContext({
    locale: "en-US",
    viewport: { width: 1440, height: 1120 },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  const switchTo = async (language) => {
    await page.locator(".language-switcher").selectOption(language);
    await expect(page.locator("html")).toHaveAttribute(
      "lang",
      language === "zh" ? "zh-CN" : "en",
    );
  };
  const noChineseUI = async () => {
    const leftovers = await page.evaluate(() => {
      const found = [],
        walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode,
          parent = node.parentElement;
        if (
          !parent ||
          parent.closest(
            'script, style, textarea, .cm-content, .canvas-artwork, .diff-lines, .language-switcher, [role="alert"], [role="status"]',
          )
        )
          continue;
        if (!parent.getClientRects().length) continue;
        if (/\p{Script=Han}/u.test(node.textContent))
          found.push(node.textContent.trim());
      }
      return found;
    });
    assert.deepEqual(
      leftovers,
      [],
      `Untranslated UI: ${leftovers.join(" | ")}`,
    );
  };
  try {
    await page.goto(base + "/tools");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await page.getByLabel("Search tools", { exact: true }).fill("timestamp");
    await expect(page.locator(".tool-card")).toHaveCount(1);
    await expect(page.locator(".filters > span")).toHaveText("1 tool");
    await switchTo("zh");
    await expect(page.getByLabel("搜索工具", { exact: true })).toHaveValue(
      "timestamp",
    );
    await page.reload();
    await expect(page.locator(".language-switcher")).toHaveValue("zh");
    await switchTo("en");
    await page.getByRole("button", { name: "Data tools", exact: true }).click();
    const count = await page.locator(".tool-card").count();
    await switchTo("zh");
    await expect(page.locator(".tool-card")).toHaveCount(count);
    await switchTo("en");
    for (const tool of [
      "json",
      "timestamp",
      "jwt",
      "sql",
      "cron",
      "diff",
      "codec",
      "json-type",
      "text",
      "code-image",
    ]) {
      await page.goto(`${base}/tools/${tool}`);
      await expect(page.locator("html")).toHaveAttribute("lang", "en");
      await noChineseUI();
    }
    // Worker-generated explanatory output uses the selected language too.
    for (const [tool, action, expected] of [
      ["timestamp", "Convert", "Timestamp (seconds)"],
      ["jwt", "Decode JWT", "Time information (based on the device clock)"],
      ["cron", "Calculate schedule", "Upcoming runs"],
    ]) {
      await page.goto(`${base}/tools/${tool}`);
      await page
        .getByRole("button", { name: "Load example", exact: true })
        .click();
      await page.getByRole("button", { name: action, exact: true }).click();
      await expect(page.getByLabel("Result", { exact: true })).toHaveValue(
        new RegExp(expected.replace(/[()]/g, "\\$&")),
      );
    }
    await page.goto(base + "/tools/code-image");
    const code = page.getByLabel("Code", { exact: true });
    await code.fill('const greeting = "中文 {{name}}";');
    await page.getByLabel("Window title", { exact: true }).fill("保留标题.ts");
    await page.getByLabel("Style", { exact: true }).selectOption("暖纸手记");
    await expect(
      page.getByRole("button", { name: "Export", exact: true }),
    ).toBeEnabled();
    await switchTo("zh");
    await expect(page.getByLabel("代码", { exact: true })).toHaveValue(
      'const greeting = "中文 {{name}}";',
    );
    await expect(page.getByLabel("窗口标题", { exact: true })).toHaveValue(
      "保留标题.ts",
    );
    await expect(page.getByLabel("风格", { exact: true })).toHaveValue(
      "暖纸手记",
    );
    await switchTo("en");
    await page.getByRole("button", { name: "Appearance", exact: true }).click();
    await expect(
      page.getByRole("dialog", { name: "Appearance", exact: true }),
    ).toBeVisible();
    await noChineseUI();
    await page.screenshot({ path: `artifacts/i18n-${name}-appearance.png` });
    await page
      .getByRole("button", { name: "Close Appearance", exact: true })
      .click();
    await page.goto(base + "/tools/codec");
    const input = page.getByLabel("Input", { exact: true });
    await input.fill("代码画布 {{name}}");
    await page.getByRole("button", { name: "Convert", exact: true }).click();
    await expect(page.getByLabel("Result", { exact: true })).not.toHaveValue(
      "",
    );
    const result = await page
      .getByLabel("Result", { exact: true })
      .inputValue();
    await switchTo("zh");
    await expect(page.getByLabel("输入", { exact: true })).toHaveValue(
      "代码画布 {{name}}",
    );
    await expect(page.getByLabel("处理结果", { exact: true })).toHaveValue(
      result,
    );
    await page.goto(base + "/tools/json");
    await expect(page.locator(".cm-content").first()).toBeVisible();
    await page
      .getByRole("textbox", { name: "输入", exact: true })
      .fill('{"代码":1,"代码":2}');
    await page.getByRole("button", { name: "格式化", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("重复键");
    await switchTo("en");
    await expect(page.getByRole("alert")).toContainText("Duplicate key “代码”");
    await expect(
      page.getByRole("textbox", { name: "Input", exact: true }),
    ).toHaveText('{"代码":1,"代码":2}');
    await page
      .getByRole("textbox", { name: "Input", exact: true })
      .fill('{"中文":1}');
    await page.getByRole("button", { name: "Format", exact: true }).click();
    await expect(
      page.getByRole("textbox", { name: "Result", exact: true }),
    ).toContainText('"中文": 1');
    await page
      .getByRole("button", { name: "Send to canvas", exact: true })
      .click();
    await expect(page.getByLabel("Code", { exact: true })).toHaveValue(
      /"中文": 1/,
    );
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    for (const width of [375, 800]) {
      await page.setViewportSize({ width, height: 900 });
      for (const route of ["/tools", "/tools/json", "/tools/code-image"]) {
        await page.goto(base + route);
        await expect(page.locator("html")).toHaveAttribute("lang", "en");
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
          `${route} overflows at ${width}`,
        );
        await expect(page.locator(".language-switcher")).toBeVisible();
      }
    }
    await page.screenshot({ path: `artifacts/i18n-${name}-mobile.png` });
    assert.deepEqual(errors, []);
    // Preference failures must not break detection or switching.
    const blocked = await browser.newContext({ locale: "en-US" });
    await blocked.addInitScript(() => {
      Storage.prototype.getItem = () => {
        throw new Error("blocked");
      };
      Storage.prototype.setItem = () => {
        throw new Error("blocked");
      };
    });
    const other = await blocked.newPage();
    await other.goto(base + "/tools");
    await expect(other.locator("html")).toHaveAttribute("lang", "en");
    await other.locator(".language-switcher").selectOption("zh");
    await expect(other.locator("html")).toHaveAttribute("lang", "zh-CN");
    await blocked.close();
    console.log(
      `${name}: bilingual UI, persistence, state preservation, errors, transfer, mobile and blocked storage passed.`,
    );
  } catch (error) {
    await page.screenshot({
      path: `artifacts/i18n-${name}-failure.png`,
      fullPage: true,
    });
    throw error;
  } finally {
    await browser.close();
  }
}
