import { useEffect, useRef, useState } from "react";
import type { Language } from "../i18n";
import { localizedPath } from "../i18n/routing";
import { categories, tools } from "../catalog";
import { tr } from "../i18n/react";
import ToolIcon from "./ToolIcon";

export default function ToolDirectory({ language }: { language: Language }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("全部工具");
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
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
  }, []);
  const visible = tools.filter(
    (t) =>
      (category === "全部工具" || t.category === category) &&
      `${t.name} ${tr(t.name)} ${t.id} ${t.description} ${tr(t.description)} ${t.tags.join(" ")} ${t.tags.map((tag) => tr(tag)).join(" ")}`
        .toLowerCase()
        .includes(search.toLowerCase().trim()),
  );
  return (
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
      <section className="tool-directory" aria-labelledby="directory-title">
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
          <span>{tr("{{count}} 个工具", { count: visible.length })}</span>
        </div>
        <div className="tool-grid">
          {visible.map((t, i) => (
            <a
              className={`tool-card card-${t.id}`}
              href={localizedPath(`/tools/${t.id}`, language)}
              key={t.id}
            >
              <div className="card-top">
                <ToolIcon>{t.icon}</ToolIcon>
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
          <p>{tr("Wind DevTools 不保存输入内容，也不会上传处理结果。")}</p>
        </div>
        <span className="about-sign">Less, but better.</span>
      </section>
    </>
  );
}
