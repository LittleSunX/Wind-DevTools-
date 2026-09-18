import Prism from "prismjs";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-java";
import "prismjs/components/prism-python";
import "prismjs/components/prism-sql";
import "prismjs/components/prism-json";
import "prismjs/components/prism-jsx";
import "prismjs/components/prism-tsx";
import "prismjs/components/prism-go";
import "prismjs/components/prism-rust";
import "prismjs/components/prism-c";
import "prismjs/components/prism-cpp";
import "prismjs/components/prism-csharp";
import "prismjs/components/prism-markup-templating";
import "prismjs/components/prism-php";
import "prismjs/components/prism-ruby";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-powershell";
import "prismjs/components/prism-yaml";
import "prismjs/components/prism-toml";
import "prismjs/components/prism-docker";
import "prismjs/components/prism-markdown";
import "prismjs/components/prism-kotlin";
import "prismjs/components/prism-swift";
import { validateCode, type Segment } from "./code-image";
export function highlightCode(code: string, language: string): Segment[] {
  validateCode(code);
  if (language === "plain") return [{ text: code, type: "" }];
  const grammar = Prism.languages[language === "vue" ? "markup" : language];
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
