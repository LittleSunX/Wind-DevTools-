import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const base = process.argv[2] || "http://localhost:4173";
const context = await browser.newContext({
  viewport: { width: 1440, height: 1050 },
  permissions: ["clipboard-read", "clipboard-write"],
});
const page = await context.newPage();
page.setDefaultTimeout(10000);
const errors = [],
  requests = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("request", (r) => requests.push(r.url() + " " + (r.postData() || "")));
const downloadButton = page.getByRole("button", {
  name: "下载 PNG",
  exact: true,
});
async function ready() {
  await downloadButton.waitFor();
  await page.waitForFunction(
    () =>
      !Array.from(document.querySelectorAll("button")).find((b) =>
        b.textContent.includes("下载 PNG"),
      )?.disabled,
  );
}
try {
  await mkdir("artifacts", { recursive: true });
  const response = await page.goto(base + "/tools/code-image");
  assert.equal(response.status(), 200);
  assert.ok((await response.text()).includes("代码画布"));
  await ready();
  const initial = await page
    .locator("canvas")
    .evaluate((c) => ({ w: c.width, h: c.height }));
  assert.ok(initial.w > 800 && initial.h > 600);
  await page.screenshot({
    path: "artifacts/code-image-desktop.png",
    fullPage: true,
  });
  const dp = page.waitForEvent("download");
  await downloadButton.click();
  const download = await dp;
  await download.saveAs("artifacts/code-image-export.png");
  const png = await readFile("artifacts/code-image-export.png");
  assert.equal(png.subarray(1, 4).toString(), "PNG");
  assert.equal(png.readUInt32BE(16), initial.w);
  assert.equal(png.readUInt32BE(20), initial.h);
  await page.getByLabel("导出倍率", { exact: true }).selectOption("1");
  await ready();
  assert.equal(
    await page.locator("canvas").evaluate((c) => c.width),
    initial.w / 2,
  );
  await page.getByLabel("背景", { exact: true }).selectOption("transparent");
  await ready();
  assert.equal(
    await page
      .locator("canvas")
      .evaluate((c) => c.getContext("2d").getImageData(0, 0, 1, 1).data[3]),
    0,
  );
  await page.getByLabel("背景", { exact: true }).selectOption("solid");
  await page.getByLabel("背景颜色", { exact: true }).fill("#ff0000");
  await ready();
  assert.deepEqual(
    await page
      .locator("canvas")
      .evaluate((c) =>
        Array.from(c.getContext("2d").getImageData(0, 0, 1, 1).data),
      ),
    [255, 0, 0, 255],
  );
  await page.getByLabel("主题", { exact: true }).selectOption("light");
  await page.getByLabel("显示行号").uncheck();
  await page.getByLabel("窗口标题栏").uncheck();
  await ready();
  const marker = "PRIVATE_CODE_47219";
  await page
    .getByLabel("代码", { exact: true })
    .fill(`const token = "${marker}";\n// 中文测试 <script>alert(1)</script>`);
  await ready();
  await page.getByRole("button", { name: "复制图片", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "图片已复制" }).waitFor();
  const copied = await page.evaluate(async () => {
    const items = await navigator.clipboard.read();
    const blob = await items[0].getType("image/png");
    const img = await createImageBitmap(blob);
    return { w: img.width, h: img.height };
  });
  assert.deepEqual(
    copied,
    await page.locator("canvas").evaluate((c) => ({ w: c.width, h: c.height })),
  );
  assert.ok(requests.every((r) => !r.includes(marker)));
  assert.ok(requests.every((r) => r.startsWith(base)));
  assert.equal(
    await page.evaluate(() =>
      JSON.stringify({ ...localStorage, ...sessionStorage }),
    ),
    "{}",
  );
  await page.getByRole("button", { name: "清空", exact: true }).click();
  await page.getByRole("alert").waitFor();
  assert.ok(await downloadButton.isDisabled());
  await page.getByLabel("代码", { exact: true }).fill("x".repeat(12001));
  await page.getByRole("alert").filter({ hasText: "12,000" }).waitFor();
  await page.getByLabel("代码", { exact: true }).fill("x".repeat(600));
  await page.getByLabel("语言", { exact: true }).selectOption("plain");
  await page.getByRole("alert").filter({ hasText: "单行" }).waitFor();
  assert.ok(await downloadButton.isDisabled());
  await page.reload();
  await ready();
  assert.ok(
    !(await page.getByLabel("代码", { exact: true }).inputValue()).includes(
      marker,
    ),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "artifacts/code-image-mobile.png",
    fullPage: true,
  });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  assert.deepEqual(errors, []);
  console.log(
    "Code image checks passed: live preview, PNG bytes/dimensions, scaling, alpha, colors, clipboard, limits, privacy and mobile.",
  );
} finally {
  await browser.close();
}
