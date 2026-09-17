import React from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";
const root = document.getElementById("root")!;
const app = (
  <React.StrictMode>
    <App path={window.location.pathname} />
  </React.StrictMode>
);
if (root.querySelector(".app")) hydrateRoot(root, app);
else createRoot(root).render(app);

import { initAnalytics } from "./analytics";
initAnalytics();

import "./components/code-image.css";
