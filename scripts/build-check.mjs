import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
  rm,
  access,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
const root = process.cwd();
for (const tool of ["json", "timestamp", "jwt", "sql", "cron", "code-image"]) {
  const html = await readFile(`dist/tools/${tool}/index.html`, "utf8");
  assert.ok(html.includes("<h1>"));
  assert.ok(html.includes("使用说明"));
  assert.ok(!html.includes("<!--app-html-->"));
  assert.ok(html.includes('name="description"'));
}
const fixture = await mkdtemp(path.join(tmpdir(), "wind-seo-"));
try {
  await mkdir(path.join(fixture, "dist"));
  await writeFile(
    path.join(fixture, "dist/index.html"),
    await readFile("index.html"),
  );
  const result = spawnSync(
    process.execPath,
    [
      path.join(root, "node_modules/tsx/dist/cli.mjs"),
      "--tsconfig",
      path.join(root, "tsconfig.json"),
      path.join(root, "scripts/prerender.ts"),
    ],
    {
      cwd: fixture,
      env: { ...process.env, SITE_URL: "https://wind-devtools.test" },
      encoding: "utf8",
    },
  );
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const html = await readFile(
    path.join(fixture, "dist/tools/json/index.html"),
    "utf8",
  );
  assert.ok(
    html.includes(
      'rel="canonical" href="https://wind-devtools.test/tools/json"',
    ),
  );
  const sitemap = await readFile(
    path.join(fixture, "dist/sitemap.xml"),
    "utf8",
  );
  assert.equal((sitemap.match(/<url>/g) || []).length, 7);
  assert.ok(
    (await readFile(path.join(fixture, "dist/robots.txt"), "utf8")).includes(
      "Sitemap: https://wind-devtools.test/sitemap.xml",
    ),
  );
  const page404 = await readFile(path.join(fixture, "dist/404.html"), "utf8");
  assert.ok(page404.includes('name="robots" content="noindex"'));
  assert.ok(!page404.includes('rel="canonical"'));
  // Rebuild as a preview to ensure previous production SEO files cannot remain.
  await rm(path.join(fixture, "dist"), { recursive: true });
  await mkdir(path.join(fixture, "dist"));
  await writeFile(
    path.join(fixture, "dist/index.html"),
    await readFile("index.html"),
  );
  const preview = spawnSync(
    process.execPath,
    [
      path.join(root, "node_modules/tsx/dist/cli.mjs"),
      "--tsconfig",
      path.join(root, "tsconfig.json"),
      path.join(root, "scripts/prerender.ts"),
    ],
    { cwd: fixture, env: { ...process.env, SITE_URL: "" }, encoding: "utf8" },
  );
  assert.equal(preview.status, 0, preview.stdout + preview.stderr);
  assert.ok(
    (await readFile(path.join(fixture, "dist/robots.txt"), "utf8")).includes(
      "Disallow: /",
    ),
  );
  await assert.rejects(access(path.join(fixture, "dist/sitemap.xml")));
  console.log(
    "Build checks passed: static content, production canonical/sitemap, preview robots and 404 metadata.",
  );
} finally {
  await rm(fixture, { recursive: true, force: true });
}
