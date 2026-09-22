import { tools, type ToolId } from "./catalog";
import { i18n } from "./i18n";
import { localizedPath, parseLocalizedPath } from "./i18n/routing";

type Status = "success" | "error";
type ErrorKind = "invalid_input" | "timeout" | "worker_error";
type Payload = Record<string, unknown>;
declare global {
  interface Window {
    umami?: { track: (payload: (props: Payload) => Payload) => unknown };
    windBeforeSend?: (type: string, payload: Payload) => Payload | false;
  }
}
const actions = [
  "format",
  "minify",
  "validate",
  "convert",
  "decode",
  "parse",
  "export",
  "copy_image",
  "copy",
  "send_to_canvas",
  "export_svg",
  "copy_svg",
  "copy_data_url",
  "copy_base64",
  "open_image",
];
// Rebuild rather than redact: unrecognized fields and free-form values never leave the page.
export function sanitizeAnalytics(payload: Payload, pathname: string): Payload {
  const route = parseLocalizedPath(pathname);
  const tool = tools.find((t) => route.path === `/tools/${t.id}`);
  const safePath = tool
    ? `/tools/${tool.id}`
    : route.path === "/" || route.path === "/tools"
      ? "/tools"
      : "/404";
  const clean: Payload = {};
  for (const key of ["website", "hostname", "language", "screen"])
    if (typeof payload[key] === "string") clean[key] = payload[key];
  clean.url = localizedPath(safePath, route.language);
  clean.title = tool
    ? `${i18n.t(tool.name, { lng: route.language })} | Wind DevTools`
    : "Wind DevTools";
  if (typeof payload.referrer === "string") {
    try {
      clean.referrer = new URL(payload.referrer).origin;
    } catch {
      clean.referrer = "";
    }
  }
  const data = payload.data as Payload | undefined;
  if (
    data &&
    tools.some((t) => t.id === data.tool) &&
    actions.includes(String(data.action)) &&
    ["success", "error"].includes(String(data.status))
  ) {
    clean.name = `${data.tool}_${data.action}`;
    clean.data = {
      tool: data.tool,
      action: data.action,
      status: data.status,
      ...(["invalid_input", "timeout", "worker_error"].includes(
        String(data.error),
      )
        ? { error: data.error }
        : {}),
    };
  }
  return clean;
}
function enabled() {
  return (
    import.meta.env.PROD &&
    Boolean(import.meta.env.VITE_UMAMI_WEBSITE_ID) &&
    Boolean(import.meta.env.VITE_UMAMI_SCRIPT_URL) &&
    window.location.hostname === import.meta.env.VITE_UMAMI_ALLOWED_HOST &&
    navigator.doNotTrack !== "1"
  );
}
export function initAnalytics() {
  if (!enabled() || document.getElementById("wind-analytics")) return;
  let src: URL;
  try {
    src = new URL(import.meta.env.VITE_UMAMI_SCRIPT_URL);
    if (src.protocol !== "https:") return;
  } catch {
    return;
  }
  window.windBeforeSend = (type, payload) =>
    type === "event"
      ? sanitizeAnalytics(payload, window.location.pathname)
      : false;
  const script = document.createElement("script");
  script.id = "wind-analytics";
  script.defer = true;
  script.src = src.href;
  script.dataset.websiteId = import.meta.env.VITE_UMAMI_WEBSITE_ID;
  script.dataset.excludeSearch = "true";
  script.dataset.excludeHash = "true";
  script.dataset.doNotTrack = "true";
  script.dataset.beforeSend = "windBeforeSend";
  document.head.append(script);
}
export function trackTool(
  tool: ToolId,
  action: string,
  status: Status,
  error?: ErrorKind,
) {
  if (!enabled()) return;
  const normalized =
    tool === "timestamp"
      ? "convert"
      : tool === "jwt"
        ? "decode"
        : tool === "cron"
          ? "parse"
          : action;
  try {
    const result = window.umami?.track((props) =>
      sanitizeAnalytics(
        { ...props, data: { tool, action: normalized, status, error } },
        window.location.pathname,
      ),
    );
    if (result && typeof (result as Promise<unknown>).catch === "function")
      void (result as Promise<unknown>).catch(() => {});
  } catch {
    /* Analytics must never interrupt a tool operation. */
  }
}
