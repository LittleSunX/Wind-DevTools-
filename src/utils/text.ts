import type { Options } from "./shared";

export function textTool(input: string, options: Options) {
  const action = options.textAction || "dedupe";
  const lines = input.replace(/\r\n?/g, "\n").split("\n");
  switch (action) {
    case "dedupe": {
      const seen = new Set<string>();
      return lines.filter((line) => {
        if (seen.has(line)) return false;
        seen.add(line);
        return true;
      }).join("\n");
    }
    case "sort-asc":
      return [...lines].sort((a, b) => a.localeCompare(b, "zh-CN")).join("\n");
    case "sort-desc":
      return [...lines].sort((a, b) => b.localeCompare(a, "zh-CN")).join("\n");
    case "trim-lines":
      return lines.map((line) => line.trim()).join("\n");
    case "remove-empty":
      return lines.filter((line) => line.trim() !== "").join("\n");
    case "upper":
      return input.toUpperCase();
    case "lower":
      return input.toLowerCase();
    case "prefix":
      return lines.map((line) => `${options.prefix || ""}${line}`).join("\n");
    case "suffix":
      return lines.map((line) => `${line}${options.suffix || ""}`).join("\n");
    default:
      throw new Error("未知文本处理操作。");
  }
}
