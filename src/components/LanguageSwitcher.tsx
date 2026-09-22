import { useEffect } from "react";
import {
  i18n,
  languageKey,
  resolveLanguage,
  supportedLanguages,
} from "../i18n";
import { tr, useLocale } from "../i18n/react";

export default function LanguageSwitcher() {
  const language = useLocale();
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(languageKey);
    } catch {
      /* Optional preference. */
    }
    void i18n.changeLanguage(resolveLanguage(saved, navigator.languages));
  }, []);
  useEffect(() => {
    document.documentElement.lang = language === "zh" ? "zh-CN" : language;
  }, [language]);
  return (
    <select
      className="language-switcher"
      aria-label={tr("界面语言")}
      value={language}
      onChange={(event) => {
        const next = event.target.value;
        void i18n.changeLanguage(next);
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
