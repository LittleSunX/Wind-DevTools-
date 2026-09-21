import { sampleCode } from "./code-image";

/** Public examples only. Selecting a language never replaces user content. */
export const codeSamples: Record<string, string> = {
  typescript: sampleCode,
  javascript: `const tools = ["Build", "Create", "Share"];
const welcome = (name) => \`Hello, \${name}!\`;

console.log(welcome("Wind"), tools);`,
  jsx: `export default function Welcome() {
  return (
    <section className="welcome">
      <h1>Hello, developer!</h1>
      <p>Build something worth sharing.</p>
    </section>
  );
}`,
  tsx: `type WelcomeProps = { name: string };

export default function Welcome({ name }: WelcomeProps) {
  return <h1>Hello, {name}!</h1>;
}`,
  markup: `<article class="card">
  <h1>Wind DevTools</h1>
  <p>把值得分享的代码，变成一张好看的图片。</p>
  <button type="button">开始创作</button>
</article>`,
  css: `.card {
  padding: 24px;
  border-radius: 12px;
  background: #f4f6fb;
  color: #25334a;
}

.card:hover {
  box-shadow: 0 8px 24px #25334a14;
}`,
  vue: `<script setup>
import { ref } from "vue";
const count = ref(0);
</script>

<template>
  <button @click="count++">点击了 {{ count }} 次</button>
</template>`,
  java: `public class Welcome {
    public static void main(String[] args) {
        String name = "Wind";
        System.out.println("Hello, " + name + "!");
    }
}`,
  python: `def welcome(name: str) -> str:
    return f"Hello, {name}!"


tools = ["Build", "Create", "Share"]
for tool in tools:
    print(welcome(tool))`,
  go: `package main

import "fmt"

func main() {
    tools := []string{"Build", "Create", "Share"}
    for _, tool := range tools {
        fmt.Printf("Hello, %s!\\n", tool)
    }
}`,
  rust: `fn main() {
    let tools = ["Build", "Create", "Share"];
    for tool in tools {
        println!("Hello, {}!", tool);
    }
}`,
  c: `#include <stdio.h>

int main(void) {
    const char *name = "Wind";
    printf("Hello, %s!\\n", name);
    return 0;
}`,
  cpp: `#include <iostream>
#include <string>
#include <vector>

int main() {
    std::vector<std::string> tools = {"Build", "Create", "Share"};
    for (const auto& tool : tools) {
        std::cout << "Hello, " << tool << "!\\n";
    }
}`,
  csharp: `using System;

class Welcome
{
    static void Main()
    {
        var name = "Wind";
        Console.WriteLine($"Hello, {name}!");
    }
}`,
  php: `<?php
function welcome(string $name): string {
    return "Hello, {$name}!";
}

foreach (["Build", "Create", "Share"] as $tool) {
    echo welcome($tool) . PHP_EOL;
}`,
  ruby: `def welcome(name)
  "Hello, #{name}!"
end

%w[Build Create Share].each do |tool|
  puts welcome(tool)
end`,
  kotlin: `fun main() {
    val tools = listOf("Build", "Create", "Share")
    tools.forEach { tool ->
        println("Hello, $tool!")
    }
}`,
  swift: `let tools = ["Build", "Create", "Share"]

for tool in tools {
    print("Hello, \\(tool)!")
}`,
  bash: `#!/usr/bin/env bash
set -euo pipefail

for tool in Build Create Share; do
  printf 'Hello, %s!\\n' "$tool"
done`,
  powershell: `$tools = @("Build", "Create", "Share")

foreach ($tool in $tools) {
    Write-Output "Hello, $tool!"
}`,
  json: `{
  "name": "Wind DevTools",
  "local": true,
  "features": ["Build", "Create", "Share"]
}`,
  yaml: `name: Wind DevTools
local: true
features:
  - Build
  - Create
  - Share`,
  toml: `name = "Wind DevTools"
local = true
features = ["Build", "Create", "Share"]

[canvas]
theme = "night"
width = 800`,
  xml: `<?xml version="1.0" encoding="UTF-8"?>
<toolbox name="Wind DevTools">
  <feature>Build</feature>
  <feature>Create</feature>
  <feature>Share</feature>
</toolbox>`,
  docker: `FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80`,
  markdown: `# Wind DevTools

把值得分享的代码，变成一张好看的图片。

- **Build**：构建想法
- **Create**：创作作品
- **Share**：分享经验`,
  sql: `SELECT
  category,
  COUNT(*) AS tool_count
FROM tools
WHERE enabled = 1
GROUP BY category
ORDER BY tool_count DESC;`,
  plain: `Wind DevTools

Build something useful.
Create something beautiful.
Share what you learn.`,
};
export const sampleForLanguage = (language: string) =>
  codeSamples[language] ?? codeSamples.plain;
