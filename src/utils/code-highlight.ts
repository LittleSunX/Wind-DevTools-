import Prism from "prismjs";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-java";
import "prismjs/components/prism-python";
import "prismjs/components/prism-sql";
import "prismjs/components/prism-json";
import { validateCode, type Segment } from "./code-image";
export function highlightCode(code: string, language: string): Segment[] {
  validateCode(code);
  if (language === "plain") return [{ text: code, type: "" }];
  const grammar = Prism.languages[language];
  if (!grammar) throw new Error("暂不支持该语言。");
  const result: Segment[] = [];
  function flatten(
    value: string | Prism.Token | (string | Prism.Token)[],
    type = "",
  ) {
    if (typeof value === "string") result.push({ text: value, type });
    else if (Array.isArray(value)) value.forEach((v) => flatten(v, type));
    else flatten(value.content, value.type);
  }
  flatten(Prism.tokenize(code, grammar));
  return result;
}
