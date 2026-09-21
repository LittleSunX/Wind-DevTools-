import type { RefObject } from "react";
import CanvasPopover from "./CanvasPopover";
import {
  blobToDataUrl,
  dataUrlToBase64,
  exportCanvas,
  exportCanvasSvg,
  exportCanvasSvgSource,
} from "../utils/canvas-export";
import { imageFilename, type ImageOptions } from "../utils/code-image";
import { trackTool } from "../analytics";

type Props = {
  artwork: RefObject<HTMLDivElement | null>;
  options: ImageOptions;
  canExport: boolean;
  exporting: boolean;
  setExporting: (value: boolean) => void;
  setNotice: (value: string) => void;
  update: <K extends keyof ImageOptions>(
    key: K,
    value: ImageOptions[K],
  ) => void;
};

export default function CanvasActions({
  artwork,
  options,
  canExport,
  exporting,
  setExporting,
  setNotice,
  update,
}: Props) {
  function hideActionMenu(target: HTMLElement) {
    target.closest<HTMLElement>("[popover]")?.hidePopover();
  }

  async function copyImage() {
    if (!canExport || !artwork.current || exporting) return;
    setExporting(true);
    setNotice("");
    try {
      if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined")
        throw new Error("当前浏览器不支持复制图片，请下载 PNG。");
      const blob = exportCanvas(artwork.current, options);
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      setNotice("图片已复制，可以粘贴到支持图片的应用。");
      trackTool("code-image", "copy_image", "success");
    } catch {
      trackTool("code-image", "copy_image", "error");
      setNotice("复制失败或未获剪贴板权限，请使用「下载 PNG」。");
    } finally {
      setExporting(false);
    }
  }

  async function copySvgSource() {
    if (!canExport || !artwork.current || exporting) return;
    setExporting(true);
    setNotice("");
    try {
      const source = await exportCanvasSvgSource(artwork.current, options);
      await navigator.clipboard.writeText(source);
      setNotice("SVG 源码已复制。");
      trackTool("code-image", "copy_svg", "success");
    } catch (error) {
      trackTool("code-image", "copy_svg", "error");
      setNotice(
        error instanceof Error ? error.message : "SVG 源码复制失败，请重试。",
      );
    } finally {
      setExporting(false);
    }
  }

  async function copyPngText(mode: "data-url" | "base64") {
    if (!canExport || !artwork.current || exporting) return;
    setExporting(true);
    setNotice("");
    const action = mode === "data-url" ? "copy_data_url" : "copy_base64";
    try {
      const blob = await exportCanvas(artwork.current, options);
      const dataUrl = await blobToDataUrl(blob);
      await navigator.clipboard.writeText(
        mode === "data-url" ? dataUrl : dataUrlToBase64(dataUrl),
      );
      setNotice(
        mode === "data-url" ? "PNG Data URL 已复制。" : "PNG Base64 已复制。",
      );
      trackTool("code-image", action, "success");
    } catch (error) {
      trackTool("code-image", action, "error");
      setNotice(
        error instanceof Error ? error.message : "复制失败，请检查剪贴板权限。",
      );
    } finally {
      setExporting(false);
    }
  }

  async function openPngPreview() {
    if (!canExport || !artwork.current || exporting) return;
    const preview = window.open("", "_blank");
    if (!preview) {
      setNotice("新标签页被浏览器拦截，请允许弹出窗口后重试。");
      trackTool("code-image", "open_image", "error");
      return;
    }
    preview.opener = null;
    setExporting(true);
    setNotice("");
    try {
      const blob = await exportCanvas(artwork.current, options);
      const url = URL.createObjectURL(blob);
      preview.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      setNotice("已在新标签页打开 PNG。");
      trackTool("code-image", "open_image", "success");
    } catch (error) {
      preview.close();
      trackTool("code-image", "open_image", "error");
      setNotice(
        error instanceof Error ? error.message : "无法打开图片，请重试。",
      );
    } finally {
      setExporting(false);
    }
  }

  async function downloadPng() {
    if (!canExport || !artwork.current || exporting) return;
    setExporting(true);
    setNotice("");
    try {
      const blob = await exportCanvas(artwork.current, options);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = imageFilename();
      link.style.display = "none";
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice("PNG 已生成。");
      trackTool("code-image", "export", "success");
    } catch (error) {
      trackTool("code-image", "export", "error");
      setNotice(
        error instanceof Error ? error.message : "PNG 导出失败，请重试。",
      );
    } finally {
      setExporting(false);
    }
  }

  async function downloadSvg() {
    if (!canExport || !artwork.current || exporting) return;
    setExporting(true);
    setNotice("");
    try {
      const dataUrl = await exportCanvasSvg(artwork.current, options);
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = imageFilename(new Date(), "svg");
      link.style.display = "none";
      document.body.append(link);
      link.click();
      link.remove();
      setNotice("SVG 已生成。");
      trackTool("code-image", "export_svg", "success");
    } catch (error) {
      trackTool("code-image", "export_svg", "error");
      setNotice(
        error instanceof Error ? error.message : "SVG 导出失败，请重试。",
      );
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="canvas-export-actions">
      <CanvasPopover
        alignEnd
        label="复制"
        title="复制"
        disabled={!canExport || exporting}
      >
        <div className="canvas-action-menu">
          <button
            type="button"
            aria-label="复制图片"
            onClick={(event) => {
              hideActionMenu(event.currentTarget);
              void copyImage();
            }}
          >
            <span>复制图片</span>
            <small>PNG</small>
          </button>
          <button
            type="button"
            aria-label="在新标签页打开"
            onClick={(event) => {
              hideActionMenu(event.currentTarget);
              void openPngPreview();
            }}
          >
            <span>在新标签页打开</span>
            <small>PNG 预览</small>
          </button>
          <details className="canvas-advanced-copy">
            <summary>高级复制</summary>
            <button
              type="button"
              aria-label="复制 SVG 源码"
              onClick={(event) => {
                hideActionMenu(event.currentTarget);
                void copySvgSource();
              }}
            >
              <span>复制 SVG 源码</span>
              <small>SVG</small>
            </button>
            <button
              type="button"
              aria-label="复制 PNG Data URL"
              onClick={(event) => {
                hideActionMenu(event.currentTarget);
                void copyPngText("data-url");
              }}
            >
              <span>复制 PNG Data URL</span>
              <small>data:image/png</small>
            </button>
            <button
              type="button"
              aria-label="复制 PNG Base64"
              onClick={(event) => {
                hideActionMenu(event.currentTarget);
                void copyPngText("base64");
              }}
            >
              <span>复制 PNG Base64</span>
              <small>纯 Base64</small>
            </button>
          </details>
        </div>
      </CanvasPopover>

      <CanvasPopover
        alignEnd
        label={exporting ? "正在导出…" : "导出"}
        title="导出"
        disabled={!canExport || exporting}
      >
        <div className="canvas-export-menu">
          <div
            className="canvas-export-scale"
            role="group"
            aria-label="PNG 导出倍率"
          >
            <span>PNG 导出倍率</span>
            <div>
              {[1, 2, 3].map((scale) => (
                <button
                  type="button"
                  key={scale}
                  aria-pressed={options.scale === scale}
                  onClick={() => update("scale", scale)}
                >
                  {scale}×
                </button>
              ))}
            </div>
          </div>
          <div className="canvas-action-menu">
            <button
              type="button"
              aria-label="下载 PNG"
              onClick={(event) => {
                hideActionMenu(event.currentTarget);
                void downloadPng();
              }}
            >
              <span>下载 PNG</span>
              <small>{options.scale}×</small>
            </button>
            <button
              type="button"
              aria-label="下载 SVG"
              onClick={(event) => {
                hideActionMenu(event.currentTarget);
                void downloadSvg();
              }}
            >
              <span>下载 SVG</span>
              <small>SVG · 不受倍率影响</small>
            </button>
          </div>
        </div>
      </CanvasPopover>
    </div>
  );
}
