import { readFile, writeFile, mkdir } from "node:fs/promises";
import { renderToString } from "react-dom/server";
import { createElement } from "react";
import { App } from "../src/App";
import { tools } from "../src/catalog";
import { loadEnv } from "vite";
const template = await readFile("dist/index.html", "utf8");
const raw =
  process.env.SITE_URL || loadEnv("production", process.cwd(), "").SITE_URL;
let origin: string | undefined;
if (raw) {
  const url = new URL(raw);
  if (!["http:", "https:"].includes(url.protocol))
    throw new Error("SITE_URL must be an HTTP(S) origin");
  origin = url.origin;
}
const routes = [
  {
    path: "/",
    title: "Wind DevTools — 开发者的轻量工具箱",
    description:
      "免费、无需登录的开发者工具箱。JSON、时间戳、JWT、SQL、Cron 和代码画布，数据在浏览器本地处理。",
  },
  {
    path: "/tools",
    title: "开发者工具箱 | Wind DevTools",
    description:
      "JSON 格式化、时间戳转换、JWT 解析、SQL 格式化、Cron 与代码画布工具，免费且在浏览器本地处理。",
  },
  ...tools.map((t) => ({
    path: `/tools/${t.id}`,
    title: `${t.name} - 免费在线开发工具 | Wind DevTools`,
    description: t.description + " 数据仅在浏览器本地处理。",
  })),
  {
    path: "/404",
    title: "页面不存在 | Wind DevTools",
    description: "当前页面不存在，请返回工具箱。",
  },
];
for (const route of routes) {
  let html = template
    .replace(
      "<!--app-html-->",
      renderToString(createElement(App, { path: route.path })),
    )
    .replace(/<title>.*?<\/title>/, `<title>${route.title}</title>`)
    .replace(
      /<meta\s+name="description"\s+content="[^"]*"\s*\/>/,
      `<meta name="description" content="${route.description}"/>`,
    );
  if (origin && route.path !== "/404")
    html = html.replace(
      "</head>",
      `<link rel="canonical" href="${origin}${route.path === "/" ? "/tools" : route.path}"/></head>`,
    );
  if (route.path === "/404")
    html = html.replace(
      "</head>",
      '<meta name="robots" content="noindex"/></head>',
    );
  const dest =
    route.path === "/"
      ? "dist/index.html"
      : route.path === "/404"
        ? "dist/404.html"
        : `dist${route.path}/index.html`;
  await mkdir(dest.slice(0, dest.lastIndexOf("/")), { recursive: true });
  await writeFile(dest, html);
}
await writeFile(
  "dist/robots.txt",
  origin
    ? `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`
    : "User-agent: *\nDisallow: /\n",
);
if (origin)
  await writeFile(
    "dist/sitemap.xml",
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${routes
      .filter((r) => !["/", "/404"].includes(r.path))
      .map((r) => `<url><loc>${origin}${r.path}</loc></url>`)
      .join("")}</urlset>`,
  );
console.log(
  `Pre-rendered ${routes.length} pages. ${origin ? "Canonical and sitemap enabled." : "Set SITE_URL for production indexing."}`,
);
