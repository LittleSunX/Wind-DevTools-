import { useEffect } from "react";
import type { Language } from "./i18n";
import { localizedPath, parseLocalizedPath } from "./i18n/routing";
import { tr, useLocale } from "./i18n/react";
import { pageMetadata } from "./seo";
import { tools } from "./catalog";
import AppLayout from "./components/AppLayout";
import ToolDirectory from "./components/ToolDirectory";
import TextToolPage from "./components/TextToolPage";
import CodeImage from "./components/CodeImage";
import DiffTool from "./components/DiffTool";

export function App({ path = "/tools" }: { path?: string }) {
  const locale = useLocale();
  const normalized = parseLocalizedPath(path).path;
  const language: Language = locale === "en" ? "en" : "zh";
  const current = tools.find((tool) => normalized === `/tools/${tool.id}`);
  const isHome = normalized === "/" || normalized === "/tools";
  useEffect(() => {
    const meta = pageMetadata({ language, tool: current, isHome });
    document.title = meta.title;
    const description = document.querySelector('meta[name="description"]');
    description?.setAttribute("content", meta.description);
  }, [language, current, isHome]);
  return (
    <AppLayout current={current} isHome={isHome} language={language}>
      {isHome ? (
        <ToolDirectory language={language} />
      ) : current?.id === "code-image" ? (
        <CodeImage />
      ) : current?.id === "diff" ? (
        <DiffTool />
      ) : current ? (
        <TextToolPage current={current} language={language} />
      ) : (
        <section className="not-found">
          <span className="eyebrow">404 / NOT FOUND</span>
          <h1>{tr("这个工具还不存在。")}</h1>
          <p>{tr("回到工具箱，寻找你需要的工具。")}</p>
          <a className="primary" href={localizedPath("/tools", language)}>
            {tr("返回工具箱 ↗")}
          </a>
        </section>
      )}
    </AppLayout>
  );
}
