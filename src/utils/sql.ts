import { format } from "sql-formatter";
import type { Options } from "./shared";
export function sqlTool(input: string, options: Options) {
  const language = options.dialect || "mysql";
  if (language !== "mysql" && language !== "postgresql" && language !== "plsql")
    throw new Error("暂不支持该 SQL 方言。");
  return format(input, {
    language,
    keywordCase: options.keyword === "lower" ? "lower" : "upper",
    tabWidth: Number(options.indent || 2),
  });
}
