import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import CanvasSettings from "./CanvasSettings";
import CanvasPopover from "./CanvasPopover";
import CanvasCode from "./CanvasCode";
import { loadCanvasFont } from "../utils/canvas-fonts";
import {
  blobToDataUrl,
  dataUrlToBase64,
  exportCanvas,
  exportCanvasSvg,
  exportCanvasSvgSource,
} from "../utils/canvas-export";
import { readPreferences, writePreferences } from "../utils/canvas-preferences";
import { readCanvasTransfer } from "../utils/canvas-transfer";
import { sampleForLanguage } from "../utils/code-samples";
import { trackTool } from "../analytics";
import {
  canvasFont,
  defaults,
  themes,
  imagePresets,
  imageFilename,
  sampleCode,
  validateCode,
  languages,
  languageGroups,
  parseHighlightedLines,
  aspectRatioValue,
  type ImageOptions,
  type Segment,
} from "../utils/code-image";

export default function CodeImage() {
  const [code, setCode] = useState(sampleCode);
  const [language, setLanguage] = useState("typescript");
  const [options, setOptions] = useState<ImageOptions>(defaults);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [tokens, setTokens] = useState<{
    code: string;
    language: string;
    segments: Segment[];
  } | null>(null);
  const [highlightError, setHighlightError] = useState("");
  const [fontError, setFontError] = useState("");
  const [fontReady, setFontReady] = useState("");
  const [notice, setNotice] = useState("");
  const [exporting, setExporting] = useState(false);
  const [replace, setReplace] = useState(false);
  const [languageSearch, setLanguageSearch] = useState("");
  const [zoom, setZoom] = useState("1");
  const [draggingFile, setDraggingFile] = useState(false);
  const settingsTrigger = useRef<HTMLButtonElement>(null);
  const artwork = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [available, setAvailable] = useState(1000);
  const [autoWidth, setAutoWidth] = useState(720);
  const [size, setSize] = useState({
    width: 0,
    height: 0,
    overflow: false,
    code: "",
    options: defaults,
  });
  const theme = themes[options.theme] || themes.night;
  const highlighted = tokens?.code === code && tokens.language === language;
  const segments = highlighted ? tokens.segments : [{ text: code, type: "" }];
  const lineCount = code ? code.split(/\r\n|\r|\n/).length : 1;
  const highlightedLines = parseHighlightedLines(
    options.highlightLines,
    options.startLine,
    lineCount,
  );
  useEffect(() => {
    let nextOptions = { ...defaults };
    try {
      nextOptions = readPreferences(localStorage);
    } catch {
      /* Optional storage. */
    }
    try {
      const transfer = readCanvasTransfer(sessionStorage);
      if (transfer) {
        setCode(transfer.code);
        setLanguage(transfer.language);
        nextOptions = { ...nextOptions, title: transfer.title };
        setNotice("已接收其他工具的处理结果，可以直接调整样式并导出。");
      }
    } catch {
      /* Optional storage. */
    }
    setOptions(nextOptions);
    setPreferencesLoaded(true);
  }, []);
  useEffect(() => {
    if (preferencesLoaded) {
      try {
        writePreferences(localStorage, options);
      } catch {
        /* Optional storage. */
      }
    }
  }, [options, preferencesLoaded]);
  useEffect(() => {
    let cancelled = false;
    setFontReady("");
    setFontError("");
    loadCanvasFont(options.fontFamily)
      .then(() => {
        if (!cancelled) setFontReady(options.fontFamily);
      })
      .catch((error) => {
        if (!cancelled) setFontError(error.message);
      });
    return () => {
      cancelled = true;
    };
  }, [options.fontFamily]);
  useEffect(() => {
    if (!stage.current) return;
    const observer = new ResizeObserver((entries) =>
      setAvailable(entries[0].contentRect.width),
    );
    observer.observe(stage.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    setHighlightError("");
    let worker: Worker | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      validateCode(code);
    } catch {
      return;
    }
    const debounce = setTimeout(() => {
      try {
        worker = new Worker(
          new URL("../code-image.worker.ts", import.meta.url),
          { type: "module" },
        );
        worker.onmessage = (event) => {
          clearTimeout(timeout);
          worker?.terminate();
          if (event.data.error) setHighlightError(event.data.error);
          else setTokens({ code, language, segments: event.data.segments });
        };
        worker.onerror = () => {
          clearTimeout(timeout);
          worker?.terminate();
          setHighlightError("语法高亮失败，请尝试纯文本模式。");
        };
        worker.postMessage({ code, language });
        timeout = setTimeout(() => {
          worker?.terminate();
          setHighlightError("高亮超过 3 秒，请精简代码或使用纯文本模式。");
        }, 3000);
      } catch {
        setHighlightError("无法启动语法高亮，请检查浏览器设置。");
      }
    }, 120);
    return () => {
      clearTimeout(debounce);
      clearTimeout(timeout);
      worker?.terminate();
    };
  }, [code, language]);
  useLayoutEffect(() => {
    const node = artwork.current;
    if (!node) return;
    const measure = () => {
      const source = node.querySelector<HTMLElement>(".canvas-highlight");
      const ruler = node.querySelector<HTMLElement>(".canvas-ruler");
      const gutter = node.querySelector<HTMLElement>(".canvas-line-number");
      if (ruler)
        setAutoWidth(
          Math.max(
            420,
            ruler.offsetWidth +
              1 +
              (options.lineNumbers ? (gutter?.offsetWidth || 0) + 24 : 0) +
              options.codePadding * 2,
          ) +
            options.padding * 2,
        );
      setSize({
        width: node.offsetWidth,
        height: node.offsetHeight,
        overflow:
          !!source &&
          source.scrollWidth > (source.parentElement?.clientWidth || 0) + 1,
        code,
        options,
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [code, options, fontReady, tokens]);
  let validation = "";
  try {
    validateCode(code);
  } catch (error) {
    validation = (error as Error).message;
  }
  if (
    options.widthMode === "fixed" &&
    (!Number.isInteger(options.width) ||
      options.width < 320 ||
      options.width > 2400)
  )
    validation = "画布宽度请输入 320–2400 之间的整数（px）。";
  else if (!validation && size.width > 2400)
    validation = "单行代码太长，请指定宽度并开启长行换行，或缩小字号。";
  else if (
    !validation &&
    options.widthMode === "fixed" &&
    !options.wrap &&
    size.overflow
  )
    validation = "代码超出指定宽度，请开启长行自动换行或增加宽度。";
  if (
    !validation &&
    (size.width * size.height * options.scale ** 2 > 16000000 ||
      size.height * options.scale > 12000)
  )
    validation = "图片尺寸过大，请减少代码、字号、行高或导出倍率。";
  const error = validation || fontError || highlightError;
  const canExport =
    !error &&
    highlighted &&
    fontReady === options.fontFamily &&
    size.code === code &&
    size.options === options &&
    size.width > 0 &&
    (options.widthMode === "fixed" || size.width === autoWidth);
  const displayScale =
    zoom === "fit"
      ? Math.min(1, Math.max(0.1, (available - 48) / (size.width || 1)))
      : Number(zoom);
  const background =
    options.background === "transparent"
      ? "transparent"
      : options.background === "solid"
        ? options.color
        : options.background === "custom-gradient"
          ? `linear-gradient(${options.gradientAngle}deg, ${options.gradientStart}, ${options.gradientEnd})`
          : options.background === "sunset"
            ? "linear-gradient(135deg, #f4b8a5, #ba9cdf)"
            : options.background === "slate"
              ? "linear-gradient(135deg, #dce3ef, #a8b8d0)"
              : "linear-gradient(135deg, #8ea9ef, #b8a2e6)";
  function update<K extends keyof ImageOptions>(
    key: K,
    value: ImageOptions[K],
  ) {
    setNotice("");
    setOptions((previous) => ({ ...previous, [key]: value }));
  }
  function changeCode(value: string) {
    setCode(value);
    setReplace(false);
    setNotice("");
  }
  async function importFile(file: File) {
    setDraggingFile(false);
    if (file.size > 256 * 1024) {
      setNotice("文件过大，请选择 256 KB 以内的代码文件。");
      return;
    }
    try {
      const text = await file.text();
      validateCode(text);
      const ext = file.name.split(".").pop()?.toLowerCase() || "";
      const byExtension: Record<string, string> = {
        ts: "typescript",
        js: "javascript",
        jsx: "jsx",
        tsx: "tsx",
        html: "markup",
        htm: "markup",
        css: "css",
        vue: "vue",
        java: "java",
        py: "python",
        go: "go",
        rs: "rust",
        c: "c",
        h: "c",
        cpp: "cpp",
        cc: "cpp",
        cs: "csharp",
        php: "php",
        rb: "ruby",
        kt: "kotlin",
        swift: "swift",
        sh: "bash",
        ps1: "powershell",
        json: "json",
        yaml: "yaml",
        yml: "yaml",
        toml: "toml",
        xml: "xml",
        md: "markdown",
        sql: "sql",
      };
      changeCode(text);
      if (byExtension[ext]) setLanguage(byExtension[ext]);
      setOptions((previous) => ({ ...previous, title: file.name.slice(0, 80) }));
      setNotice(`已导入 ${file.name}，内容仅在浏览器中读取。`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "文件读取失败，请重试。");
    }
  }
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
      const blob = await exportCanvas(artwork.current, options);
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
        mode === "data-url"
          ? "PNG Data URL 已复制。"
          : "PNG Base64 已复制。",
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
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice("PNG 已生成。");
      trackTool("code-image", "export", "success");
    } catch (error) {
      trackTool("code-image", "export", "error");
      setNotice(error instanceof Error ? error.message : "PNG 导出失败，请重试。");
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
      link.click();
      setNotice("SVG 已生成。");
      trackTool("code-image", "export_svg", "success");
    } catch (error) {
      trackTool("code-image", "export_svg", "error");
      setNotice(error instanceof Error ? error.message : "SVG 导出失败，请重试。");
    } finally {
      setExporting(false);
    }
  }

  const select = (
    label: string,
    value: string,
    items: string[][],
    change: (v: string) => void,
  ) => (
    <label className="shot-field">
      {label}
      <select
        aria-label={label}
        value={value}
        onChange={(e) => change(e.target.value)}
        disabled={exporting}
      >
        {items.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <>
      <div className="breadcrumb">
        <a href="/tools">工具箱</a>
        <span>/</span>代码画布
      </div>
      <section className="tool-heading canvas-heading">
        <div>
          <div className="eyebrow">创作与分享 / CODE CANVAS</div>
          <h1>代码画布</h1>
          <p>直接在画布中写下代码，把眼前的作品带走。</p>
        </div>
        <span className="shot-badge">LOCAL · PNG / SVG</span>
      </section>
      <div className="shot-toolbar canvas-toolbar" aria-label="画布工具栏">
        <CanvasPopover
          label={`语言 · ${languages.find(([id]) => id === language)?.[1]}`}
          title="选择语言"
          disabled={exporting}
        >
          <div className="shot-language-search">
            <input
              type="search"
              aria-label="搜索语言"
              placeholder="搜索语言，例如 Java、TSX"
              value={languageSearch}
              onChange={(e) => setLanguageSearch(e.target.value)}
            />
          </div>
          <div className="shot-language-list">
            {languageGroups.map((group) => {
              const items = group.items.filter(([id, name]) =>
                `${id} ${name}`
                  .toLowerCase()
                  .includes(languageSearch.trim().toLowerCase()),
              );
              return items.length ? (
                <div key={group.label}>
                  <h3>{group.label}</h3>
                  {items.map(([id, name]) => (
                    <button
                      key={id}
                      value={id}
                      aria-pressed={language === id}
                      onClick={(e) => {
                        setLanguage(id);
                        setLanguageSearch("");
                        e.currentTarget
                          .closest<HTMLElement>("[popover]")
                          ?.hidePopover();
                      }}
                    >
                      {name}
                      {language === id && <span aria-hidden="true"> ✓</span>}
                    </button>
                  ))}
                </div>
              ) : null;
            })}
            {!languages.some(([id, name]) =>
              `${id} ${name}`
                .toLowerCase()
                .includes(languageSearch.trim().toLowerCase()),
            ) && <p>未找到匹配语言。</p>}
          </div>
        </CanvasPopover>
        {select(
          "风格",
          imagePresets.find(
            (p) =>
              p.theme === options.theme &&
              p.background === options.background &&
              p.padding === options.padding &&
              p.fontSize === options.fontSize &&
              p.fontFamily === options.fontFamily &&
              p.lineHeight === options.lineHeight &&
              p.codePadding === options.codePadding &&
              p.lineNumbers === options.lineNumbers &&
              p.windowStyle === options.windowStyle &&
              p.windowRadius === options.windowRadius &&
              p.shadow === options.shadow &&
              p.aspectRatio === options.aspectRatio &&
              (!("color" in p) || p.color === options.color),
          )?.name || "custom",
          [["custom", "自定义"], ...imagePresets.map((p) => [p.name, p.name])],
          (name) => {
            if (name === "custom") {
              requestAnimationFrame(() => settingsTrigger.current?.click());
              return;
            }
            const preset = imagePresets.find((p) => p.name === name);
            if (!preset) return;
            setNotice("");
            setOptions((o) => ({
              ...o,
              theme: preset.theme,
              background: preset.background,
              padding: preset.padding,
              fontSize: preset.fontSize,
              fontFamily: preset.fontFamily,
              lineHeight: preset.lineHeight,
              codePadding: preset.codePadding,
              lineNumbers: preset.lineNumbers,
              windowStyle: preset.windowStyle,
              windowRadius: preset.windowRadius,
              shadow: preset.shadow,
              aspectRatio: preset.aspectRatio,
              windowBar: preset.windowStyle !== "none",
              ...("color" in preset ? { color: preset.color } : {}),
            }));
          },
        )}
        <CanvasPopover
          alignEnd
          triggerRef={settingsTrigger}
          label="外观设置"
          title="外观设置"
          disabled={exporting}
        >
          <CanvasSettings
            options={options}
            update={update}
            exporting={exporting}
            onReset={() => {
              setOptions({ ...defaults, title: options.title });
            }}
          />
        </CanvasPopover>

        <div className="canvas-export-actions">
          <CanvasPopover
            alignEnd
            label="复制 / 分享"
            title="复制 / 分享"
            disabled={!canExport || exporting}
          >
            <div className="canvas-action-menu">
              <button
                type="button"
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
                onClick={(event) => {
                  hideActionMenu(event.currentTarget);
                  void copyPngText("base64");
                }}
              >
                <span>复制 PNG Base64</span>
                <small>纯 Base64</small>
              </button>
              <button
                type="button"
                onClick={(event) => {
                  hideActionMenu(event.currentTarget);
                  void openPngPreview();
                }}
              >
                <span>在新标签页打开</span>
                <small>PNG 预览</small>
              </button>
            </div>
          </CanvasPopover>

          <CanvasPopover
            alignEnd
            label={exporting ? "正在导出…" : "导出"}
            title="导出"
            disabled={!canExport || exporting}
          >
            <div className="canvas-export-menu">
              <div className="canvas-export-scale" role="group" aria-label="PNG 导出倍率">
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
                  onClick={(event) => {
                    hideActionMenu(event.currentTarget);
                    void downloadSvg();
                  }}
                >
                  <span>下载 SVG</span>
                  <small>矢量 · 不受倍率影响</small>
                </button>
              </div>
            </div>
          </CanvasPopover>
        </div>
      </div>
      <div className="canvas-utility">
        <span id="canvas-help">
          点击代码直接编辑 · Tab 缩进 · Esc 后 Tab 离开 · Ctrl / ⌘ + F 查找
        </span>
        <button
          disabled={exporting}
          onClick={() =>
            code ? setReplace(true) : changeCode(sampleForLanguage(language))
          }
        >
          加载示例
        </button>
        <button disabled={exporting} onClick={() => changeCode("")}>
          清空
        </button>
        <label className="canvas-file-import">
          导入文件
          <input
            type="file"
            disabled={exporting}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importFile(file);
              event.currentTarget.value = "";
            }}
          />
        </label>
      </div>
      {replace && (
        <div className="replace-prompt">
          用当前语言的示例替换代码？
          <button onClick={() => changeCode(sampleForLanguage(language))}>
            替换
          </button>
          <button onClick={() => setReplace(false)}>取消</button>
        </div>
      )}
      <div
        className={`canvas-stage ${options.background === "transparent" ? "is-transparent" : ""} ${draggingFile ? "is-dragging" : ""}`}
        ref={stage}
        aria-label="画布工作区"
        aria-busy={exporting}
        onDragEnter={(event) => {
          event.preventDefault();
          if (!exporting) setDraggingFile(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          if (!exporting) event.dataTransfer.dropEffect = "copy";
        }}
        onDragLeave={(event) => {
          if (event.currentTarget === event.target) setDraggingFile(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          if (exporting) return;
          const file = event.dataTransfer.files[0];
          if (file) void importFile(file);
          else setDraggingFile(false);
        }}
      >
        <div
          className="canvas-frame"
          style={{
            width: size.width ? size.width * displayScale : undefined,
            height: size.height ? size.height * displayScale : undefined,
          }}
        >
          <div
            className="canvas-artwork"
            ref={artwork}
            style={
              {
                padding: options.padding,
                width:
                  options.widthMode === "fixed" &&
                  Number.isFinite(options.width)
                    ? Math.max(320, Math.min(2400, options.width))
                    : autoWidth,
                background,
                aspectRatio: aspectRatioValue(options.aspectRatio),
                transform: `scale(${displayScale})`,
                font: canvasFont(options),
                fontVariantLigatures: "none",
                lineHeight: `${Math.ceil(options.fontSize * options.lineHeight)}px`,
                color: theme.text,
              } as CSSProperties
            }
          >
            <div
              className="canvas-measure"
              data-export-ignore
              aria-hidden="true"
            >
              <span className="canvas-ruler">{code || " "}</span>
            </div>
            <div
              className="canvas-window"
              style={{
                background: theme.bg,
                minWidth: options.widthMode === "fixed" ? 0 : 420,
                borderRadius: options.windowRadius,
                boxShadow:
                  options.shadow === "none"
                    ? "none"
                    : options.shadow === "strong"
                      ? "0 18px 42px #17203a55"
                      : "0 10px 24px #17203a33",
                overflow: "hidden",
              }}
            >
              {options.windowBar && options.windowStyle !== "none" && (
                <div className={`canvas-windowbar style-${options.windowStyle}`}>
                  {options.windowStyle === "mac" && (
                    <div className="canvas-window-dots" aria-hidden="true">
                      <span />
                      <span />
                      <span />
                    </div>
                  )}
                  {options.windowStyle === "minimal" && (
                    <div className="canvas-window-minimal" aria-hidden="true">•••</div>
                  )}
                  <div className="canvas-title" style={{ color: theme.muted }}>
                    <span aria-hidden="true">{options.title || "\u00a0"}</span>
                    <input
                      data-export-ignore
                      aria-label="窗口标题"
                      placeholder="添加标题…"
                      value={options.title}
                      maxLength={80}
                      disabled={exporting}
                      onChange={(event) => update("title", event.target.value)}
                    />
                  </div>
                </div>
              )}
              <div
                className="canvas-code-padding"
                style={{ padding: options.codePadding }}
              >
                <CanvasCode
                  code={code}
                  segments={segments}
                  colors={theme.colors}
                  muted={theme.muted}
                  lineNumbers={options.lineNumbers}
                  startLine={options.startLine}
                  highlightedLines={highlightedLines}
                  wrap={options.widthMode === "fixed" && options.wrap}
                  readOnly={exporting}
                  onChange={changeCode}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="canvas-statusbar">
        <span>{code.length.toLocaleString()} / 12,000 字符</span>
        <span>
          {size.width * options.scale} × {size.height * options.scale} px
        </span>
        <label>
          画布缩放
          <select
            aria-label="画布缩放"
            value={zoom}
            onChange={(event) => setZoom(event.target.value)}
          >
            <option value="fit">适应宽度</option>
            <option value="0.5">50%</option>
            <option value="0.75">75%</option>
            <option value="1">100%</option>
            <option value="1.5">150%</option>
          </select>
        </label>
      </div>
      {error && (
        <div className="error-box" role="alert">
          {error}
        </div>
      )}
      <div className="notice" role="status">
        {notice || (!error && !canExport ? "正在准备字体与高亮…" : "")}
      </div>
      <section className="instructions canvas-instructions">
        <details>
          <summary>使用说明 · 编辑与导出</summary>
          <p>
            在画布上直接输入代码、修改标题。可自定义渐变背景、窗口样式、画布比例、起始行号和高亮行；缩放只影响查看比例，导出使用实际尺寸。PNG / SVG 不包含光标、选区和操作控件。支持 28 种语言与格式，以及 1× / 2× / 3× PNG 导出。中文和未覆盖字符使用系统字体回退。
          </p>
          <p>
            所有内容在浏览器内处理，不执行或上传代码。仅记住外观设置，不保存代码或标题。最多支持
            12,000 字符、160 行和 1600
            万导出像素；长行可在外观设置中指定宽度并自动换行。
          </p>
        </details>
      </section>
    </>
  );
}
