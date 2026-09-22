import { createInstance } from "i18next";
import zh from "./locales/zh.json";
import en from "./locales/en.json";

export const languageKey = "wind.language";
export const supportedLanguages = [
  { id: "zh", label: "中文" },
  { id: "en", label: "English" },
] as const;
export type Language = (typeof supportedLanguages)[number]["id"];
export const i18n = createInstance();
// Start in Chinese on both server and client to hydrate pre-rendered pages safely.
void i18n.init({
  lng: "zh",
  fallbackLng: "zh",
  supportedLngs: supportedLanguages.map(({ id }) => id),
  resources: { zh: { translation: zh }, en: { translation: en } },
  keySeparator: false,
  nsSeparator: false,
  initAsync: false,
  interpolation: { escapeValue: false },
});

export function resolveLanguage(
  saved: string | null,
  preferred: readonly string[],
): Language {
  if (supportedLanguages.some(({ id }) => id === saved))
    return saved as Language;
  for (const locale of preferred) {
    const base = locale.toLowerCase().split(/[-_]/)[0];
    if (supportedLanguages.some(({ id }) => id === base))
      return base as Language;
  }
  return "zh";
}
export type TranslationMessage = {
  key: string;
  values?: Record<string, string | number | TranslationMessage>;
};
export type Message = string | TranslationMessage;

function renderMessage(message: TranslationMessage, language?: string): string {
  const values = Object.fromEntries(
    Object.entries(message.values ?? {}).map(([key, value]) => [
      key,
      typeof value === "object" ? renderMessage(value, language) : value,
    ]),
  );
  return i18n.t(message.key, {
    ...values,
    ...(language ? { lng: language } : {}),
  });
}

export function tr(
  message: Message | undefined | null,
  parameters?: Record<string, string | number>,
): string {
  if (message == null || message === "") return "";
  return typeof message === "string"
    ? i18n.t(message, parameters ?? {})
    : renderMessage(message);
}
// Keep the original message for logs/tests; carry keys and values across workers.
export class MessageError extends Error {
  constructor(public readonly localized: TranslationMessage) {
    super(renderMessage(localized, "zh"));
    this.name = "MessageError";
  }
}
export function errorMessage(
  error: unknown,
  fallback = "处理失败，请检查输入。",
): Message {
  return error instanceof MessageError
    ? error.localized
    : error instanceof Error
      ? error.message
      : fallback;
}
