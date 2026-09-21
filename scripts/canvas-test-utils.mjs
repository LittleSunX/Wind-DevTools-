import { expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
export function canvasTools(page) {
  const download = page.getByRole("button", { name: "导出", exact: true });
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
    if (["代码", "窗口标题", "画布缩放", "风格"].includes(label)) await close();
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
  async function openPopover(trigger) {
    await close();
    const id = await trigger.evaluate((element) => {
      const target =
        element.popoverTargetElement ||
        document.getElementById(element.getAttribute("popovertarget"));
      if (!target) throw new Error("popover target not found");
      if (!target.matches(":popover-open")) target.showPopover();
      return target.id;
    });
    const panel = page.locator(`[id="${id}"]`);
    await expect(panel).toBeVisible();
    return panel;
  }
  async function language(id) {
    await close();
    await page.getByRole("button", { name: /^语言 ·/ }).click();
    await page.getByLabel("搜索语言", { exact: true }).fill(id);
    await page.locator(`.shot-language-list button[value="${id}"]`).click();
  }
  async function scale(value) {
    await ready();
    const panel = await openPopover(download);
    await panel.getByRole("button", { name: `${value}×`, exact: true }).click();
    await close();
  }
  async function png(path) {
    await close();
    await ready();
    await page.evaluate(() => {
      if (!window.__windDownloadCaptureInstalled) {
        const original = HTMLAnchorElement.prototype.click;
        HTMLAnchorElement.prototype.click = function () {
          if (this.download && this.href.startsWith("blob:")) {
            const href = this.href;
            const name = this.download;
            window.__windCapturedDownload = fetch(href).then(
              async (response) => {
                const bytes = new Uint8Array(await response.arrayBuffer());
                let binary = "";
                const chunk = 0x8000;
                for (let i = 0; i < bytes.length; i += chunk)
                  binary += String.fromCharCode(
                    ...bytes.subarray(i, i + chunk),
                  );
                return { name, base64: btoa(binary) };
              },
            );
          }
          return original.call(this);
        };
        window.__windDownloadCaptureInstalled = true;
      }
      window.__windCapturedDownload = null;
    });
    const panel = await openPopover(download);
    await panel.getByRole("button", { name: "下载 PNG", exact: true }).click();
    await expect
      .poll(() => page.evaluate(() => Boolean(window.__windCapturedDownload)))
      .toBe(true);
    const captured = await page.evaluate(() => window.__windCapturedDownload);
    const bytes = Buffer.from(captured.base64, "base64");
    await writeFile(path, bytes);
    return { bytes, name: captured.name };
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
    openPopover,
    language,
    scale,
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
