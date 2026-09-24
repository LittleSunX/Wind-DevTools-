import { canvasFonts, type ImageOptions } from "./code-image";
const embeddedFonts = new Map<string, string>();

function abortable<T>(task: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => {
      signal.removeEventListener("abort", abort);
      reject(signal.reason);
    };
    signal.addEventListener("abort", abort, { once: true });
    task.then(
      (value) => {
        signal.removeEventListener("abort", abort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener("abort", abort);
        reject(error);
      },
    );
    if (signal.aborted) abort();
  });
}

async function runExport<T>(
  task: (signal: AbortSignal) => Promise<T>,
  message: string,
  parent?: AbortSignal,
): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort(parent?.reason);
  parent?.addEventListener("abort", abort, { once: true });
  if (parent?.aborted) abort();
  const timer = setTimeout(() => controller.abort(new Error(message)), 20000);
  try {
    controller.signal.throwIfAborted();
    return await abortable(task(controller.signal), controller.signal);
  } finally {
    clearTimeout(timer);
    parent?.removeEventListener("abort", abort);
  }
}

async function fontCSS(id: string, signal: AbortSignal) {
  const font = canvasFonts.find((item) => item.id === id) ?? canvasFonts[0];
  if (!font.file) return "";
  const cached = embeddedFonts.get(font.id);
  if (cached) return cached;
  const response = await fetch(`/fonts/${font.file}`, { signal });
  if (!response.ok) throw new Error("导出字体加载失败，请重试。");
  const data = await blobToDataUrl(await response.blob(), signal);
  signal.throwIfAborted();
  const css = `@font-face { font-family: "${font.family}"; src: url("${data}") format("woff2"); font-weight: 400; font-style: normal; }`;
  // Cache completed data only: an interrupted request must never poison retries.
  embeddedFonts.set(font.id, css);
  return css;
}
async function exportOptions(
  node: HTMLElement,
  options: ImageOptions,
  signal: AbortSignal,
) {
  const embedded = await fontCSS(options.fontFamily, signal);
  const width = node.offsetWidth,
    height = node.offsetHeight;
  // html-to-image reduces copied font sizes by 0.1px in Chromium/WebKit.
  // Restore the actual two typography sizes so that wrapped lines cannot reflow.
  const codeSize = getComputedStyle(node).fontSize;
  const title = node.querySelector<HTMLElement>(".canvas-title");
  const titleSize = title ? getComputedStyle(title).fontSize : "12px";
  const exactTypography = `.canvas-artwork, .canvas-artwork * { font-size: ${codeSize} !important; } .canvas-artwork .canvas-title, .canvas-artwork .canvas-title * { font-size: ${titleSize} !important; }`;
  return {
    width,
    height,
    fontEmbedCSS: embedded + exactTypography,
    skipAutoScale: true,
    filter: (element: HTMLElement) =>
      !(
        element instanceof Element && element.hasAttribute("data-export-ignore")
      ),
    style: { transform: "none", margin: "0", boxShadow: "none" },
  };
}

async function encodePng(
  canvas: HTMLCanvasElement,
  signal: AbortSignal,
): Promise<Blob> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await abortable(
      new Promise<Blob>((resolve, reject) => {
        let settled = false;
        const fallback = () => {
          if (settled || signal.aborted) return;
          settled = true;
          try {
            const dataUrl = canvas.toDataURL("image/png");
            const binary = atob(dataUrl.slice(dataUrl.indexOf(",") + 1));
            const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
            resolve(new Blob([bytes], { type: "image/png" }));
          } catch (error) {
            reject(error);
          }
        };
        // If the native callback stalls, reuse the already-rendered canvas.
        timer = setTimeout(fallback, 5000);
        try {
          canvas.toBlob((blob) => {
            if (settled || signal.aborted) return;
            if (!blob) return fallback();
            settled = true;
            resolve(blob);
          }, "image/png");
        } catch {
          fallback();
        }
      }),
      signal,
    );
  } finally {
    clearTimeout(timer);
  }
}

export function loadExportImage(
  image: HTMLImageElement,
  source: string,
  signal: AbortSignal,
): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      image.onload = null;
      image.onerror = null;
      signal.removeEventListener("abort", abort);
    };
    const abort = () => {
      cleanup();
      image.removeAttribute("src");
      reject(signal.reason);
    };
    image.onload = () => {
      cleanup();
      resolve(image);
    };
    image.onerror = () => {
      cleanup();
      reject(new Error("无法绘制图片，请重试。"));
    };
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
    else image.src = source;
  });
}

export function exportCanvas(
  node: HTMLElement,
  options: ImageOptions,
  signal?: AbortSignal,
): Promise<Blob> {
  return runExport(
    async (signal) => {
      const { toSvg } = await import("html-to-image");
      signal.throwIfAborted();
      const settings = await exportOptions(node, options, signal);
      signal.throwIfAborted();
      const svg = await abortable(toSvg(node, settings), signal);
      // html-to-image's toCanvas waits for requestAnimationFrame. That frame may
      // stop arriving when the preview opens a foreground tab; onload is enough.
      const image = await loadExportImage(new Image(), svg, signal);
      const canvas = document.createElement("canvas");
      try {
        canvas.width = settings.width * options.scale;
        canvas.height = settings.height * options.scale;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("浏览器无法创建图片画布。");
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const blob = await encodePng(canvas, signal);
        if (!blob.size) throw new Error("图片生成失败，请降低导出倍率后重试。");
        return blob;
      } finally {
        image.removeAttribute("src");
        canvas.width = 0;
        canvas.height = 0;
      }
    },
    "PNG 生成超时，请重试或下载 SVG。",
    signal,
  );
}

export function exportCanvasSvg(
  node: HTMLElement,
  options: ImageOptions,
): Promise<string> {
  return runExport(async (signal) => {
    const { toSvg } = await import("html-to-image");
    signal.throwIfAborted();
    const settings = await exportOptions(node, options, signal);
    signal.throwIfAborted();
    return toSvg(node, settings);
  }, "SVG 生成超时，请重试。");
}

export function blobToDataUrl(
  blob: Blob,
  signal?: AbortSignal,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const cleanup = () => {
      signal?.removeEventListener("abort", abort);
      reader.onload = null;
      reader.onerror = null;
    };
    const abort = () => {
      cleanup();
      reader.abort();
      reject(signal?.reason);
    };
    reader.onload = () => {
      cleanup();
      resolve(String(reader.result));
    };
    reader.onerror = () => {
      cleanup();
      reject(new Error("无法读取导出图片。"));
    };
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
    else reader.readAsDataURL(blob);
  });
}

export function dataUrlToBase64(dataUrl: string) {
  const comma = dataUrl.indexOf(",");
  if (comma < 0) throw new Error("图片 Data URL 无效。");
  return dataUrl.slice(comma + 1);
}

export function svgDataUrlToSource(dataUrl: string) {
  const comma = dataUrl.indexOf(",");
  if (comma < 0) throw new Error("SVG 内容无效。");
  const metadata = dataUrl.slice(0, comma);
  const payload = dataUrl.slice(comma + 1);
  try {
    if (metadata.includes(";base64")) {
      const binary = atob(payload);
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    }
    return decodeURIComponent(payload);
  } catch {
    throw new Error("SVG 源码解析失败，请重试。");
  }
}

export async function exportCanvasSvgSource(
  node: HTMLElement,
  options: ImageOptions,
) {
  return svgDataUrlToSource(await exportCanvasSvg(node, options));
}
