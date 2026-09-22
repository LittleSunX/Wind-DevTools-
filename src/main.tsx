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

const requested = parseLocalizedPath(window.location.pathname);
if (window.location.pathname === "/") {
  const preferred = resolveLanguage(readSavedLanguage(), navigator.languages);
  if (preferred === "en") {
    window.location.replace(
      `/en/tools${window.location.search}${window.location.hash}`,
    );
  } else {
    void i18n.changeLanguage("zh");
    mount();
  }
} else {
  void i18n.changeLanguage(requested.language);
  mount();
}

function mount() {
  const root = document.getElementById("root")!;
  const app = (
    <React.StrictMode>
      <App path={window.location.pathname} />
    </React.StrictMode>
  );
  if (root.querySelector(".app")) hydrateRoot(root, app);
  else createRoot(root).render(app);

  void import("./analytics").then(({ initAnalytics }) => initAnalytics());
}

import "./components/code-image.css";
import "./components/code-editor.css";
