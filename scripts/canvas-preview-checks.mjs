import assert from "node:assert/strict";
import { expect } from "@playwright/test";
import { canvasTools } from "./canvas-test-utils.mjs";

export async function checkPreviewRecovery(browser, base) {
  const failures = [];
  async function check(name, run) {
    const page = await browser.newPage({ locale: "zh-CN" });
    page.setDefaultTimeout(5000);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      await page.goto(base + "/tools/code-image");
      const tools = canvasTools(page);
      await tools.ready();
      const preview = async () => {
        const panel = await tools.openPopover(
          page.getByRole("button", { name: "复制", exact: true }),
        );
        const opened = page.waitForEvent("popup");
        await panel.getByRole("button", { name: "在新标签页打开" }).click();
        return opened;
      };
      await run(page, tools, preview);
      assert.deepEqual(errors, [], name);
      console.log(`Preview recovery: ${name} passed.`);
    } catch (error) {
      failures.push(new Error(name, { cause: error }));
    } finally {
      await page.context().close();
    }
  }

  await check(
    "first preview completes without animation frames",
    async (page, tools, preview) => {
      await page.evaluate(() => {
        window.requestAnimationFrame = () => 0;
      });
      const popup = await preview();
      await expect(popup.locator("img")).toBeVisible();
      await popup.close();
      await tools.ready();
    },
  );

  await check(
    "font timeout permits a fresh retry",
    async (page, tools, preview) => {
      await page.evaluate(() => {
        const fetch = window.fetch;
        window.__fontRequests = 0;
        window.fetch = (...args) => {
          if (String(args[0]).includes("/fonts/")) {
            window.__fontRequests++;
            if (window.__fontRequests === 1) {
              window.__fontSignal = args[1]?.signal;
              return new Promise(() => {});
            }
          }
          return fetch(...args);
        };
        const setTimeout = window.setTimeout;
        window.__shortTimeout = true;
        window.setTimeout = (fn, ms, ...args) =>
          setTimeout(
            fn,
            window.__shortTimeout && ms === 20000 ? 400 : ms,
            ...args,
          );
      });
      const failed = await preview();
      await expect(failed.getByRole("alert")).toHaveText(
        "PNG 生成超时，请重试或下载 SVG。",
      );
      await failed.close();
      await tools.ready();
      await page.evaluate(() => {
        window.__shortTimeout = false;
      });
      const retried = await preview();
      await expect(retried.locator("img")).toBeVisible();
      assert.equal(
        await page.evaluate(() => window.__fontSignal?.aborted),
        true,
      );
      assert.equal(await page.evaluate(() => window.__fontRequests), 2);
      await retried.close();
    },
  );

  await check(
    "download recovers from a stalled SVG image",
    async (page, tools, preview) => {
      await page.evaluate(() => {
        const src = Object.getOwnPropertyDescriptor(
          HTMLImageElement.prototype,
          "src",
        );
        window.__stallImage = true;
        Object.defineProperty(HTMLImageElement.prototype, "src", {
          ...src,
          set(value) {
            if (window.__stallImage && value.startsWith("data:image/svg"))
              return;
            src.set.call(this, value);
          },
        });
        const setTimeout = window.setTimeout;
        window.setTimeout = (fn, ms, ...args) =>
          setTimeout(
            fn,
            window.__stallImage && ms === 20000 ? 400 : ms,
            ...args,
          );
      });
      const panel = await tools.openPopover(tools.download);
      await panel
        .getByRole("button", { name: "下载 PNG", exact: true })
        .click();
      await expect(
        page.getByRole("status").filter({ hasText: "PNG 生成超时" }),
      ).toBeVisible();
      await expect(tools.download).toBeEnabled();
      await expect(tools.editor).toBeEditable();
      await page.evaluate(() => {
        window.__stallImage = false;
      });
      const retried = await preview();
      await expect(retried.locator("img")).toBeVisible();
      await retried.close();
    },
  );

  async function holdFont(page) {
    await page.evaluate(() => {
      const fetch = window.fetch;
      window.fetch = (...args) => {
        if (!String(args[0]).includes("/fonts/")) return fetch(...args);
        window.__fontSignal = args[1]?.signal;
        return new Promise((resolve) => {
          window.__releaseFont = () => resolve(fetch(...args));
        });
      };
    });
  }

  await check(
    "navigation is not overwritten by late rendering",
    async (page, tools, preview) => {
      await page.context().route("**/preview-navigation-check", (route) =>
        route.fulfill({
          contentType: "text/html",
          body: "<h1>Keep this page</h1>",
        }),
      );
      await holdFont(page);
      const popup = await preview();
      await page.waitForFunction(() => !!window.__releaseFont);
      await popup.goto(base + "/preview-navigation-check");
      await page.evaluate(() => window.__releaseFont());
      await expect(tools.download).toBeEnabled();
      await expect(popup.getByRole("heading")).toHaveText("Keep this page");
      await expect(popup.locator("img")).toHaveCount(0);
      await popup.close();
    },
  );

  await check(
    "cross-origin navigation cancels without page errors",
    async (page, tools, preview) => {
      await page.context().route("https://preview-check.invalid/**", (route) =>
        route.fulfill({
          contentType: "text/html",
          body: "<h1>Another site</h1>",
        }),
      );
      await holdFont(page);
      const popup = await preview();
      await page.waitForFunction(() => !!window.__releaseFont);
      await popup.goto("https://preview-check.invalid/");
      await page.evaluate(() => window.__releaseFont());
      await expect(tools.download).toBeEnabled();
      await expect(popup.getByRole("heading")).toHaveText("Another site");
      await popup.close();
    },
  );

  await check(
    "a failed PNG is not reused on retry",
    async (page, tools, preview) => {
      await page.evaluate(() => {
        window.__toBlob = HTMLCanvasElement.prototype.toBlob;
        HTMLCanvasElement.prototype.toBlob = function (callback) {
          callback(new Blob(["invalid png"], { type: "image/png" }));
        };
      });
      const failed = await preview();
      await expect(failed.getByRole("alert")).toHaveText(
        "无法绘制图片，请重试。",
      );
      await failed.close();
      await tools.ready();
      await page.evaluate(() => {
        HTMLCanvasElement.prototype.toBlob = window.__toBlob;
      });
      const retried = await preview();
      await expect(retried.locator("img")).toBeVisible();
      await retried.close();
    },
  );

  await check(
    "preview image survives reloading the editor",
    async (page, tools, preview) => {
      const popup = await preview();
      await expect(popup.locator("img")).toBeVisible();
      await page.reload();
      await tools.ready();
      assert.equal(
        await popup.evaluate(async () => {
          const response = await fetch(document.querySelector("img").src);
          return response.ok && (await response.blob()).type === "image/png";
        }),
        true,
      );
      await popup.close();
    },
  );

  await check(
    "reloading the editor closes a pending preview",
    async (page, tools, preview) => {
      await holdFont(page);
      const popup = await preview();
      await page.waitForFunction(() => !!window.__releaseFont);
      const closed = popup.waitForEvent("close");
      await page.reload();
      await closed;
      await tools.ready();
    },
  );

  await check(
    "closing the preview releases the editor",
    async (page, tools, preview) => {
      await holdFont(page);
      const popup = await preview();
      await page.waitForFunction(() => !!window.__releaseFont);
      await popup.close();
      await expect(tools.download).toBeEnabled();
      await expect(tools.editor).toBeEditable();
      assert.equal(
        await page.evaluate(() => window.__fontSignal?.aborted),
        true,
      );
      await page.evaluate(() => window.__releaseFont());
    },
  );

  if (failures.length)
    throw new AggregateError(failures, "Preview recovery checks failed");
}
