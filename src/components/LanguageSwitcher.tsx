import { useEffect } from "react";
import {
  i18n,
  languageKey,
  supportedLanguages,
  type Language,
} from "../i18n";
import { localizedPath, parseLocalizedPath } from "../i18n/routing";
import { tr, useLocale } from "../i18n/react";

export default function LanguageSwitcher() {
  const language = useLocale();
  useEffect(() => {
    document.documentElement.lang = language === "zh" ? "zh-CN" : language;
  }, [language]);
  return (
    <select
      className="language-switcher"
      aria-label={tr("界面语言")}
      value={language}
      onChange={(event) => {
        const next = event.target.value as Language;
        const route = parseLocalizedPath(window.location.pathname).path;
        const nextPath = localizedPath(route, next);
        void i18n.changeLanguage(next);
        history.replaceState(
          history.state,
          "",
          `${nextPath}${window.location.search}${window.location.hash}`,
        );
        const canonical = document.querySelector<HTMLLinkElement>(
          'link[rel="canonical"]',
        );
        if (canonical) canonical.href = new URL(nextPath, location.origin).href;
        try {
          localStorage.setItem(languageKey, next);
        } catch {
          /* Switching still works. */
        }
      }}
    >
      {supportedLanguages.map(({ id, label }) => (
        <option key={id} value={id}>
          {label}
        </option>
      ))}
    </select>
  );
}
