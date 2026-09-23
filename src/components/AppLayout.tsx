import type { ReactNode } from "react";
import type { Language } from "../i18n";
import { localizedPath } from "../i18n/routing";
import { tr } from "../i18n/react";
import LanguageSwitcher from "./LanguageSwitcher";
import Sidebar, { SidebarIcon, useSidebar } from "./Sidebar";
import type { ToolDefinition } from "../catalog";

export default function AppLayout({
  current,
  isHome,
  language,
  children,
}: {
  current?: ToolDefinition;
  isHome: boolean;
  language: Language;
  children: ReactNode;
}) {
  const href = (path: string) => localizedPath(path, language);
  const {
    collapsed,
    pinned,
    desktop,
    togglePin,
    mobileOpen,
    dialog,
    mobileToggle,
    toggleDesktop,
    openMobile,
    closeMobile,
    onMobileClose,
  } = useSidebar();
  return (
    <div className="app">
      <a className="skip-link" href="#main">
        {tr("跳转到主要内容")}
      </a>
      <header className="topbar">
        <button
          className="sidebar-toggle desktop-sidebar-toggle"
          type="button"
          aria-label={tr(collapsed ? "展开侧边栏" : "收起侧边栏")}
          title={tr(collapsed ? "展开侧边栏" : "收起侧边栏")}
          aria-expanded={!collapsed}
          aria-controls="desktop-sidebar"
          onClick={toggleDesktop}
        >
          <SidebarIcon />
        </button>
        <button
          className="sidebar-toggle mobile-sidebar-toggle"
          type="button"
          ref={mobileToggle}
          aria-label={tr("打开工具导航")}
          aria-expanded={mobileOpen}
          aria-controls="mobile-sidebar"
          onClick={openMobile}
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
        <LanguageSwitcher />
      </header>
      <div className="layout">
        <aside
          id="desktop-sidebar"
          ref={desktop}
          className={`sidebar ${collapsed ? "is-collapsed" : ""}`}
          aria-label={tr("侧边栏")}
        >
          {!collapsed && (
            <button
              className="sidebar-pin"
              type="button"
              aria-pressed={pinned}
              onClick={togglePin}
              title={tr(
                pinned
                  ? "取消固定后，侧栏闲置 30 秒自动收起"
                  : "固定后侧栏不会自动收起",
              )}
            >
              {tr(pinned ? "已固定展开" : "固定展开")}
            </button>
          )}
          <Sidebar
            currentId={current?.id}
            isHome={isHome}
            collapsed={collapsed}
          />
        </aside>
        <dialog
          id="mobile-sidebar"
          className="sidebar-drawer"
          ref={dialog}
          aria-label={tr("工具导航菜单")}
          onClose={onMobileClose}
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
                closeMobile();
            }
          }}
        >
          <div className="sidebar-drawer-heading">
            <strong>{tr("工具导航")}</strong>
            <button
              type="button"
              aria-label={tr("关闭工具导航")}
              onClick={closeMobile}
            >
              {tr("关闭")}
            </button>
          </div>
          <Sidebar
            currentId={current?.id}
            isHome={isHome}
            onNavigate={closeMobile}
          />
        </dialog>
        <main
          id="main"
          className={current ? `tool-page tool-${current.id}` : undefined}
        >
          {children}
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
