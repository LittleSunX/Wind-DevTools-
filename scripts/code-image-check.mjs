import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
const browser = await chromium.launch({
  channel: process.env.PW_CHANNEL === "bundled" ? undefined : "chrome",
  headless: true,
});
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
async function closePanels() {
  await page.evaluate(() =>
    document
      .querySelectorAll(":popover-open")
      .forEach((el) => el.hidePopover()),
  );
}
async function field(label) {
  if (["代码", "预览缩放", "导出倍率", "风格"].includes(label)) {
    await closePanels();
  } else if (label === "搜索语言") {
    if (!(await page.getByRole("dialog", { name: "选择语言" }).isVisible()))
      await page.getByRole("button", { name: /^语言 ·/ }).click();
  } else if (
    !(await page
      .getByRole("dialog", { name: "外观设置", exact: true })
      .isVisible())
  ) {
    await page
      .getByRole("button", { name: "外观设置", exact: false })
      .filter({ hasText: "⌄" })
      .click();
  }
  return page.getByLabel(label, { exact: true });
}
async function chooseLanguage(id) {
  await field("搜索语言");
  await page
    .getByRole("dialog", { name: "选择语言" })
    .locator(`button[value="${id}"]`)
    .click();
}
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
  await page.locator("#shot-code.cm-content").waitFor();
  const editorBefore = await page.locator(".shot-controls").boundingBox();
  const previewBefore = await page.locator(".shot-preview-stage").boundingBox();
  await field("主题");
  assert.deepEqual(
    await page.locator(".shot-controls").boundingBox(),
    editorBefore,
  );
  assert.deepEqual(
    await page.locator(".shot-preview-stage").boundingBox(),
    previewBefore,
  );
  await page.keyboard.press("Escape");
  assert.equal(await page.locator(":popover-open").count(), 0);
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
  assert.match(
    download.suggestedFilename(),
    /^wind-code-\d{8}-\d{6}-\d{3}\.png$/,
  );
  await download.saveAs("artifacts/code-image-export.png");
  const png = await readFile("artifacts/code-image-export.png");
  assert.equal(png.subarray(1, 4).toString(), "PNG");
  assert.equal(png.readUInt32BE(16), initial.w);
  assert.equal(png.readUInt32BE(20), initial.h);
  await (await field("导出倍率")).selectOption("1");
  await ready();
  assert.equal(
    await page.locator("canvas").evaluate((c) => c.width),
    initial.w / 2,
  );
  await (await field("背景")).selectOption("transparent");
  await ready();
  assert.equal(
    await page
      .locator("canvas")
      .evaluate((c) => c.getContext("2d").getImageData(0, 0, 1, 1).data[3]),
    0,
  );
  await (await field("背景")).selectOption("solid");
  await (await field("背景颜色")).fill("#ff0000");
  await ready();
  assert.deepEqual(
    await page
      .locator("canvas")
      .evaluate((c) =>
        Array.from(c.getContext("2d").getImageData(0, 0, 1, 1).data),
      ),
    [255, 0, 0, 255],
  );
  await (await field("主题")).selectOption("light");
  await (await field("显示行号")).uncheck();
  await (await field("窗口标题栏")).uncheck();
  await ready();
  await (await field("搜索语言")).fill("rust");
  await chooseLanguage("rust");
  await (await field("代码")).fill('fn main() { println!("Hello"); }');
  await ready();
  assert.ok((await page.locator("#shot-code .shot-token-keyword").count()) > 0);
  await (await field("搜索语言")).fill("");
  assert.equal(await page.locator(".shot-language-list button").count(), 28);
  await (await field("风格")).selectOption("暖日落");
  await ready();
  assert.equal(await (await field("主题")).inputValue(), "graphite");
  const beforeZoom = await page
    .locator("canvas")
    .evaluate((c) => [c.width, c.height]);
  await (await field("预览缩放")).selectOption("1.5");
  assert.deepEqual(
    await page.locator("canvas").evaluate((c) => [c.width, c.height]),
    beforeZoom,
  );
  await (await field("预览缩放")).selectOption("fit");
  await chooseLanguage("typescript");
  const marker = "PRIVATE_CODE_47219";
  await (
    await field("代码")
  ).fill(`const token = "${marker}";\n// 中文测试 <script>alert(1)</script>`);
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
  const saved = await page.evaluate(() =>
    JSON.stringify({ ...localStorage, ...sessionStorage }),
  );
  assert.ok(!saved.includes(marker));
  assert.deepEqual(await page.evaluate(() => Object.keys(localStorage)), [
    "wind.canvas.preferences.v1",
  ]);
  await closePanels();
  await page.getByRole("button", { name: "清空", exact: true }).click();
  await page.getByRole("alert").waitFor();
  assert.ok(await downloadButton.isDisabled());
  await (await field("代码")).fill("x".repeat(12001));
  await page.getByRole("alert").filter({ hasText: "12,000" }).waitFor();
  await (await field("代码")).fill("x".repeat(600));
  await chooseLanguage("plain");
  await page.getByRole("alert").filter({ hasText: "单行" }).waitFor();
  assert.ok(await downloadButton.isDisabled());
  // Long lines wrap only in the image; fixed width includes padding and scales exactly.
  await (await field("宽度模式")).selectOption("fixed");
  await (await field("画布宽度")).selectOption("640");
  await (await field("导出倍率")).selectOption("2");
  await ready();
  assert.equal(await page.locator("canvas").evaluate((c) => c.width), 1280);
  assert.equal(await (await field("代码")).textContent(), "x".repeat(600));
  const fixedDownload = page.waitForEvent("download");
  await downloadButton.click();
  const fixedFile = await fixedDownload;
  await fixedFile.saveAs("artifacts/code-image-wrapped.png");
  assert.equal(
    (await readFile("artifacts/code-image-wrapped.png")).readUInt32BE(16),
    1280,
  );
  await (await field("长行自动换行")).uncheck();
  await page.getByRole("alert").filter({ hasText: "第 1 行" }).waitFor();
  assert.ok(await downloadButton.isDisabled());
  await (await field("长行自动换行")).check();
  await ready();
  await (await field("画布宽度")).selectOption("custom");
  for (const value of ["", "319", "2401", "640.5"]) {
    await (await field("自定义宽度")).fill(value);
    await page.getByRole("alert").filter({ hasText: "320–2400" }).waitFor();
    assert.ok(await downloadButton.isDisabled());
  }
  await (await field("自定义宽度")).fill("721");
  await ready();
  assert.equal(await page.locator("canvas").evaluate((c) => c.width), 1442);
  await (await field("自定义宽度")).fill("320");
  await (await field("代码")).fill("W".repeat(12000));
  await page.getByRole("alert").filter({ hasText: "图片尺寸过大" }).waitFor();
  assert.ok(await downloadButton.isDisabled());
  await (await field("代码")).fill("恢复正常");
  await ready();
  await (await field("宽度模式")).selectOption("auto");
  await ready();
  await page.reload();
  await ready();
  assert.ok(!(await (await field("代码")).innerText()).includes(marker));
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
  await field("主题");
  const sheet = await page
    .getByRole("dialog", { name: "外观设置", exact: true })
    .boundingBox();
  assert.ok(
    Math.abs(sheet.y + sheet.height - 844) < 2,
    "mobile settings attach to bottom",
  );
  await page.getByRole("button", { name: "关闭外观设置", exact: true }).click();
  assert.deepEqual(errors, []);
  console.log(
    "Code image checks passed: live preview, PNG bytes/dimensions, scaling, alpha, colors, clipboard, limits, privacy and mobile.",
  );
} finally {
  await browser.close();
}
