import { chromium, firefox, webkit, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { readFile, mkdir } from "node:fs/promises";
const base = process.env.TEST_URL || "http://localhost:4173";
await mkdir("artifacts", { recursive: true });
for (const [name, engine, mobile] of [
  ["chromium", chromium, false],
  ["firefox", firefox, false],
  ["webkit", webkit, false],
  ["webkit-touch", webkit, true],
]) {
  const browser = await engine.launch({ headless: true });
  const context = await browser.newContext(
    mobile
      ? {
          viewport: { width: 390, height: 844 },
          hasTouch: true,
          isMobile: true,
        }
      : { viewport: { width: 1366, height: 900 } },
  );
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.setDefaultTimeout(15000);
  const settings = page.getByRole("button", { name: /^外观设置/ });
  const download = page.getByRole("button", { name: "下载 PNG", exact: true });
  try {
    await page.goto(base + "/tools/code-image");
    await expect(download).toBeEnabled();
    await page.locator("#shot-code.cm-content").waitFor();
    await settings.click();
    const box = await page.locator(".shot-preview-stage").boundingBox();
    await page.getByLabel("主题", { exact: true }).selectOption("light");
    await page.getByLabel("窗口标题", { exact: true }).fill("PRIVATE_TITLE");
    await page
      .getByRole("button", { name: "关闭外观设置", exact: true })
      .click();
    assert.deepEqual(
      await page.locator(".shot-preview-stage").boundingBox(),
      box,
    );
    await expect(download).toBeEnabled();
    const previous = await page
      .locator("canvas")
      .evaluate((c) => c.toDataURL());
    await page.route("**/assets/code-image.worker-*.js", (route) =>
      route.fulfill({
        contentType: "text/javascript",
        body: 'self.onmessage = e => setTimeout(() => self.postMessage({segments:[{text:e.data.code,type:""}]}), 800);',
      }),
    );
    const editor = page.getByLabel("代码", { exact: true });
    await editor.focus();
    await editor.press("ControlOrMeta+a");
    // Firefox's automation fill uses composition events; exercise actual key input here.
    await editor.pressSequentially('const privateValue = "PRIVATE_SOURCE";');
    await expect(download).toBeDisabled();
    await expect(page.locator("canvas")).toBeVisible();
    assert.equal(
      await page.locator("canvas").evaluate((c) => c.toDataURL()),
      previous,
    );
    await expect(download).toBeEnabled();
    assert.notEqual(
      await page.locator("canvas").evaluate((c) => c.toDataURL()),
      previous,
    );
    await editor.press("ControlOrMeta+a");
    await editor.evaluate((el) => {
      const data = new DataTransfer();
      data.setData("text/plain", 'const 中文 = "👨‍👩‍👧‍👦";');
      const event = new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
      });
      // Firefox intentionally clears clipboardData in constructed events.
      Object.defineProperty(event, "clipboardData", { value: data });
      el.dispatchEvent(event);
    });
    await expect(editor).toHaveText('const 中文 = "👨‍👩‍👧‍👦";');
    await expect(download).toBeEnabled();
    const filePromise = page.waitForEvent("download");
    await download.click();
    const file = await filePromise;
    await file.saveAs(`artifacts/${name}.png`);
    const png = await readFile(`artifacts/${name}.png`);
    assert.equal(png.subarray(1, 4).toString(), "PNG");
    await page.getByRole("button", { name: "清空", exact: true }).click();
    await expect(page.locator("canvas")).toBeHidden();
    await expect(download).toBeDisabled();
    const saved = await page.evaluate(() =>
      JSON.stringify({ ...localStorage, ...sessionStorage }),
    );
    assert.ok(!saved.includes("PRIVATE_"));
    await page.unroute("**/assets/code-image.worker-*.js");
    await page.reload();
    await expect(download).toBeEnabled();
    await settings.click();
    assert.equal(
      await page.getByLabel("主题", { exact: true }).inputValue(),
      "light",
    );
    assert.equal(
      await page.getByLabel("窗口标题", { exact: true }).inputValue(),
      "hello.ts",
    );
    await page
      .getByRole("button", { name: "恢复默认外观", exact: true })
      .click();
    assert.equal(
      await page.getByLabel("主题", { exact: true }).inputValue(),
      "night",
    );
    await page
      .getByRole("button", { name: "关闭外观设置", exact: true })
      .click();
    await page.getByRole("button", { name: /^语言 ·/ }).click();
    await page.getByLabel("搜索语言", { exact: true }).fill("rust");
    await page.getByRole("button", { name: "Rust", exact: true }).click();
    await expect(download).toBeEnabled();
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    // Copy failure must remain actionable without blocking PNG downloads.
    await page.evaluate(() =>
      Object.defineProperty(navigator, "clipboard", {
        value: undefined,
        configurable: true,
      }),
    );
    await page.getByRole("button", { name: "复制图片", exact: true }).click();
    await page
      .getByRole("status")
      .filter({ hasText: "请使用「下载 PNG」" })
      .waitFor();
    await expect(download).toBeEnabled();
    assert.deepEqual(errors, []);
    console.log(
      `${name}: preview stability, stale-export prevention, preferences privacy, menus and PNG passed.`,
    );
  } catch (error) {
    await page
      .screenshot({ path: `artifacts/${name}-failure.png`, fullPage: true })
      .catch(() => {});
    throw error;
  } finally {
    await context.close();
    await browser.close();
  }
}
