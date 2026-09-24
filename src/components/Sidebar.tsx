import { tr, useLocale } from "../i18n/react";
import { localizedPath } from "../i18n/routing";
import { useEffect, useRef, useState } from "react";
import { tools } from "../catalog";
import ToolIcon from "./ToolIcon";

const preferenceKey = "wind.sidebar.collapsed";

export function useSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [pinned, setPinned] = useState(false);
  const desktop = useRef<HTMLElement>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const mobileToggle = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      try {
        setCollapsed(localStorage.getItem(preferenceKey) === "true");
        setPinned(localStorage.getItem("wind.sidebar.pinned") === "true");
      } catch {
        /* Navigation remains available when storage is blocked. */
      }
    });
    const media = window.matchMedia("(max-width: 800px)");
    const closeOnResize = () => dialog.current?.close();
    media.addEventListener("change", closeOnResize);
    return () => {
      cancelled = true;
      media.removeEventListener("change", closeOnResize);
    };
  }, []);
  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileOpen]);
  useEffect(() => {
    const node = desktop.current;
    if (!node || collapsed || pinned) return;
    const media = window.matchMedia("(min-width: 801px)");
    let timer: ReturnType<typeof setTimeout> | undefined;
    const cancel = () => clearTimeout(timer);
    const schedule = () => {
      cancel();
      if (
        !media.matches ||
        document.hidden ||
        node.matches(":hover") ||
        node.contains(document.activeElement)
      )
        return;
      timer = setTimeout(() => {
        if (
          media.matches &&
          !document.hidden &&
          !node.matches(":hover") &&
          !node.contains(document.activeElement)
        )
          setCollapsed(true);
      }, 30000);
    };
    const afterBlur = () => {
      cancel();
      timer = setTimeout(schedule, 0);
    };
    node.addEventListener("pointerenter", cancel);
    node.addEventListener("pointerleave", schedule);
    node.addEventListener("focusin", cancel);
    node.addEventListener("focusout", afterBlur);
    media.addEventListener("change", schedule);
    document.addEventListener("visibilitychange", schedule);
    schedule();
    return () => {
      cancel();
      node.removeEventListener("pointerenter", cancel);
      node.removeEventListener("pointerleave", schedule);
      node.removeEventListener("focusin", cancel);
      node.removeEventListener("focusout", afterBlur);
      media.removeEventListener("change", schedule);
      document.removeEventListener("visibilitychange", schedule);
    };
  }, [collapsed, pinned]);
  function togglePin() {
    const next = !pinned;
    setPinned(next);
    try {
      localStorage.setItem("wind.sidebar.pinned", String(next));
    } catch {
      /* Optional preference. */
    }
  }
  function toggleDesktop() {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(preferenceKey, String(next));
    } catch {
      /* Optional preference. */
    }
  }
  function openMobile() {
    dialog.current?.showModal();
    setMobileOpen(true);
  }
  function closeMobile() {
    dialog.current?.close();
  }
  function onMobileClose() {
    setMobileOpen(false);
    if (window.matchMedia("(max-width: 800px)").matches)
      mobileToggle.current?.focus();
  }
  return {
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
  };
}

export function SidebarIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <path d="M9 4v16" />
    </svg>
  );
}

export default function Sidebar({
  currentId,
  isHome,
  collapsed = false,
  onNavigate,
}: {
  currentId?: string;
  isHome: boolean;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const locale = useLocale();
  const href = (path: string) =>
    localizedPath(path, locale === "en" ? "en" : "zh");
  return (
    <>
      <div className="sidebar-caption">WORKSPACE</div>
      <nav aria-label={tr("工具导航")} onClick={onNavigate}>
        <a
          className={`side-home ${isHome ? "selected" : ""}`}
          href={href("/tools")}
          aria-label={tr("全部工具")}
          aria-current={isHome ? "page" : undefined}
          title={tr(collapsed ? "全部工具" : undefined)}
        >
          <ToolIcon id="all" compact />
          <span className="side-label">{tr("全部工具")}</span>
          <small>{String(tools.length).padStart(2, "0")}</small>
        </a>
        <div className="sidebar-caption section-caption">{tr("开发工具")}</div>
        {tools.map((t) => (
          <a
            className={`side-link ${currentId === t.id ? "selected" : ""}`}
            href={href(`/tools/${t.id}`)}
            key={t.id}
            aria-label={tr(t.name)}
            aria-current={currentId === t.id ? "page" : undefined}
            title={tr(collapsed ? t.name : undefined)}
          >
            <ToolIcon id={t.id} compact />
            <span className="side-label">{tr(t.name)}</span>
            {currentId === t.id && <span className="active-dot" />}
          </a>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <span className="tiny-lock">⌑</span>
        <strong>{tr("放心粘贴，安心处理")}</strong>
        <p>
          {tr("无需登录，无需上传。")}
          <br />
          {tr("每一次处理，都在本地完成。")}
        </p>
        <span className="small-mono">BUILT FOR DEVELOPERS</span>
      </div>
    </>
  );
}
