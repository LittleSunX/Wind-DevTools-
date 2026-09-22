import { readFile, writeFile, mkdir } from "node:fs/promises";
import { renderToString } from "react-dom/server";
import { createElement } from "react";
import { App } from "../src/App";
import { tools } from "../src/catalog";
import { i18n, type Language } from "../src/i18n";
import { alternatePaths, localizedPath } from "../src/i18n/routing";
import { pageMetadata } from "../src/seo";
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

const canonicalRoutes = [
  { path: "/tools", tool: undefined },
  ...tools.map((tool) => ({ path: `/tools/${tool.id}`, tool })),
];

function seoLinks(path: string, publicPath: string) {
  if (!origin) return "";
  const alternatives = alternatePaths(path);
  return [
    `<link rel="canonical" href="${origin}${publicPath}"/>`,
    `<link rel="alternate" hreflang="zh-CN" href="${origin}${alternatives.zh}"/>`,
    `<link rel="alternate" hreflang="en" href="${origin}${alternatives.en}"/>`,
    `<link rel="alternate" hreflang="x-default" href="${origin}${alternatives.zh}"/>`,
  ].join("");
}

async function renderPage({
  publicPath,
  routePath,
  language,
  canonicalPath = publicPath,
  tool,
  noindex = false,
}: {
  publicPath: string;
  routePath: string;
  language: Language;
  canonicalPath?: string;
  tool?: (typeof tools)[number];
  noindex?: boolean;
}) {
  await i18n.changeLanguage(language);
  const meta = pageMetadata({ language, tool, isHome: routePath === "/tools" });
  let html = template
    .replace(
      /<html lang="[^"]*">/,
      `<html lang="${language === "zh" ? "zh-CN" : "en"}">`,
    )
    .replace(
      "<!--app-html-->",
      renderToString(createElement(App, { path: publicPath })),
    )
    .replace(/<title>.*?<\/title>/, `<title>${meta.title}</title>`)
    .replace(
      /<meta\s+name="description"\s+content="[^"]*"\s*\/>/,
      `<meta name="description" content="${meta.description}"/>`,
    );

  if (noindex) {
    html = html.replace(
      "</head>",
      '<meta name="robots" content="noindex"/></head>',
    );
  } else if (origin) {
    html = html.replace(
      "</head>",
      `${seoLinks(routePath, canonicalPath)}</head>`,
    );
  }

  const dest =
    publicPath === "/"
      ? "dist/index.html"
      : publicPath === "/404"
        ? "dist/404.html"
        : `dist${publicPath}/index.html`;
  await mkdir(dest.slice(0, dest.lastIndexOf("/")), { recursive: true });
  await writeFile(dest, html);
}

for (const language of ["zh", "en"] as const) {
  for (const route of canonicalRoutes) {
    const publicPath = localizedPath(route.path, language);
    await renderPage({
      publicPath,
      routePath: route.path,
      language,
      tool: route.tool,
    });
  }
}

await renderPage({
  publicPath: "/",
  routePath: "/tools",
  language: "zh",
  canonicalPath: "/tools",
});
await renderPage({
  publicPath: "/en",
  routePath: "/tools",
  language: "en",
  canonicalPath: "/en/tools",
});
await renderPage({
  publicPath: "/404",
  routePath: "/404",
  language: "zh",
  noindex: true,
});

await writeFile(
  "dist/robots.txt",
  origin
    ? `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`
    : "User-agent: *\nDisallow: /\n",
);

if (origin) {
  const urls = canonicalRoutes.flatMap((route) =>
    (["zh", "en"] as const).map((language) => {
      const loc = localizedPath(route.path, language);
      const alternatives = alternatePaths(route.path);
      return `<url><loc>${origin}${loc}</loc><xhtml:link rel="alternate" hreflang="zh-CN" href="${origin}${alternatives.zh}"/><xhtml:link rel="alternate" hreflang="en" href="${origin}${alternatives.en}"/><xhtml:link rel="alternate" hreflang="x-default" href="${origin}${alternatives.zh}"/></url>`;
    }),
  );
  await writeFile(
    "dist/sitemap.xml",
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${urls.join("")}</urlset>`,
  );
}

console.log(
  `Pre-rendered ${canonicalRoutes.length * 2 + 3} pages. ${origin ? "Bilingual canonical, hreflang and sitemap enabled." : "Set SITE_URL for production indexing."}`,
);
