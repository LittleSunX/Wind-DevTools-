import { tools } from "./catalog";
import { tr, type Language } from "./i18n";

type Tool = (typeof tools)[number];

export function pageMetadata({
  language,
  tool,
  isHome,
}: {
  language: Language;
  tool?: Tool;
  isHome?: boolean;
}) {
  if (tool)
    return {
      title:
        language === "en"
          ? `${tr(tool.name)} - Free Online Developer Tool | Wind DevTools`
          : `${tr(tool.name)} - 免费在线开发工具 | Wind DevTools`,
      description:
        language === "en"
          ? `${tr(tool.description)} Processed locally in your browser.`
          : `${tr(tool.description)} 数据仅在浏览器本地处理。`,
    };

  if (isHome)
    return language === "en"
      ? {
          title: "Developer Toolbox | Wind DevTools",
          description:
            "Free developer tools for JSON, timestamps, JWT, SQL, Cron, text and code images. No sign-up; processing stays in your browser.",
        }
      : {
          title: "开发者工具箱 | Wind DevTools",
          description:
            "JSON 格式化、时间戳转换、JWT 解析、SQL 格式化、Cron 与代码画布工具，免费且在浏览器本地处理。",
        };

  return language === "en"
    ? {
        title: "Page not found | Wind DevTools",
        description: "This page does not exist. Return to the developer toolbox.",
      }
    : {
        title: "页面不存在 | Wind DevTools",
        description: "当前页面不存在，请返回工具箱。",
      };
}
