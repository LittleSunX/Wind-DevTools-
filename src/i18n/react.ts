import { useTranslation } from "react-i18next";
import { i18n } from "./index";
export { tr } from "./index";
export function useLocale() {
  // Subscribe the component to i18next language changes.
  useTranslation("translation", { i18n });
  return i18n.resolvedLanguage || "zh";
}
