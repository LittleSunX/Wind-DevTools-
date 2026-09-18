import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const browser = await chromium.launch({
  channel: process.env.PW_CHANNEL === "bundled" ? undefined : "chrome",
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const base = process.env.TEST_URL || process.argv[2] || "http://localhost:4173";
page.setDefaultTimeout(10000);
const payloads = [];
page.on("request", (r) => payloads.push(r.url() + " " + (r.postData() || "")));
const external = [];
page.on("request", (r) => {
  if (!r.url().startsWith(base) && !r.url().startsWith("data:"))
    external.push(r.url());
});
async function goto(url) {
  const response = await page.goto(url);
  if (/\/tools\/(json|sql)$/.test(url))
    await page.locator("#tool-input.cm-content").waitFor();
  return response;
}
async function editorValue(selector) {
  return page.locator(selector).evaluate((el) =>
    el instanceof HTMLTextAreaElement
      ? el.value
      : [...el.querySelectorAll(".cm-line")]
          .map((line) => {
            const copy = line.cloneNode(true);
            copy
              .querySelectorAll(".cm-placeholder")
              .forEach((node) => node.remove());
            return copy.textContent;
          })
          .join("\n"),
  );
}
async function waitOutput(expected = "") {
  await expect
    .poll(() => editorValue("#tool-output"))
    .toContain(expected || "\n");
}
await mkdir("artifacts", { recursive: true });
try {
  const home = await goto(base + "/tools");
  assert.equal(home.status(), 200);
  await page.getByRole("heading", { name: /常用工具，.*刚刚好。/ }).waitFor();
  assert.equal(await page.locator(".tool-card").count(), 6);
  await page.getByRole("textbox", { name: "搜索工具" }).fill("jwt");
  assert.equal(await page.locator(".tool-card").count(), 1);
  await page.getByRole("textbox", { name: "搜索工具" }).fill("");
  await page.screenshot({ path: "artifacts/home-desktop.png", fullPage: true });
  for (const [id, button, expected] of [
    ["json", "格式化", '"name": "Wind"'],
    ["timestamp", "转换", "ISO 8601"],
    ["jwt", "解析 JWT", "签名未经验证"],
    ["sql", "格式化", "SELECT"],
    ["cron", "计算执行时间", "5. "],
  ]) {
    const response = await goto(base + "/tools/" + id);
    assert.equal(response.status(), 200);
    const source = await response.text();
    assert.ok(source.includes("<h1>"), "missing pre-rendered heading");
    assert.ok((await page.title()).includes("Wind DevTools"));
    assert.ok(
      !(
        await page.locator('meta[name="description"]').getAttribute("content")
      ).startsWith("免费、无需登录"),
      "missing per-tool description",
    );
    await page.getByRole("button", { name: "加载示例", exact: true }).click();
    await page.getByRole("button", { name: button, exact: true }).click();
    await waitOutput();
    assert.ok((await editorValue("#tool-output")).includes(expected), id);
  }
  await goto(base + "/tools/json");
  await page
    .locator("#tool-input")
    .fill('{"id":90071992547409931234,"__proto__":1}');
  await page.getByRole("button", { name: "格式化", exact: true }).click();
  await waitOutput("90071992547409931234");
  assert.ok((await editorValue("#tool-output")).includes('"__proto__": 1'));
  await page.screenshot({ path: "artifacts/json-desktop.png", fullPage: true });
  await page.locator("#tool-input").fill("{broken");
  assert.equal(await editorValue("#tool-output"), "");
  await page.getByRole("button", { name: "格式化", exact: true }).click();
  await page.getByRole("alert").waitFor();
  await page.getByRole("button", { name: "加载示例", exact: true }).click();
  await page.getByRole("button", { name: "取消", exact: true }).click();
  assert.equal(await editorValue("#tool-input"), "{broken");
  const marker = "PRIVATE_MARKER_91b873";
  await page.locator("#tool-input").fill(`{"secret":"${marker}"}`);
  await page.getByRole("button", { name: "格式化", exact: true }).click();
  await waitOutput("PRIVATE_MARKER");
  assert.equal(
    await page.evaluate(() =>
      JSON.stringify({ ...localStorage, ...sessionStorage }),
    ),
    "{}",
  );
  assert.ok(!page.url().includes(marker));
  assert.ok(
    payloads.every((p) => !p.includes(marker)),
    "input leaked into a request",
  );
  assert.deepEqual(external, []);
  await page.reload();
  await page.locator("#tool-input.cm-content").waitFor();
  assert.equal(await editorValue("#tool-input"), "");
  await page.setViewportSize({ width: 390, height: 844 });
  await goto(base + "/tools");
  await page.screenshot({ path: "artifacts/home-mobile.png", fullPage: true });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await goto(base + "/tools/cron");
  await page.getByRole("button", { name: "每周一", exact: true }).click();
  await page.getByRole("button", { name: "计算执行时间", exact: true }).click();
  await waitOutput();
  await page.screenshot({ path: "artifacts/cron-mobile.png", fullPage: true });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  const missing = await goto(base + "/missing");
  assert.equal(missing.status(), 404);
  await page.getByRole("heading", { name: "这个工具还不存在。" }).waitFor();
  // Test local DST edge cases in an actual browser with a fixed IANA timezone.
  const dst = await browser.newContext({ timezoneId: "America/New_York" });
  const dp = await dst.newPage();
  await dp.goto(base + "/tools/timestamp");
  await dp.getByLabel("转换方向").selectOption("date");
  await dp.getByLabel("时区", { exact: true }).selectOption("local");
  for (const date of ["2026-03-08 02:30:00", "2026-11-01 01:30:00"]) {
    await dp.locator("#tool-input").fill(date);
    await dp.getByRole("button", { name: "转换", exact: true }).click();
    await dp.getByRole("alert").waitFor();
    assert.ok((await dp.getByRole("alert").innerText()).includes("夏令时"));
  }
  await dst.close();
  // Verify controls that copy, download and change the selected dialect.
  await goto(base + "/tools/json");
  await page.getByRole("button", { name: "加载示例", exact: true }).click();
  await page.locator("#tool-input").press("Control+Enter");
  await waitOutput();
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("button", { name: "复制", exact: true }).click();
  assert.equal(
    (await page.evaluate(() => navigator.clipboard.readText())).replace(
      /\r\n/g,
      "\n",
    ),
    await editorValue("#tool-output"),
  );
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载", exact: true }).click();
  assert.equal((await downloadPromise).suggestedFilename(), "wind-json.json");
  await goto(base + "/tools/cron");
  await page.getByLabel("表达式模式", { exact: true }).selectOption("linux");
  await page.getByRole("button", { name: "加载示例", exact: true }).click();
  assert.equal(await editorValue("#tool-input"), "*/5 * * * *");
  await page.getByRole("button", { name: "计算执行时间", exact: true }).click();
  await waitOutput("Linux");
  await goto(base + "/tools/json");
  const code = page.locator("#tool-input");
  await code.fill('{"name":"Wind"}');
  await code.press("Home");
  await code.press("Tab");
  assert.equal(await editorValue("#tool-input"), '  {"name":"Wind"}');
  await code.press("Control+z");
  assert.equal(await editorValue("#tool-input"), '{"name":"Wind"}');
  await code.press("Escape");
  await code.press("Tab");
  assert.ok(
    await code.evaluate((el) => document.activeElement !== el),
    "Tab escape must leave the editor",
  );
  await code.press("Control+Enter");
  await waitOutput();
  assert.ok(
    !(await editorValue("#tool-input")).endsWith("\n"),
    "execute must not insert a blank line",
  );
  assert.ok(
    (await page.locator("#tool-output span").count()) > 0,
    "result has highlighted tokens",
  );
  assert.equal(
    await page.locator("#tool-output").getAttribute("contenteditable"),
    "false",
  );
  assert.equal(
    await page.locator("#tool-output").getAttribute("aria-readonly"),
    "true",
  );
  await page.getByRole("checkbox", { name: "自动换行" }).uncheck();
  assert.equal(await page.locator(".cm-lineWrapping").count(), 0);
  await code.fill('{"long":"' + "x".repeat(3000) + '"}');
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "long lines must not widen page",
  );
  await page.getByRole("checkbox", { name: "自动换行" }).check();
  await code.fill('{"large":"' + "x".repeat(200001) + '"}');
  await page.getByText("大文本模式 · 已暂停语法高亮").waitFor();
  await page.getByRole("button", { name: "清空", exact: true }).click();
  await code.press("Control+z");
  assert.equal(
    await editorValue("#tool-input"),
    "",
    "clear resets undo history",
  );
  await code.fill('{"valid":true}');
  await code.press("Control+Enter");
  await waitOutput();
  assert.ok(
    !(await editorValue("#tool-input")).endsWith("\n"),
    "execute must not insert a blank line",
  );
  await page.screenshot({ path: "artifacts/json-mobile.png", fullPage: true });
  // Exercise cancellation and the real timeout with an intentionally stalled Worker.
  await page.route("**/assets/worker-*.js", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: "self.onmessage = () => {};",
    }),
  );
  await goto(base + "/tools/json");
  await page.getByRole("button", { name: "加载示例", exact: true }).click();
  await page.getByRole("button", { name: "格式化", exact: true }).click();
  await page.getByRole("button", { name: "取消处理", exact: true }).click();
  assert.equal(await editorValue("#tool-output"), "");
  assert.ok(
    await page.getByRole("button", { name: "格式化", exact: true }).isEnabled(),
  );
  await page.getByRole("button", { name: "格式化", exact: true }).click();
  await page.locator("#tool-input").fill('{"replacement":true}');
  assert.equal(await editorValue("#tool-output"), "");
  assert.ok(
    await page.getByRole("button", { name: "格式化", exact: true }).isEnabled(),
  );
  await page.getByRole("button", { name: "格式化", exact: true }).click();
  await page.getByRole("alert").waitFor({ timeout: 11000 });
  assert.ok((await page.getByRole("alert").innerText()).includes("8 秒"));
  await page.unroute("**/assets/worker-*.js");
  assert.deepEqual(errors, []);
  console.log(
    "Browser checks passed: 5 tools, input invalidation, JSON precision, privacy, mobile overflow, DST, 404, cancellation and timeout.",
  );
} finally {
  await browser.close();
}
