import type { Language } from "./index";

export function parseLocalizedPath(pathname: string): {
  language: Language;
  path: string;
} {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  if (normalized === "/en") return { language: "en", path: "/tools" };
  if (normalized.startsWith("/en/"))
    return {
      language: "en",
      path: normalized.slice(3) || "/tools",
    };
  return { language: "zh", path: normalized };
}

export function localizedPath(path: string, language: Language): string {
  const normalized = path.replace(/\/+$/, "") || "/tools";
  const canonicalPath = normalized === "/" ? "/tools" : normalized;
  return language === "en" ? `/en${canonicalPath}` : canonicalPath;
}

export function alternatePaths(path: string) {
  return {
    zh: localizedPath(path, "zh"),
    en: localizedPath(path, "en"),
  };
}
