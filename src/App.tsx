import { i18n, type Language, type Message } from "./i18n";
import { localizedPath, parseLocalizedPath } from "./i18n/routing";
import { tr, useLocale } from "./i18n/react";
import LanguageSwitcher from "./components/LanguageSwitcher";
import Sidebar, { SidebarIcon, useSidebar } from "./components/Sidebar";
import CodeEditor from "./components/CodeEditor";
import CodeImage from "./components/CodeImage";
import DiffTool from "./components/DiffTool";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { categories, tools } from "./catalog";
import { trackTool } from "./analytics";
import type { Options } from "./utils/shared";
import {
  createCanvasTransfer,
  writeCanvasTransfer,
} from "./utils/canvas-transfer";
const defaultOptions: Options = {
  indent: "2",
  dialect: "mysql",
  keyword: "upper",
  unit: "ms",
  zone: "UTC",
  direction: "timestamp",
  mode: "quartz",
  codec: "base64",
  codecDirection: "encode",
  textAction: "dedupe",
  target: "typescript",
  rootName: "Root",
  prefix: "",
  suffix: "",
};
function Select({
  label,
  value,
  items,
  onChange,
}: {
  label: string;
  value: string;
  items: string[][];
  onChange: (v: string) => void;
}) {
  return (
    <label className="select-label">
      {tr(label)}
      <select
        aria-label={tr(label)}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {items.map(([v, l]) => (
          <option key={v} value={v}>
            {tr(l)}
          </option>
        ))}
      </select>
    </label>
  );
}
function Icon({ children }: { children: ReactNode }) {
  return (
    <span className="tool-icon" aria-hidden="true">
      {children}
    </span>
  );
}
export function App({ path = "/tools" }: { path?: string }) {
  const locale = useLocale();
  const route = parseLocalizedPath(path);
  const normalized = route.path.replace(/\/$/, "") || "/";
  const language = (locale === "en" ? "en" : "zh") as Language;
  const href = (target: string) => localizedPath(target, language);
  const current = tools.find((t) => normalized === `/tools/${t.id}`);
  const isHome = normalized === "/" || normalized === "/tools";
  const sidebar = useSidebar();
  useEffect(() => {
    document.title = `${tr(current?.name ?? (isHome ? "开发者工具箱" : "页面不存在"))} | Wind DevTools`;
    const description = document.querySelector('meta[name="description"]');
    description?.setAttribute(
      "content",
      tr(current?.description ?? "小工具，解决开发中的日常问题。"),
    );
  }, [locale, current, isHome]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("全部工具");
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [error, setError] = useState<Message>("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [replace, setReplace] = useState(false);
  const [wrap, setWrap] = useState(true);
  const codeLanguage =
    current?.id === "json" || current?.id === "sql" ? current.id : undefined;
  const [options, setOptions] = useState<Options>(defaultOptions);
  const [now, setNow] = useState<number>();
  const searchRef = useRef<HTMLInputElement>(null);
  const worker = useRef<Worker | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  function stop() {
    worker.current?.terminate();
    worker.current = null;
    clearTimeout(timer.current);
    setBusy(false);
  }
  function invalidate() {
    stop();
    setOutput("");
    setError("");
    setNotice("");
  }
  function changeInput(value: string) {
    invalidate();
    setInput(value);
    setReplace(false);
  }
  function option(key: keyof Options, value: string) {
    invalidate();
    setOptions((o) => ({ ...o, [key]: value }));
  }
  useEffect(
    () => () => {
      worker.current?.terminate();
      clearTimeout(timer.current);
    },
    [],
  );
  useEffect(() => {
    if (current?.id !== "timestamp") return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [current?.id]);
  useEffect(() => {
    if (!isHome) return;
    const focusSearch = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        event.key === "/" &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !target.closest("input, textarea, select, [contenteditable]")
      ) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener("keydown", focusSearch);
    return () => document.removeEventListener("keydown", focusSearch);
  }, [isHome]);
  function example() {
    if (current?.id === "timestamp" && options.direction === "date")
      return "2026-09-14 00:00:00";
    if (current?.id === "timestamp" && options.unit === "s")
      return "1789344000";
    if (current?.id === "cron" && options.mode === "linux")
      return "*/5 * * * *";
    return current?.example || "";
  }
  function run(action = "format") {
    if (!current) return;
    invalidate();
    if (!input.trim()) {
      setError("请先输入需要处理的内容。");
      return;
    }
    if (new TextEncoder().encode(input).length > 5 * 1024 * 1024) {
      setError("输入超过 5 MiB，请拆分后再处理。");
      return;
    }
    setBusy(true);
    try {
      const active = new Worker(new URL("./worker.ts", import.meta.url), {
        type: "module",
      });
      worker.current = active;
      active.onmessage = (e) => {
        if (worker.current !== active) return;
        trackTool(
          current.id,
          action,
          e.data.error ? "error" : "success",
          e.data.error ? "invalid_input" : undefined,
        );
        setOutput(e.data.result || "");
        setError(e.data.error || "");
        stop();
      };
      active.onerror = () => {
        if (worker.current !== active) return;
        trackTool(current.id, action, "error", "worker_error");
        setError("处理线程出现错误，请重试。");
        stop();
      };
      active.postMessage({
        id: current.id,
        input,
        language: i18n.resolvedLanguage,
        options: { ...options, action },
      });
      timer.current = setTimeout(() => {
        if (worker.current !== active) return;
        stop();
        trackTool(current.id, action, "error", "timeout");
        setError("处理超过 8 秒，已停止。请缩小输入或简化表达式。");
      }, 8000);
    } catch {
      stop();
      setError("无法启动处理线程，请检查浏览器设置后重试。");
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(output);
      setNotice("已复制到剪贴板");
    } catch {
      setNotice("复制失败，请在结果区域手动选择并复制。");
    }
  }
  function download() {
    const url = URL.createObjectURL(
      new Blob([output], { type: "text/plain;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `wind-${current?.id}.${current?.id === "sql" ? "sql" : current?.id === "json" ? "json" : "txt"}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function sendToCanvas() {
    if (!current || !output) return;
    if (output.length > 12000 || output.split(/\r\n|\r|\n/).length > 160) {
      setNotice(
        "结果超过代码画布限制（12,000 字符 / 160 行），请精简后再发送。",
      );
      return;
    }
    const transferOverride =
      current.id === "json-type"
        ? {
            language: options.target === "java" ? "java" : "typescript",
            title:
              options.target === "java"
                ? `${options.rootName || "Root"}.java`
                : `${options.rootName || "Root"}.ts`,
          }
        : undefined;
    const payload = createCanvasTransfer(current.id, output, transferOverride);
    if (!payload) {
      setNotice("当前结果暂不支持发送到代码画布。");
      return;
    }
    try {
      writeCanvasTransfer(sessionStorage, payload);
      trackTool(current.id, "send_to_canvas", "success");
      window.location.assign(href("/tools/code-image"));
    } catch {
      trackTool(current.id, "send_to_canvas", "error");
      setNotice("无法暂存结果，请检查浏览器存储设置后重试。");
    }
  }
  const visible = tools.filter(
    (t) =>
      (category === "全部工具" || t.category === category) &&
      `${t.name} ${tr(t.name)} ${t.id} ${t.description} ${tr(t.description)} ${t.tags.join(" ")} ${t.tags.map((tag) => tr(tag)).join(" ")}`
        .toLowerCase()
        .includes(search.toLowerCase().trim()),
  );
  return (
    <div className="app">
      <a className="skip-link" href="#main">
        {tr("跳转到主要内容")}
      </a>
      <header className="topbar">
        <button
          className="sidebar-toggle desktop-sidebar-toggle"
          type="button"
          aria-label={tr(sidebar.collapsed ? "展开侧边栏" : "收起侧边栏")}
          title={tr(sidebar.collapsed ? "展开侧边栏" : "收起侧边栏")}
          aria-expanded={!sidebar.collapsed}
          aria-controls="desktop-sidebar"
          onClick={sidebar.toggleDesktop}
        >
          <SidebarIcon />
        </button>
        <button
          className="sidebar-toggle mobile-sidebar-toggle"
          type="button"
          ref={sidebar.mobileToggle}
          aria-label={tr("打开工具导航")}
          aria-expanded={sidebar.mobileOpen}
          aria-controls="mobile-sidebar"
          onClick={sidebar.openMobile}
        >
          <SidebarIcon />
        </button>
        <a className="brand" href={href("/tools")}>
          <span className="brand-name">
            wind<span className="brand-period">.</span>
          </span>
          <span className="brand-divider" aria-hidden="true" />
          <span className="brand-product">DevTools</span>
        </a>
        <nav aria-label={tr("主导航")}>
          <a href={href("/tools")} className="nav-active">
            {tr("工具箱")}
          </a>
          <a href={`${href("/tools")}#about`}>{tr("关于")}</a>
        </nav>
        <span className="header-local">
          <i /> {tr("数据留在浏览器")}
        </span>
        <LanguageSwitcher />
        <span className="version">v1.0</span>
      </header>
      <div className="layout">
        <aside
          id="desktop-sidebar"
          ref={sidebar.desktop}
          className={`sidebar ${sidebar.collapsed ? "is-collapsed" : ""}`}
          aria-label={tr("侧边栏")}
        >
          {!sidebar.collapsed && (
            <button
              className="sidebar-pin"
              type="button"
              aria-pressed={sidebar.pinned}
              onClick={sidebar.togglePin}
              title={tr(
                sidebar.pinned
                  ? "取消固定后，侧栏闲置 30 秒自动收起"
                  : "固定后侧栏不会自动收起",
              )}
            >
              {tr(sidebar.pinned ? "已固定展开" : "固定展开")}
            </button>
          )}
          <Sidebar
            currentId={current?.id}
            isHome={isHome}
            collapsed={sidebar.collapsed}
          />
        </aside>
        <dialog
          id="mobile-sidebar"
          className="sidebar-drawer"
          ref={sidebar.dialog}
          aria-label={tr("工具导航菜单")}
          onClose={sidebar.onMobileClose}
          onKeyDown={(event) => {
            if (event.key !== "Tab") return;
            const items =
              event.currentTarget.querySelectorAll<HTMLElement>(
                "button, a[href]",
              );
            const first = items[0];
            const last = items[items.length - 1];
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last?.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first?.focus();
            }
          }}
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              const rect = event.currentTarget.getBoundingClientRect();
              if (
                event.clientX < rect.left ||
                event.clientX > rect.right ||
                event.clientY < rect.top ||
                event.clientY > rect.bottom
              )
                sidebar.closeMobile();
            }
          }}
        >
          <div className="sidebar-drawer-heading">
            <strong>{tr("工具导航")}</strong>
            <button
              type="button"
              aria-label={tr("关闭工具导航")}
              onClick={sidebar.closeMobile}
            >
              {tr("关闭")}
            </button>
          </div>
          <Sidebar
            currentId={current?.id}
            isHome={isHome}
            onNavigate={sidebar.closeMobile}
          />
        </dialog>
        <main
          id="main"
          className={current ? `tool-page tool-${current.id}` : undefined}
        >
          {isHome ? (
            <>
              <section className="hero">
                <span className="eyebrow">
                  <i /> LESS FRICTION. MORE FLOW.
                </span>
                <h1>
                  {tr("常用工具，")}
                  <br />
                  <em>{tr("刚刚好。")}</em>
                </h1>
                <p>
                  {tr("为开发中的每一个小任务，准备一个顺手的工具。")}
                  <br />
                  {tr("简单、免费，数据只在你的浏览器里流转。")}
                </p>
                <div className="hero-tags">
                  <span>{tr("✓ 无需注册")}</span>
                  <span>{tr("✓ 本地处理")}</span>
                  <span>{tr("✓ 打开即用")}</span>
                </div>
                <div className="hero-art" aria-hidden="true">
                  <div className="art-grid" />
                  <div className="code-note">
                    <span>
                      <i />
                      <i />
                      <i />
                    </span>
                    <code>
                      <b>const</b> workflow = {"{"}
                      <br />
                      &nbsp; tools: <em>"just enough"</em>,<br />
                      &nbsp; privacy: <em>true</em>,<br />
                      &nbsp; friction: <strong>0</strong>
                      <br />
                      {"}"};
                    </code>
                    <div>
                      ↳ &nbsp;ready when you are<span>✓</span>
                    </div>
                  </div>
                  <span className="art-label">YOUR EVERYDAY DEV COMPANION</span>
                </div>
              </section>
              <section
                className="tool-directory"
                aria-labelledby="directory-title"
              >
                <div className="directory-top">
                  <div>
                    <h2 id="directory-title">
                      {tr("工具箱")}{" "}
                      <span>{String(tools.length).padStart(2, "0")}</span>
                    </h2>
                    <p>{tr("小工具，解决开发中的日常问题。")}</p>
                  </div>
                  <label className="search">
                    <span aria-hidden="true">⌕</span>
                    <input
                      ref={searchRef}
                      aria-label={tr("搜索工具")}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder={tr("搜索工具名称或关键词…")}
                    />
                    <kbd>/</kbd>
                  </label>
                </div>
                <div className="filters" aria-label={tr("工具分类")}>
                  {categories.map((c) => (
                    <button
                      key={c}
                      aria-pressed={c === category}
                      className={c === category ? "active" : ""}
                      onClick={() => setCategory(c)}
                    >
                      {tr(c)}
                    </button>
                  ))}
                  <span>
                    {tr("{{count}} 个工具", { count: visible.length })}
                  </span>
                </div>
                <div className="tool-grid">
                  {visible.map((t, i) => (
                    <a
                      className={`tool-card card-${t.id}`}
                      href={href(`/tools/${t.id}`)}
                      key={t.id}
                    >
                      <div className="card-top">
                        <Icon>{t.icon}</Icon>
                        <span className="card-category">{tr(t.category)}</span>
                      </div>
                      <h3>{tr(t.name)}</h3>
                      <p>{tr(t.description)}</p>
                      <div className="card-bottom">
                        <div>
                          {t.tags.slice(0, 2).map((tag) => (
                            <span key={tag}>{tr(tag)}</span>
                          ))}
                        </div>
                        <span className="card-arrow">↗</span>
                      </div>
                      <span className="card-number">0{i + 1}</span>
                    </a>
                  ))}
                </div>
                {!visible.length && (
                  <div className="empty-search">
                    {tr("没有找到匹配的工具。试试 JSON、时间戳或 SQL。")}
                  </div>
                )}
              </section>
              <section className="about-strip" id="about">
                <span>⌘</span>
                <div>
                  <h3>{tr("专注工具本身，把时间留给创造。")}</h3>
                  <p>
                    {tr("Wind DevTools 不保存输入内容，也不会上传处理结果。")}
                  </p>
                </div>
                <span className="about-sign">Less, but better.</span>
              </section>
            </>
          ) : current?.id === "code-image" ? (
            <CodeImage />
          ) : current?.id === "diff" ? (
            <DiffTool />
          ) : current ? (
            <>
              <div className="breadcrumb">
                <a href={href("/tools")}>{tr("工具箱")}</a>
                <span>/</span>
                {tr(current.name)}
              </div>
              <section className="tool-heading">
                <div>
                  <div className="eyebrow">
                    {tr(current.category)} / {current.id.toUpperCase()}
                  </div>
                  <h1>{tr(current.name)}</h1>
                  <p>{tr(current.description)}</p>
                </div>
                <Icon>{current.icon}</Icon>
              </section>
              <div className="privacy-banner">
                <span>⌑</span>{" "}
                {tr("数据仅在当前浏览器处理，刷新后不会自动恢复。")}
                <span className="local-badge">LOCAL ONLY</span>
              </div>
              {current.id === "timestamp" && (
                <div className="live-time">
                  <span>
                    <i /> {tr("当前时间戳")}
                  </span>
                  <strong>{now ?? "—"}</strong>
                  <button
                    onClick={() => {
                      option("direction", "timestamp");
                      setOptions((o) => ({
                        ...o,
                        direction: "timestamp",
                        unit: "ms",
                      }));
                      changeInput(String(Date.now()));
                    }}
                  >
                    {tr("填入当前时间 ↙")}
                  </button>
                </div>
              )}
              <div className="options-bar">
                {(current.id === "json" || current.id === "sql") && (
                  <Select
                    label="缩进"
                    value={options.indent!}
                    items={[
                      ["2", "2 个空格"],
                      ["4", "4 个空格"],
                    ]}
                    onChange={(v) => option("indent", v)}
                  />
                )}
                {current.id === "sql" && (
                  <>
                    <Select
                      label="SQL 方言"
                      value={options.dialect!}
                      items={[
                        ["mysql", "MySQL"],
                        ["postgresql", "PostgreSQL"],
                        ["plsql", "Oracle / PL SQL"],
                      ]}
                      onChange={(v) => option("dialect", v)}
                    />
                    <Select
                      label="关键字"
                      value={options.keyword!}
                      items={[
                        ["upper", "大写"],
                        ["lower", "小写"],
                      ]}
                      onChange={(v) => option("keyword", v)}
                    />
                  </>
                )}
                {current.id === "timestamp" && (
                  <>
                    <Select
                      label="转换方向"
                      value={options.direction!}
                      items={[
                        ["timestamp", "时间戳 → 日期"],
                        ["date", "日期 → 时间戳"],
                      ]}
                      onChange={(v) => option("direction", v)}
                    />
                    <Select
                      label="输入单位"
                      value={options.unit!}
                      items={[
                        ["ms", "毫秒（ms）"],
                        ["s", "秒（s）"],
                      ]}
                      onChange={(v) => option("unit", v)}
                    />
                  </>
                )}
                {current.id === "cron" && (
                  <Select
                    label="表达式模式"
                    value={options.mode!}
                    items={[
                      ["quartz", "Quartz · 6 字段"],
                      ["linux", "Linux · 5 字段"],
                    ]}
                    onChange={(v) => option("mode", v)}
                  />
                )}
                {current.id === "codec" && (
                  <>
                    <Select
                      label="编码类型"
                      value={options.codec!}
                      items={[
                        ["base64", "Base64"],
                        ["url", "URL 编码"],
                      ]}
                      onChange={(v) => option("codec", v)}
                    />
                    <Select
                      label="操作"
                      value={options.codecDirection!}
                      items={[
                        ["encode", "编码"],
                        ["decode", "解码"],
                      ]}
                      onChange={(v) => option("codecDirection", v)}
                    />
                  </>
                )}
                {current.id === "json-type" && (
                  <>
                    <Select
                      label="目标语言"
                      value={options.target!}
                      items={[
                        ["typescript", "TypeScript"],
                        ["java", "Java"],
                      ]}
                      onChange={(v) => option("target", v)}
                    />
                    <label className="select-label">
                      {tr("根类型名")}
                      <input
                        aria-label={tr("根类型名")}
                        value={options.rootName || ""}
                        maxLength={40}
                        onChange={(event) =>
                          option("rootName", event.target.value)
                        }
                      />
                    </label>
                  </>
                )}
                {current.id === "text" && (
                  <>
                    <Select
                      label="处理方式"
                      value={options.textAction!}
                      items={[
                        ["dedupe", "按行去重"],
                        ["sort-asc", "升序排序"],
                        ["sort-desc", "降序排序"],
                        ["trim-lines", "每行 Trim"],
                        ["remove-empty", "删除空行"],
                        ["upper", "转大写"],
                        ["lower", "转小写"],
                        ["prefix", "添加前缀"],
                        ["suffix", "添加后缀"],
                      ]}
                      onChange={(v) => option("textAction", v)}
                    />
                    {options.textAction === "prefix" && (
                      <label className="select-label">
                        {tr("前缀")}
                        <input
                          aria-label={tr("前缀")}
                          value={options.prefix || ""}
                          onChange={(event) =>
                            option("prefix", event.target.value)
                          }
                        />
                      </label>
                    )}
                    {options.textAction === "suffix" && (
                      <label className="select-label">
                        {tr("后缀")}
                        <input
                          aria-label={tr("后缀")}
                          value={options.suffix || ""}
                          onChange={(event) =>
                            option("suffix", event.target.value)
                          }
                        />
                      </label>
                    )}
                  </>
                )}
                {(current.id === "timestamp" || current.id === "cron") && (
                  <Select
                    label="时区"
                    value={options.zone!}
                    items={[
                      ["UTC", "UTC"],
                      ["local", "浏览器本地时区"],
                    ]}
                    onChange={(v) => option("zone", v)}
                  />
                )}
                {codeLanguage && (
                  <label className="wrap-option">
                    <input
                      type="checkbox"
                      checked={wrap}
                      onChange={(e) => setWrap(e.target.checked)}
                    />
                    {tr("自动换行")}
                  </label>
                )}
                <span className="option-hint">
                  {tr(
                    current.id === "jwt"
                      ? "仅解码 · 不验证签名"
                      : "⌘ / Ctrl + Enter 执行",
                  )}
                </span>
              </div>
              {current.id === "cron" && (
                <div className="presets">
                  {[
                    ["每分钟", "* * * * *", "0 * * * * ?"],
                    ["每 5 分钟", "*/5 * * * *", "0 */5 * * * ?"],
                    ["每小时", "0 * * * *", "0 0 * * * ?"],
                    ["每天凌晨", "0 0 * * *", "0 0 0 * * ?"],
                    ["每周一", "0 0 * * 1", "0 0 0 ? * 2"],
                    ["每月 1 日", "0 0 1 * *", "0 0 0 1 * ?"],
                  ].map(([label, linux, quartz]) => (
                    <button
                      key={label}
                      onClick={() =>
                        changeInput(options.mode === "linux" ? linux : quartz)
                      }
                    >
                      {tr(label)}
                    </button>
                  ))}
                </div>
              )}
              <div
                className="editors"
                onKeyDownCapture={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                    e.preventDefault();
                    e.stopPropagation();
                    run();
                  }
                }}
              >
                <section className="editor-panel">
                  <div className="editor-header">
                    <label htmlFor="tool-input">
                      {tr("输入")} <span>INPUT</span>
                    </label>
                    <button
                      onClick={() =>
                        input ? setReplace(true) : changeInput(example())
                      }
                    >
                      {tr("加载示例")}
                    </button>
                    <button onClick={() => changeInput("")}>
                      {tr("清空")}
                    </button>
                  </div>
                  {replace && (
                    <div className="replace-prompt">
                      {tr("用示例替换现有输入？")}
                      <button onClick={() => changeInput(example())}>
                        {tr("替换")}
                      </button>
                      <button onClick={() => setReplace(false)}>
                        {tr("取消")}
                      </button>
                    </div>
                  )}
                  {codeLanguage ? (
                    <CodeEditor
                      id="tool-input"
                      label={tr("输入")}
                      value={input}
                      language={codeLanguage}
                      dialect={options.dialect}
                      indent={options.indent}
                      wrap={wrap}
                      invalid={!!error}
                      onChange={changeInput}
                      placeholder={tr("粘贴代码，或点击「加载示例」开始…")}
                    />
                  ) : (
                    <textarea
                      aria-label={tr("输入")}
                      id="tool-input"
                      aria-invalid={!!error}
                      aria-describedby={error ? "tool-error" : undefined}
                      spellCheck={false}
                      value={input}
                      onChange={(e) => changeInput(e.target.value)}
                      placeholder={
                        current.id === "timestamp" &&
                        options.direction === "date"
                          ? "2026-09-14 00:00:00"
                          : tr(
                              "在这里粘贴{{name}}内容…\n\n也可以点击「加载示例」开始。",
                              { name: tr(current.name) },
                            )
                      }
                    />
                  )}
                  {error && (
                    <div id="tool-error" className="error-box" role="alert">
                      {tr(error)}
                    </div>
                  )}
                  <div className="action-bar">
                    <button
                      className="primary"
                      disabled={busy}
                      onClick={() => run()}
                    >
                      {tr(
                        current.id === "timestamp"
                          ? "转换"
                          : current.id === "jwt"
                            ? "解析 JWT"
                            : current.id === "cron"
                              ? "计算执行时间"
                              : current.id === "codec"
                                ? "转换"
                                : current.id === "json-type"
                                  ? "生成类型"
                                  : current.id === "text"
                                    ? "处理"
                                    : "格式化",
                      )}{" "}
                      <span aria-hidden="true">↗</span>
                    </button>
                    {current.id === "json" && (
                      <>
                        <button disabled={busy} onClick={() => run("minify")}>
                          {tr("压缩")}
                        </button>
                        <button disabled={busy} onClick={() => run("validate")}>
                          {tr("校验")}
                        </button>
                      </>
                    )}
                    {busy && (
                      <button
                        onClick={() => {
                          stop();
                          setNotice("已取消处理");
                        }}
                      >
                        {tr("取消处理")}
                      </button>
                    )}
                  </div>
                  <div className="editor-footer">
                    <span>{tr("{{count}} 字符", { count: input.length })}</span>
                    <span>{tr("最大 5 MiB · UTF-8")}</span>
                  </div>
                </section>
                <section className="editor-panel output-panel" aria-busy={busy}>
                  <div className="editor-header">
                    <label htmlFor="tool-output">
                      {tr("结果")} <span>OUTPUT</span>
                    </label>
                    <button disabled={!output} onClick={copy}>
                      {tr("复制")}
                    </button>
                    <button disabled={!output} onClick={download}>
                      {tr("下载")}
                    </button>
                    <button disabled={!output} onClick={sendToCanvas}>
                      {tr("发送到代码画布")}
                    </button>
                  </div>
                  <div className="output-wrap">
                    {codeLanguage ? (
                      <CodeEditor
                        id="tool-output"
                        label={tr("处理结果")}
                        value={output}
                        language={codeLanguage}
                        dialect={options.dialect}
                        indent={options.indent}
                        wrap={wrap}
                        readOnly
                      />
                    ) : (
                      <textarea
                        id="tool-output"
                        aria-label={tr("处理结果")}
                        readOnly
                        value={output}
                        spellCheck={false}
                      />
                    )}
                    {!output && (
                      <div className="output-empty">
                        <span>{tr(busy ? "↻" : error ? "!" : "⌁")}</span>
                        <strong>
                          {tr(
                            busy
                              ? "正在本地处理…"
                              : error
                                ? "请检查输入"
                                : "准备好，随时开始",
                          )}
                        </strong>
                        <p>
                          {tr(
                            busy
                              ? "你可以随时取消处理"
                              : error
                                ? "修正后再次执行，即可查看结果"
                                : "处理结果将显示在这里",
                          )}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="editor-footer">
                    <span
                      className={`result-status ${busy ? "is-busy" : error ? "is-error" : output ? "is-done" : ""}`}
                    >
                      {tr(
                        busy
                          ? "正在处理"
                          : error
                            ? "输入有误"
                            : output
                              ? "处理完成"
                              : "等待处理",
                      )}
                    </span>
                    <span>{tr("浏览器本地计算")}</span>
                  </div>
                </section>
              </div>
              <div className="notice" role="status">
                {tr(notice)}
              </div>
              <section className="instructions">
                <h2>{tr("使用说明")}</h2>
                {codeLanguage && (
                  <p>
                    {tr(
                      "Tab 缩进，Shift + Tab 取消缩进；按 Esc 后再按 Tab 可离开编辑器。Ctrl / ⌘ + F 查找，Ctrl / ⌘ + Z 撤销编辑。",
                    )}
                  </p>
                )}
                <p>{tr(current.hint)}</p>
                <p>
                  {tr(
                    current.id === "cron"
                      ? "选择表达式模式和时区，输入表达式或使用快捷模板，再计算未来 5 次执行时间。搜索范围为未来 5 年。"
                      : current.id === "timestamp"
                        ? "选择转换方向、单位和时区。日期使用 YYYY-MM-DD HH:mm:ss 格式，结果同时展示 ISO 8601 和两种时间戳。"
                        : "粘贴内容或加载示例，选择选项并执行。结果支持复制或下载；错误时请根据提示修正输入。",
                  )}
                </p>
                <details>
                  <summary>{tr("输入内容会被保存吗？")}</summary>
                  <p>
                    {tr(
                      "不会自动保存到服务器、浏览器存储或 URL。刷新页面会清除输入。只有当你主动选择“发送到代码画布”时，处理结果才会临时写入当前标签页的 sessionStorage，并在代码画布读取后立即删除。主动下载的文件会保存在你的设备上。启用访问统计时仅记录页面与工具操作，不包含输入、输出或错误原文。",
                    )}
                  </p>
                </details>
                <details>
                  <summary>{tr("为什么有时处理会停止？")}</summary>
                  <p>
                    {tr(
                      "单次输入限制为 5 MiB；JSON 最多嵌套 128 层、格式化结果最多约 2000 万字符。处理超过 8 秒会自动终止，请拆分大文本后重试。",
                    )}
                  </p>
                </details>
              </section>
            </>
          ) : (
            <section className="not-found">
              <span className="eyebrow">404 / NOT FOUND</span>
              <h1>{tr("这个工具还不存在。")}</h1>
              <p>{tr("回到工具箱，寻找你需要的工具。")}</p>
              <a className="primary" href={href("/tools")}>
                {tr("返回工具箱 ↗")}
              </a>
            </section>
          )}
          <footer>
            <span>© {new Date().getFullYear()} Wind DevTools</span>
            <span>{tr("简单 · 免费 · 隐私友好")}</span>
            <span>
              Made for your flow. <i>↗</i>
            </span>
          </footer>
        </main>
      </div>
    </div>
  );
}
