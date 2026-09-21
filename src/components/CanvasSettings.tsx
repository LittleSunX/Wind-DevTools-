import { useState } from "react";
import {
  canvasFonts,
  themeChoices,
  themes,
  type ImageOptions,
} from "../utils/code-image";
export default function CanvasSettings({
  options,
  update,
  exporting,
  onReset,
}: {
  options: ImageOptions;
  update: <K extends keyof ImageOptions>(
    key: K,
    value: ImageOptions[K],
  ) => void;
  exporting: boolean;
  onReset: () => void;
}) {
  const [customWidth, setCustomWidth] = useState(false);
  const widthChoice =
    customWidth || ![640, 800, 1200].includes(options.width)
      ? "custom"
      : String(options.width);
  const setWidthChoice = (value: string) => setCustomWidth(value === "custom");
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
    <div className="shot-settings">
      <div className="shot-theme-grid shot-wide" role="group" aria-label="主题">
        {themeChoices.map(([id, label]) => {
          const theme = themes[id];
          return (
            <button
              type="button"
              key={id}
              aria-label={`应用${label}主题`}
              aria-pressed={options.theme === id}
              disabled={exporting}
              onClick={() => update("theme", id)}
              style={{ background: theme.bg, color: theme.text }}
            >
              <span className="shot-theme-code" aria-hidden="true">
                <span style={{ color: theme.colors.keyword }}>const </span>wind
                = <span style={{ color: theme.colors.string }}>"hello"</span>
              </span>
              <span>
                {label}
                {options.theme === id ? " ✓" : ""}
              </span>
            </button>
          );
        })}
      </div>
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
                value={Number.isFinite(options.width) ? options.width : ""}
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
            宽度包含外边距，按 1× 计算。换行只影响图片，续行不重复显示行号。
          </p>
        </>
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
      {options.background === "solid" && (
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
      )}
      {select(
        "字体",
        options.fontFamily,
        canvasFonts.map((font) => [font.id, font.name]),
        (v) => update("fontFamily", v),
      )}
      {select(
        "行高",
        String(options.lineHeight),
        [
          ["1.4", "紧凑 · 1.4"],
          ["1.65", "舒适 · 1.65"],
          ["1.9", "宽松 · 1.9"],
        ],
        (v) => update("lineHeight", Number(v)),
      )}
      {select(
        "字号",
        String(options.fontSize),
        [14, 16, 18, 20, 24].map((n) => [String(n), `${n} px`]),
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
      <p className="shot-setting-help shot-wide">
        仅在本机记住外观偏好，不保存代码或窗口标题。
      </p>
      <button
        className="shot-wide"
        disabled={exporting}
        onClick={() => {
          setCustomWidth(false);
          onReset();
        }}
      >
        恢复默认外观
      </button>
    </div>
  );
}
