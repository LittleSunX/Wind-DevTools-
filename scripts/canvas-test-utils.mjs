import { expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
export function canvasTools(page) {
  const download = page.getByRole("button", { name: "下载 PNG", exact: true });
  const editor = page.getByLabel("代码", { exact: true });
  const artwork = page.locator(".canvas-artwork");
  async function close() {
    await page.evaluate(() =>
      document
        .querySelectorAll(":popover-open")
        .forEach((el) => el.hidePopover()),
    );
  }
  async function field(label) {
    if (["代码", "窗口标题", "画布缩放", "导出倍率", "风格"].includes(label))
      await close();
    else if (
      !(await page
        .getByRole("dialog", { name: "外观设置", exact: true })
        .isVisible())
    )
      await page.getByRole("button", { name: /^外观设置/ }).click();
    return page.getByLabel(label, { exact: true });
  }
  async function ready() {
    await expect(download).toBeEnabled({ timeout: 15000 });
  }
  async function language(id) {
    await close();
    await page.getByRole("button", { name: /^语言 ·/ }).click();
    await page.getByLabel("搜索语言", { exact: true }).fill(id);
    await page.locator(`.shot-language-list button[value="${id}"]`).click();
  }
  async function png(path) {
    await close();
    await ready();
    const pending = page.waitForEvent("download");
    await download.click();
    const file = await pending;
    await file.saveAs(path);
    return { bytes: await readFile(path), name: file.suggestedFilename() };
  }
  async function dimensions() {
    return artwork.evaluate((el) => ({
      w: el.offsetWidth,
      h: el.offsetHeight,
    }));
  }
  return {
    download,
    editor,
    artwork,
    close,
    field,
    ready,
    language,
    png,
    dimensions,
  };
}
export async function comparePixels(page, first, second) {
  return page.evaluate(
    async ({ first, second }) => {
      async function pixels(data) {
        const image = new Image();
        image.src = "data:image/png;base64," + data;
        await image.decode();
        const c = document.createElement("canvas");
        c.width = image.width;
        c.height = image.height;
        const ctx = c.getContext("2d");
        ctx.drawImage(image, 0, 0);
        return {
          w: c.width,
          h: c.height,
          d: ctx.getImageData(0, 0, c.width, c.height).data,
        };
      }
      const a = await pixels(first),
        b = await pixels(second);
      let changed = 0;
      if (a.w !== b.w || a.h !== b.h) return { sameSize: false, ratio: 1 };
      for (let i = 0; i < a.d.length; i += 4)
        if (
          Math.max(
            ...[0, 1, 2, 3].map((k) => Math.abs(a.d[i + k] - b.d[i + k])),
          ) > 30
        )
          changed++;
      return { sameSize: true, ratio: changed / (a.w * a.h) };
    },
    { first: first.toString("base64"), second: second.toString("base64") },
  );
}
export async function pixelAt(page, bytes, x, y) {
  return page.evaluate(
    async ({ data, x, y }) => {
      const image = new Image();
      image.src = "data:image/png;base64," + data;
      await image.decode();
      const c = document.createElement("canvas");
      c.width = image.width;
      c.height = image.height;
      const ctx = c.getContext("2d");
      ctx.drawImage(image, 0, 0);
      return Array.from(ctx.getImageData(x, y, 1, 1).data);
    },
    { data: bytes.toString("base64"), x, y },
  );
}
