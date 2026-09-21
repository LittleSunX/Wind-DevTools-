import { useEffect, useRef, useState } from "react";
import { tools } from "../catalog";

const preferenceKey = "wind.sidebar.collapsed";

export function useSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const mobileToggle = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(preferenceKey) === "true");
    } catch {
      /* Navigation remains available when storage is blocked. */
    }
    const media = window.matchMedia("(max-width: 800px)");
    const closeOnResize = () => dialog.current?.close();
    media.addEventListener("change", closeOnResize);
    return () => media.removeEventListener("change", closeOnResize);
  }, []);
  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileOpen]);
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
  return (
    <>
      <div className="sidebar-caption">WORKSPACE</div>
      <nav aria-label="工具导航" onClick={onNavigate}>
        <a
          className={`side-home ${isHome ? "selected" : ""}`}
          href="/tools"
          aria-label="全部工具"
          aria-current={isHome ? "page" : undefined}
          title={collapsed ? "全部工具" : undefined}
        >
          <span className="side-icon" aria-hidden="true">
            ▦
          </span>
          <span className="side-label">全部工具</span>
          <small>{String(tools.length).padStart(2, "0")}</small>
        </a>
        <div className="sidebar-caption section-caption">开发工具</div>
        {tools.map((t) => (
          <a
            className={`side-link ${currentId === t.id ? "selected" : ""}`}
            href={`/tools/${t.id}`}
            key={t.id}
            aria-label={t.name}
            aria-current={currentId === t.id ? "page" : undefined}
            title={collapsed ? t.name : undefined}
          >
            <span className="side-icon" aria-hidden="true">
              {t.icon}
            </span>
            <span className="side-label">{t.name}</span>
            {currentId === t.id && <span className="active-dot" />}
          </a>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <span className="tiny-lock">⌑</span>
        <strong>放心粘贴，安心处理</strong>
        <p>
          无需登录，无需上传。
          <br />
          每一次处理，都在本地完成。
        </p>
        <span className="small-mono">BUILT FOR DEVELOPERS</span>
      </div>
    </>
  );
}
