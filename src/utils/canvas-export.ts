import { canvasFonts, type ImageOptions } from "./code-image";
const embeddedFonts = new Map<string, Promise<string>>();
function fontCSS(id: string) {
  const font = canvasFonts.find((item) => item.id === id) ?? canvasFonts[0];
  if (!font.file) return Promise.resolve("");
  const cached = embeddedFonts.get(font.id);
  if (cached) return cached;
  const pending = fetch(`/fonts/${font.file}`)
    .then(async (response) => {
      if (!response.ok) throw new Error("导出字体加载失败，请重试。");
      const blob = await response.blob();
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("无法读取字体。"));
        reader.readAsDataURL(blob);
      });
      return `@font-face { font-family: "${font.family}"; src: url("${data}") format("woff2"); font-weight: 400; font-style: normal; }`;
    })
    .catch((error) => {
      embeddedFonts.delete(font.id);
      throw error;
    });
  embeddedFonts.set(font.id, pending);
  return pending;
}
async function exportOptions(node: HTMLElement, options: ImageOptions) {
  const embedded = await fontCSS(options.fontFamily);
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

export async function exportCanvas(
  node: HTMLElement,
  options: ImageOptions,
): Promise<Blob> {
  const { toBlob } = await import("html-to-image");
  const blob = await toBlob(node, {
    ...(await exportOptions(node, options)),
    pixelRatio: options.scale,
  });
  if (!blob) throw new Error("图片生成失败，请降低导出倍率后重试。");
  return blob;
}

export async function exportCanvasSvg(
  node: HTMLElement,
  options: ImageOptions,
): Promise<string> {
  const { toSvg } = await import("html-to-image");
  return toSvg(node, {
    ...(await exportOptions(node, options)),
    pixelRatio: 1,
  });
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("无法读取导出图片。"));
    reader.readAsDataURL(blob);
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
