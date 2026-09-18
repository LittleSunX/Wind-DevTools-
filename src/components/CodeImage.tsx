import CanvasSettings from "./CanvasSettings";
import { readPreferences, writePreferences } from "../utils/canvas-preferences";
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
  const [zoom, setZoom] = useState("fit");
  const [size, setSize] = useState({ width: 0, height: 0, scale: 2 });
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const rendered = useRef<{
    code: string;
    language: string;
    options: ImageOptions;
  } | null>(null);
  const canExport =
    ready &&
    rendered.current?.code === code &&
    rendered.current?.language === language &&
    rendered.current?.options === options;
  const hasPreview = size.width > 0 && code.trim().length > 0;
  useEffect(() => {
    try {
      setOptions(readPreferences(localStorage));
    } catch {
      /* Private storage may be unavailable. */
    }
    setPreferencesLoaded(true);
  }, []);
  useEffect(() => {
    if (preferencesLoaded) {
      try {
        writePreferences(localStorage, options);
      } catch {
        /* Keep tools usable without storage. */
      }
    }
  }, [options, preferencesLoaded]);
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
      const buffer = document.createElement("canvas");
      const dimensions = drawCode(buffer, tokens.segments, options);
      const context = canvas.current.getContext("2d");
      if (!context) throw new Error("当前浏览器无法创建图片。");
      canvas.current.width = buffer.width;
      canvas.current.height = buffer.height;
      context.drawImage(buffer, 0, 0);
      rendered.current = { code, language, options };
      setSize({ ...dimensions, scale: options.scale });
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
    if (!canExport || !canvas.current) return;
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
          <CanvasSettings
            options={options}
            update={update}
            exporting={exporting}
            onReset={() => {
              setReady(false);
              setOptions({ ...defaults, title: options.title });
            }}
          />
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
              aria-label={
                canExport
                  ? "代码画布预览，内容与编辑区代码一致"
                  : "上一次生成的预览，当前内容尚未生成"
              }
              style={{
                display: hasPreview ? "block" : "none",
                width:
                  zoom === "fit"
                    ? undefined
                    : `${(size.width / size.scale) * Number(zoom)}px`,
              }}
            />
            {!canExport && (
              <p
                className={hasPreview ? "shot-preview-status" : undefined}
                role="status"
              >
                {error
                  ? hasPreview
                    ? "保留上次预览 · 请修正输入或设置"
                    : "请调整输入或设置"
                  : hasPreview
                    ? "正在更新预览…"
                    : "正在生成预览…"}
              </p>
            )}
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
              disabled={!canExport || exporting}
              onClick={() => exportImage(true)}
            >
              复制图片
            </button>
            <button
              className="primary"
              disabled={!canExport || exporting}
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
          可离开编辑器。内容只在浏览器内处理，不执行代码、不上传。仅在本机记住外观偏好，不保存代码或窗口标题；刷新页面会恢复示例。
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
