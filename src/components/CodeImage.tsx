import CanvasPopover from "./CanvasPopover";
import CodeEditor from "./CodeEditor";
import { trackTool } from "../analytics";
import { useEffect, useRef, useState } from "react";
import {
  canvasBlob,
  defaults,
  drawCode,
  languages,
  languageGroups,
  imagePresets,
  imageFilename,
  sampleCode,
  validateCode,
  type ImageOptions,
  type Segment,
} from "../utils/code-image";

export default function CodeImage() {
  const [code, setCode] = useState(sampleCode),
    [language, setLanguage] = useState("typescript"),
    [options, setOptions] = useState<ImageOptions>(defaults);
  const [tokens, setTokens] = useState<{
    code: string;
    language: string;
    segments: Segment[];
  } | null>(null);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [ready, setReady] = useState(false),
    [exporting, setExporting] = useState(false),
    [replace, setReplace] = useState(false);
  const [languageSearch, setLanguageSearch] = useState("");
  const [widthChoice, setWidthChoice] = useState("800");
  const [zoom, setZoom] = useState("fit");
  const [size, setSize] = useState({ width: 0, height: 0 });
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    setTokens(null);
    setReady(false);
    setError("");
    setNotice("");
    let worker: Worker | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      validateCode(code);
    } catch (e) {
      setError((e as Error).message);
      return;
    }
    const debounce = setTimeout(() => {
      try {
        worker = new Worker(
          new URL("../code-image.worker.ts", import.meta.url),
          { type: "module" },
        );
        worker.onmessage = (e) => {
          clearTimeout(timeout);
          worker?.terminate();
          if (e.data.error) setError(e.data.error);
          else setTokens({ code, language, segments: e.data.segments });
        };
        worker.onerror = () => {
          clearTimeout(timeout);
          worker?.terminate();
          setError("语法高亮失败，请尝试纯文本模式。");
        };
        worker.postMessage({ code, language });
        timeout = setTimeout(() => {
          worker?.terminate();
          setError("高亮超过 3 秒，已停止。请精简代码或使用纯文本模式。");
        }, 3000);
      } catch {
        setError("无法启动语法高亮，请检查浏览器设置。");
      }
    }, 180);
    return () => {
      clearTimeout(debounce);
      clearTimeout(timeout);
      worker?.terminate();
    };
  }, [code, language]);
  useEffect(() => {
    setReady(false);
    if (
      !tokens ||
      tokens.code !== code ||
      tokens.language !== language ||
      !canvas.current
    )
      return;
    try {
      setSize(drawCode(canvas.current, tokens.segments, options));
      setError("");
      setReady(true);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [tokens, code, language, options]);
  function update<K extends keyof ImageOptions>(
    key: K,
    value: ImageOptions[K],
  ) {
    setReady(false);
    setNotice("");
    setOptions((o) => ({ ...o, [key]: value }));
  }
  function changeCode(value: string) {
    setReady(false);
    setCode(value.replace(/\r\n?/g, "\n"));
    setReplace(false);
  }
  async function exportImage(copy: boolean) {
    if (!ready || !canvas.current) return;
    setExporting(true);
    setNotice("");
    try {
      const blob = canvasBlob(canvas.current);
      if (copy) {
        if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined")
          throw new Error("当前浏览器不支持复制图片，请下载 PNG。");
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": blob }),
        ]);
        setNotice("图片已复制，可以粘贴到支持图片的应用。");
      } else {
        const url = URL.createObjectURL(await blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = imageFilename();
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        setNotice("PNG 已生成。");
      }
      trackTool("code-image", copy ? "copy_image" : "export", "success");
    } catch (e) {
      trackTool("code-image", copy ? "copy_image" : "export", "error");
      setNotice(
        copy
          ? "复制失败或未获剪贴板权限，请使用「下载 PNG」。"
          : e instanceof Error
            ? e.message
            : "导出失败，请重试。",
      );
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
      <section className="tool-heading">
        <div>
          <div className="eyebrow">创作与分享 / CODE IMAGE</div>
          <h1>代码画布</h1>
          <p>把值得分享的代码，变成一张好看的图片。</p>
        </div>
        <span className="shot-badge">PNG · LOCAL</span>
      </section>
      <div className="shot-toolbar" aria-label="画布工具栏">
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
                        setReady(false);
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
              p.fontSize === options.fontSize,
          )?.name || "custom",
          [["custom", "自定义"], ...imagePresets.map((p) => [p.name, p.name])],
          (name) => {
            const preset = imagePresets.find((p) => p.name === name);
            if (!preset) return;
            setReady(false);
            setNotice("");
            setOptions((o) => ({
              ...o,
              theme: preset.theme,
              background: preset.background,
              padding: preset.padding,
              fontSize: preset.fontSize,
            }));
          },
        )}
        <CanvasPopover
          alignEnd
          label="外观设置"
          title="外观设置"
          disabled={exporting}
        >
          <div className="shot-settings">
            {select(
              "宽度模式",
              options.widthMode,
              [
                ["auto", "自动宽度"],
                ["fixed", "指定宽度"],
              ],
              (v) => update("widthMode", v as ImageOptions["widthMode"]),
            )}
            {options.widthMode === "fixed" && (
              <>
                {select(
                  "画布宽度",
                  widthChoice,
                  [
                    ["640", "640 px"],
                    ["800", "800 px"],
                    ["1200", "1200 px"],
                    ["custom", "自定义"],
                  ],
                  (v) => {
                    setWidthChoice(v);
                    if (v !== "custom") update("width", Number(v));
                  },
                )}
                {widthChoice === "custom" && (
                  <label className="shot-field shot-wide">
                    自定义宽度
                    <input
                      type="number"
                      aria-label="自定义宽度"
                      min={320}
                      max={2400}
                      step={1}
                      value={
                        Number.isFinite(options.width) ? options.width : ""
                      }
                      onChange={(e) =>
                        update(
                          "width",
                          e.target.value === "" ? NaN : Number(e.target.value),
                        )
                      }
                      disabled={exporting}
                    />
                  </label>
                )}
                <label className="shot-check shot-wide">
                  <input
                    type="checkbox"
                    checked={options.wrap}
                    onChange={(e) => update("wrap", e.target.checked)}
                    disabled={exporting}
                  />
                  长行自动换行
                </label>
                <p className="shot-setting-help shot-wide">
                  宽度包含外边距，按 1×
                  计算。换行只影响图片，续行不重复显示行号。
                </p>
              </>
            )}

            {select(
              "主题",
              options.theme,
              [
                ["night", "午夜蓝"],
                ["graphite", "石墨黑"],
                ["light", "明亮"],
              ],
              (v) => update("theme", v),
            )}
            {select(
              "背景",
              options.background,
              [
                ["blue", "蓝紫渐变"],
                ["sunset", "日落渐变"],
                ["slate", "雾灰渐变"],
                ["solid", "纯色"],
                ["transparent", "透明"],
              ],
              (v) => update("background", v),
            )}
            {options.background === "solid" ? (
              <label className="shot-field">
                背景颜色
                <input
                  type="color"
                  aria-label="背景颜色"
                  value={options.color}
                  onChange={(e) => update("color", e.target.value)}
                  disabled={exporting}
                />
              </label>
            ) : (
              select(
                "字号",
                String(options.fontSize),
                [
                  ["14", "14 px"],
                  ["16", "16 px"],
                  ["18", "18 px"],
                  ["20", "20 px"],
                  ["24", "24 px"],
                ],
                (v) => update("fontSize", Number(v)),
              )
            )}
            {options.background === "solid" &&
              select(
                "字号",
                String(options.fontSize),
                [
                  ["14", "14 px"],
                  ["16", "16 px"],
                  ["18", "18 px"],
                  ["20", "20 px"],
                  ["24", "24 px"],
                ],
                (v) => update("fontSize", Number(v)),
              )}
            {select(
              "外边距",
              String(options.padding),
              [
                ["16", "16 px"],
                ["32", "32 px"],
                ["48", "48 px"],
                ["64", "64 px"],
              ],
              (v) => update("padding", Number(v)),
            )}
            <label className="shot-field shot-wide">
              窗口标题
              <input
                aria-label="窗口标题"
                maxLength={80}
                value={options.title}
                onChange={(e) => update("title", e.target.value)}
                disabled={exporting || !options.windowBar}
              />
            </label>
            <label className="shot-check">
              <input
                type="checkbox"
                checked={options.lineNumbers}
                onChange={(e) => update("lineNumbers", e.target.checked)}
                disabled={exporting}
              />
              显示行号
            </label>
            <label className="shot-check">
              <input
                type="checkbox"
                checked={options.windowBar}
                onChange={(e) => update("windowBar", e.target.checked)}
                disabled={exporting}
              />
              窗口标题栏
            </label>
          </div>
        </CanvasPopover>
      </div>
      <div className="shot-layout">
        <section className="shot-controls" aria-label="代码编辑">
          <div className="shot-editor-title">
            <label htmlFor="shot-code">代码</label>
            <div>
              <button
                onClick={() =>
                  code ? setReplace(true) : changeCode(sampleCode)
                }
                disabled={exporting}
              >
                加载示例
              </button>
              <button onClick={() => changeCode("")} disabled={exporting}>
                清空
              </button>
            </div>
          </div>
          {replace && (
            <div className="replace-prompt">
              替换当前代码？
              <button onClick={() => changeCode(sampleCode)}>替换</button>
              <button onClick={() => setReplace(false)}>取消</button>
            </div>
          )}
          <CodeEditor
            id="shot-code"
            label="代码"
            value={code}
            onChange={changeCode}
            language="plain"
            indent="4"
            wrap
            readOnly={exporting}
            segments={
              tokens?.code === code && tokens.language === language
                ? tokens.segments
                : undefined
            }
            placeholder="粘贴代码开始创作…"
          />
          <p id="shot-limit" className="shot-caption">
            {code.length.toLocaleString()} / 12,000 字符 · 最多 160 行
          </p>
        </section>
        <section className="shot-preview-panel" aria-label="图片预览">
          <div className="shot-preview-heading">
            <strong>实时预览</strong>
            <span>
              {ready ? `${size.width} × ${size.height} px` : "等待生成"}
            </span>
          </div>
          <div
            className={`shot-preview-stage ${zoom === "fit" ? "is-fit" : "is-zoomed"}`}
            aria-busy={!ready && !error}
          >
            <canvas
              ref={canvas}
              role="img"
              aria-label="代码画布预览，内容与编辑区代码一致"
              style={{
                display: ready ? "block" : "none",
                width:
                  zoom === "fit"
                    ? undefined
                    : `${(size.width / options.scale) * Number(zoom)}px`,
              }}
            />
            {!ready && <p>{error ? "请调整输入或设置" : "正在生成预览…"}</p>}
          </div>
          <label className="shot-zoom">
            预览缩放
            <select
              aria-label="预览缩放"
              value={zoom}
              onChange={(e) => setZoom(e.target.value)}
            >
              <option value="fit">适应窗口</option>
              <option value="0.5">50%</option>
              <option value="1">100%</option>
              <option value="1.5">150%</option>
            </select>
          </label>
          {error && (
            <div className="error-box" role="alert">
              {error}
            </div>
          )}
          <div className="shot-export">
            {select(
              "导出倍率",
              String(options.scale),
              [
                ["1", "1× 标准"],
                ["2", "2× 高清"],
                ["3", "3× 超清"],
              ],
              (v) => update("scale", Number(v)),
            )}

            <button
              disabled={!ready || exporting}
              onClick={() => exportImage(true)}
            >
              复制图片
            </button>
            <button
              className="primary"
              disabled={!ready || exporting}
              onClick={() => exportImage(false)}
            >
              {exporting ? "正在导出…" : "下载 PNG"}{" "}
              <span aria-hidden="true">↓</span>
            </button>
          </div>
          <div className="notice" role="status">
            {notice}
          </div>
          <p className="shot-caption">
            预览缩放不影响导出，PNG 保留上方显示的实际分辨率。
          </p>
        </section>
      </div>
      <section className="instructions">
        <h2>使用说明</h2>
        <p>
          粘贴代码，选择语言和外观，即可复制或下载 PNG。支持 28
          种语言与格式；Tab 缩进，Ctrl / ⌘ + Z 撤销，Ctrl / ⌘ + F 查找，按 Esc
          后 Tab
          可离开编辑器。内容只在浏览器内处理，不执行代码、不上传，也不自动保存。刷新页面会恢复示例。
        </p>
        <details>
          <summary>图片和预览一致吗？</summary>
          <p>
            预览和导出使用同一张画布，支持中文、透明背景和 1× / 2× / 3×
            倍率。字体使用设备上的等宽字体，跨设备可能略有差异。Tab
            显示为四个空格。可在外观设置中指定图片宽度并开启长行换行，编辑区源码保持不变。
          </p>
        </details>
        <details>
          <summary>为什么不能导出？</summary>
          <p>
            空代码、关闭换行后超出指定宽度的长行或超出 1600
            万像素的图片会暂停导出，请减少代码、字号或倍率。复制图片需要浏览器支持和剪贴板权限，失败时可以下载
            PNG。
          </p>
        </details>
      </section>
    </>
  );
}
