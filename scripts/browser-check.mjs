import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const browser = await chromium.launch({ channel: "chrome", headless: true });
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
await mkdir("artifacts", { recursive: true });
try {
  const home = await page.goto(base + "/tools");
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
    const response = await page.goto(base + "/tools/" + id);
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
    await page.waitForFunction(
      () => document.querySelector("#tool-output")?.value.length > 0,
    );
    assert.ok(
      (await page.locator("#tool-output").inputValue()).includes(expected),
      id,
    );
  }
  await page.goto(base + "/tools/json");
  await page
    .locator("#tool-input")
    .fill('{"id":90071992547409931234,"__proto__":1}');
  await page.getByRole("button", { name: "格式化", exact: true }).click();
  await page.waitForFunction(() =>
    document
      .querySelector("#tool-output")
      ?.value.includes("90071992547409931234"),
  );
  assert.ok(
    (await page.locator("#tool-output").inputValue()).includes(
      '"__proto__": 1',
    ),
  );
  await page.screenshot({ path: "artifacts/json-desktop.png", fullPage: true });
  await page.locator("#tool-input").fill("{broken");
  assert.equal(await page.locator("#tool-output").inputValue(), "");
  await page.getByRole("button", { name: "格式化", exact: true }).click();
  await page.getByRole("alert").waitFor();
  await page.getByRole("button", { name: "加载示例", exact: true }).click();
  await page.getByRole("button", { name: "取消", exact: true }).click();
  assert.equal(await page.locator("#tool-input").inputValue(), "{broken");
  const marker = "PRIVATE_MARKER_91b873";
  await page.locator("#tool-input").fill(`{"secret":"${marker}"}`);
  await page.getByRole("button", { name: "格式化", exact: true }).click();
  await page.waitForFunction(() =>
    document.querySelector("#tool-output")?.value.includes("PRIVATE_MARKER"),
  );
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
  assert.equal(await page.locator("#tool-input").inputValue(), "");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base + "/tools");
  await page.screenshot({ path: "artifacts/home-mobile.png", fullPage: true });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.goto(base + "/tools/cron");
  await page.getByRole("button", { name: "每周一", exact: true }).click();
  await page.getByRole("button", { name: "计算执行时间", exact: true }).click();
  await page.waitForFunction(
    () => document.querySelector("#tool-output")?.value.length > 0,
  );
  await page.screenshot({ path: "artifacts/cron-mobile.png", fullPage: true });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  const missing = await page.goto(base + "/missing");
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
  await page.goto(base + "/tools/json");
  await page.getByRole("button", { name: "加载示例", exact: true }).click();
  await page.locator("#tool-input").press("Control+Enter");
  await page.waitForFunction(
    () => document.querySelector("#tool-output")?.value.length > 0,
  );
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("button", { name: "复制", exact: true }).click();
  assert.equal(
    (await page.evaluate(() => navigator.clipboard.readText())).replace(
      /\r\n/g,
      "\n",
    ),
    await page.locator("#tool-output").inputValue(),
  );
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载", exact: true }).click();
  assert.equal((await downloadPromise).suggestedFilename(), "wind-json.json");
  await page.goto(base + "/tools/cron");
  await page.getByLabel("表达式模式", { exact: true }).selectOption("linux");
  await page.getByRole("button", { name: "加载示例", exact: true }).click();
  assert.equal(await page.locator("#tool-input").inputValue(), "*/5 * * * *");
  await page.getByRole("button", { name: "计算执行时间", exact: true }).click();
  await page.waitForFunction(() =>
    document.querySelector("#tool-output")?.value.includes("Linux"),
  );
  // Exercise cancellation and the real timeout with an intentionally stalled Worker.
  await page.route("**/assets/worker-*.js", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: "self.onmessage = () => {};",
    }),
  );
  await page.goto(base + "/tools/json");
  await page.getByRole("button", { name: "加载示例", exact: true }).click();
  await page.getByRole("button", { name: "格式化", exact: true }).click();
  await page.getByRole("button", { name: "取消处理", exact: true }).click();
  assert.equal(await page.locator("#tool-output").inputValue(), "");
  assert.ok(
    await page.getByRole("button", { name: "格式化", exact: true }).isEnabled(),
  );
  await page.getByRole("button", { name: "格式化", exact: true }).click();
  await page.locator("#tool-input").fill('{"replacement":true}');
  assert.equal(await page.locator("#tool-output").inputValue(), "");
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
