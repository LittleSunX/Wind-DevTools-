import React from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { App } from "./App";
import { i18n, languageKey, resolveLanguage } from "./i18n";
import { parseLocalizedPath } from "./i18n/routing";
import "./styles.css";

function readSavedLanguage() {
  try {
    return localStorage.getItem(languageKey);
  } catch {
    return null;
  }
}

async function bootstrap() {
  const requested = parseLocalizedPath(window.location.pathname);
  let language = requested.language;
  if (window.location.pathname === "/") {
    language = resolveLanguage(readSavedLanguage(), navigator.languages);
    if (language === "en") {
      window.location.replace(
        `/en/tools${window.location.search}${window.location.hash}`,
      );
      return;
    }
  }
  await i18n.changeLanguage(language);
  const htmlLanguage = language === "zh" ? "zh-CN" : "en";
  const canHydrate = document.documentElement.lang === htmlLanguage;
  document.documentElement.lang = htmlLanguage;
  mount(canHydrate);
}

void bootstrap();

function mount(canHydrate: boolean) {
  const root = document.getElementById("root")!;
  const app = (
    <React.StrictMode>
      <App path={window.location.pathname} />
    </React.StrictMode>
  );
  if (root.querySelector(".app") && canHydrate) hydrateRoot(root, app);
  else {
    root.replaceChildren();
    createRoot(root).render(app);
  }

  void import("./analytics").then(({ initAnalytics }) => initAnalytics());
}

import "./components/code-image.css";
import "./components/code-editor.css";
