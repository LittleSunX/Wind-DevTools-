import { MessageError, tr } from "../i18n";
import type { Options } from "./shared";
export function jsonTool(input: string, options: Options) {
  // Validate syntax, but never serialize the parsed numbers: retain original tokens.
  try {
    JSON.parse(input);
  } catch (error) {
    const message = error instanceof Error ? error.message : "无效 JSON";
    const match = /position (\d+)/.exec(message);
    if (match) {
      const before = input.slice(0, Number(match[1]));
      const lines = before.split("\n");
      throw new MessageError({
        key: "JSON 语法错误：第 {{line}} 行，第 {{column}} 列。{{detail}}",
        values: {
          line: lines.length,
          column: lines.at(-1)!.length + 1,
          detail: message,
        },
      });
    }
    throw new MessageError({
      key: "JSON 语法错误：{{detail}}",
      values: { detail: message },
    });
  }
  const tokens = input.match(/"(?:\\.|[^"\\])*"|[^\s{}\[\],:]+|[{}\[\],:]/g)!;
  const stack: (Set<string> | null)[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token === "{" || token === "[") {
      stack.push(token === "{" ? new Set() : null);
      if (stack.length > 128)
        throw new Error("JSON 嵌套超过 128 层，请简化后再处理。");
    } else if (token === "}" || token === "]") stack.pop();
    else if (tokens[i + 1] === ":") {
      const key = JSON.parse(token) as string;
      const keys = stack.at(-1)!;
      if (keys.has(key))
        throw new MessageError({
          key: "存在重复键「{{key}}」，请修正后再转换。",
          values: { key },
        });
      keys.add(key);
    }
  }
  if (options.action === "validate")
    return tr("✓ JSON 语法正确，未发现重复键。");
  if (options.action === "minify") return tokens.join("");
  const indent = " ".repeat(Number(options.indent || 2));
  let depth = 0;
  let length = 0;
  const result: string[] = [];
  const add = (value: string) => {
    length += value.length;
    if (length > 20 * 1024 * 1024)
      throw new Error("格式化结果超过 20 Mi 字符，请缩小输入。");
    result.push(value);
  };
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const next = tokens[i + 1];
    if (token === "{" || token === "[") {
      add(token);
      if (next === "}" || next === "]") {
        add(next);
        i++;
      } else {
        depth++;
        add("\n" + indent.repeat(depth));
      }
    } else if (token === "}" || token === "]") {
      depth--;
      add("\n" + indent.repeat(depth) + token);
    } else if (token === ",") add(",\n" + indent.repeat(depth));
    else if (token === ":") add(": ");
    else add(token);
  }
  return result.join("");
}
