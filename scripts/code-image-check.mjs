import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { canvasTools, comparePixels, pixelAt } from "./canvas-test-utils.mjs";
const browser = await chromium.launch({
  channel: process.env.PW_CHANNEL === "bundled" ? undefined : "chrome",
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1200 },
  permissions: ["clipboard-read", "clipboard-write"],
});
const page = await context.newPage();
page.setDefaultTimeout(15000);
const base = process.env.TEST_URL || "http://localhost:4173";
const {
  download,
  editor,
  artwork,
  close,
  field,
  ready,
  openPopover,
  language,
  scale,
  png,
  dimensions,
} = canvasTools(page);
const errors = [],
  requests = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("request", (request) =>
  requests.push(request.url() + " " + (request.postData() || "")),
);
await mkdir("artifacts", { recursive: true });
try {
  await page.goto(base + "/tools/code-image");
  await ready();
  assert.equal(
    await page.locator(".shot-layout, .shot-preview-stage").count(),
    0,
  );
  await scale(1);
  await ready();
  // Use an integer origin for raster comparison; small glyph antialias differences are allowed.
  await page
    .locator(".canvas-frame")
    .evaluate((el) => (el.style.marginLeft = "0"));
  const screenshot = await artwork.screenshot({
    path: "artifacts/canvas-artwork.png",
  });
  const first = await png("artifacts/canvas-artwork-export.png");
  assert.match(first.name, /^wind-code-\d{8}-\d{6}-\d{3}\.png$/);
  const match = await comparePixels(page, screenshot, first.bytes);
  assert.ok(match.sameSize && match.ratio < 0.04, JSON.stringify(match));
  const original = await dimensions();
  await (await field("画布缩放")).selectOption("0.5");
  await ready();
  const zoomed = await png("artifacts/canvas-zoom-export.png");
  assert.ok(
    (await comparePixels(page, first.bytes, zoomed.bytes)).ratio < 0.001,
  );
  await (await field("画布缩放")).selectOption("1");
  await scale(3);
  await ready();
  const scaled = await png("artifacts/canvas-3x.png");
  assert.equal(scaled.bytes.readUInt32BE(16), original.w * 3);
  assert.equal(scaled.bytes.readUInt32BE(20), original.h * 3);
  await scale(1);
  await editor.fill(
    'const 中文 = "👨‍👩‍👧‍👦 <script>alert(1)</script>";\n\tconst token = "PRIVATE_SOURCE_47219";\n',
  );
  await ready();
  assert.equal(await page.locator(".canvas-source-row").count(), 3);
  await editor.focus();
  await editor.press("ControlOrMeta+End");
  await editor.press("Tab");
  await expect(editor).toHaveValue(/\n    $/);
  await editor.press("ControlOrMeta+z");
  await expect(editor).toHaveValue(/;\n$/);
  await editor.press("ControlOrMeta+f");
  await page.getByLabel("查找内容", { exact: true }).fill("中文");
  await page.getByRole("button", { name: "下一个", exact: true }).click();
  assert.equal(
    await editor.evaluate((e) =>
      e.value.slice(e.selectionStart, e.selectionEnd),
    ),
    "中文",
  );
  await page.getByRole("button", { name: "关闭查找", exact: true }).click();
  await (await field("窗口标题")).fill("PRIVATE_TITLE");
  await ready();
  // Export with active selection and active title editing matches the clean artwork.
  const titleExport = await png("artifacts/canvas-title.png");
  await editor.focus();
  await editor.press("ControlOrMeta+a");
  const selectedExport = await png("artifacts/canvas-selected.png");
  assert.ok(
    (await comparePixels(page, titleExport.bytes, selectedExport.bytes)).ratio <
      0.001,
  );
  const sharePanel = await openPopover(
    page.getByRole("button", { name: "复制 / 分享", exact: true }),
  );
  await sharePanel
    .getByRole("button", { name: "复制图片", exact: true })
    .click();
  await page.getByRole("status").filter({ hasText: "图片已复制" }).waitFor();
  assert.ok(
    await page.evaluate(async () =>
      (await navigator.clipboard.read())[0].types.includes("image/png"),
    ),
  );
  await (await field("背景")).selectOption("transparent");
  await ready();
  const transparent = await png("artifacts/canvas-transparent.png");
  assert.equal((await pixelAt(page, transparent.bytes, 0, 0))[3], 0);
  await (await field("背景")).selectOption("solid");
  await (await field("背景颜色")).fill("#ff0000");
  await ready();
  assert.deepEqual(
    await pixelAt(page, (await png("artifacts/canvas-solid.png")).bytes, 0, 0),
    [255, 0, 0, 255],
  );
  await (await field("宽度模式")).selectOption("fixed");
  await (await field("画布宽度")).selectOption("640");
  const long =
    'const identifier = "' +
    "中文 👨‍👩‍👧‍👦 longIdentifier ".repeat(12) +
    '";\n\treturn identifier;';
  await close();
  await editor.fill(long);
  await ready();
  assert.equal((await dimensions()).w, 640);
  assert.equal(await editor.inputValue(), long);
  const geometry = await editor.evaluate((e) => ({
    height: e.clientHeight,
    scroll: e.scrollHeight,
  }));
  assert.ok(
    Math.abs(geometry.height - geometry.scroll) <= 1,
    JSON.stringify(geometry),
  );
  await (await field("长行自动换行")).uncheck();
  await expect(download).toBeDisabled();
  await page.getByRole("alert").filter({ hasText: "超出指定宽度" }).waitFor();
  await (await field("长行自动换行")).check();
  await ready();
  await (await field("画布宽度")).selectOption("custom");
  for (const value of ["", "319", "2401", "640.5"]) {
    await (await field("自定义宽度")).fill(value);
    await expect(download).toBeDisabled();
    await page.getByRole("alert").filter({ hasText: "320–2400" }).waitFor();
  }
  await (await field("自定义宽度")).fill("800");
  await ready();
  await (await field("字体")).selectOption("source");
  await ready();
  assert.ok(
    await page.evaluate(() =>
      document.fonts.check('18px "Wind Source Code Pro"'),
    ),
  );
  await (await field("行高")).selectOption("1.4");
  await ready();
  const compact = (await dimensions()).h;
  await (await field("行高")).selectOption("1.9");
  await ready();
  assert.ok((await dimensions()).h > compact);
  await close();
  await editor.fill(
    Array.from({ length: 100 }, (_, i) => `const line${i} = "中文 ${i}";`).join(
      "\n",
    ),
  );
  await ready();
  assert.equal(await page.locator(".canvas-source-row").count(), 100);
  assert.ok((await dimensions()).h > 3000);
  const tall = await png("artifacts/canvas-long.png");
  assert.equal(tall.bytes.readUInt32BE(20), (await dimensions()).h);
  await editor.fill("x".repeat(12001));
  await page.getByRole("alert").filter({ hasText: "12,000" }).waitFor();
  await expect(download).toBeDisabled();
  await editor.fill("x\n".repeat(161));
  await page.getByRole("alert").filter({ hasText: "160 行" }).waitFor();
  await editor.fill("");
  await expect(download).toBeDisabled();
  await page.getByRole("button", { name: "加载示例", exact: true }).click();
  await ready();
  const before = await editor.inputValue();
  await language("java");
  await ready();
  assert.equal(await editor.inputValue(), before);
  await page.getByRole("button", { name: "加载示例", exact: true }).click();
  await page.getByRole("button", { name: "取消", exact: true }).click();
  assert.equal(await editor.inputValue(), before);
  await page.getByRole("button", { name: "加载示例", exact: true }).click();
  await page.getByRole("button", { name: "替换", exact: true }).click();
  await ready();
  assert.match(await editor.inputValue(), /public class Welcome/);
  assert.ok(
    requests.every(
      (request) => request.startsWith(base) && !request.includes("PRIVATE_"),
    ),
  );
  assert.ok(
    !(await page.evaluate(() =>
      JSON.stringify({ ...localStorage, ...sessionStorage }).includes(
        "PRIVATE_",
      ),
    )),
  );
  await page.reload();
  await ready();
  assert.equal(await (await field("字体")).inputValue(), "source");
  assert.equal(await (await field("行高")).inputValue(), "1.9");
  assert.notEqual(
    await (await field("窗口标题")).inputValue(),
    "PRIVATE_TITLE",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await (await field("画布缩放")).selectOption("fit");
  await ready();
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.screenshot({
    path: "artifacts/canvas-mobile.png",
    fullPage: true,
  });
  await field("主题");
  const sheet = await page
    .getByRole("dialog", { name: "外观设置", exact: true })
    .boundingBox();
  assert.ok(Math.abs(sheet.y + sheet.height - 844) < 2);
  const failed = await context.newPage();
  await failed.route("**/fonts/*.woff2", (route) => route.abort());
  await failed.goto(base + "/tools/code-image");
  await failed.getByRole("alert").filter({ hasText: "字体加载失败" }).waitFor();
  await failed.getByRole("button", { name: /^外观设置/ }).click();
  await failed.getByLabel("字体", { exact: true }).selectOption("system");
  await expect(
    failed.getByRole("button", { name: "导出", exact: true }),
  ).toBeEnabled();
  await failed.close();
  assert.deepEqual(errors, []);
  console.log(
    "Canvas checks passed: DOM/PNG parity, zoom, scale, input/undo/find, selection exclusion, clipboard, wrapping, long export, privacy and mobile.",
  );
} catch (error) {
  await page
    .screenshot({ path: "artifacts/canvas-failure.png", fullPage: true })
    .catch(() => {});
  throw error;
} finally {
  await browser.close();
}
