import { describe, it, expect } from "vitest";
import { highlightCode } from "../src/utils/code-highlight";
import {
  splitSegments,
  validateCode,
  languages,
} from "../src/utils/code-image";
describe("code image highlighting", () => {
  it.each(languages.map(([id]) => id))(
    "preserves source text in %s",
    (language) => {
      const code = '// 中文\nconst name = "<script> 😀";\n';
      expect(
        highlightCode(code, language)
          .map((t) => t.text)
          .join(""),
      ).toBe(code);
    },
  );
  it.each([
    ["go", "package main\nfunc main() {}"],
    ["rust", "fn main() { let value = 1; }"],
    ["cpp", "int main() { return 0; }"],
    ["csharp", "public class Demo {}"],
    ["php", "<?php echo 'hello'; ?>"],
    ["jsx", "const view = <div>Hello</div>;"],
    ["tsx", "const view: JSX.Element = <div>Hello</div>;"],
    ["vue", "<template><h1>Hello</h1></template><script>const n = 1;</script>"],
    ["bash", "echo 'hello'"],
    ["powershell", "$name = 'hello'"],
    ["yaml", "name: hello"],
    ["toml", "name = 'hello'"],
    ["docker", "FROM node:22\nRUN echo hello"],
    ["markdown", "# Hello\n**world**"],
    ["kotlin", "fun main() { val n = 1 }"],
    ["swift", 'let name = "hello"'],
    ["ruby", "def hello\n  puts 'hello'\nend"],
  ])("recognizes native syntax in %s", (language, code) => {
    const segments = highlightCode(code, language);
    expect(segments.some((segment) => segment.type.length > 0)).toBe(true);
    expect(segments.map((segment) => segment.text).join("")).toBe(code);
  });
  it("assigns keyword and string colors", () => {
    const result = highlightCode('const greeting = "hello";', "javascript");
    expect(result.some((s) => s.type === "keyword" && s.text === "const")).toBe(
      true,
    );
    expect(result.some((s) => s.type === "string")).toBe(true);
  });
  it("preserves empty lines and normalizes Windows line endings and tabs", () => {
    expect(
      splitSegments([{ text: "a\r\n\r\n\tb\r", type: "comment" }]).map((l) =>
        l.map((s) => s.text).join(""),
      ),
    ).toEqual(["a", "", "    b", ""]);
  });
  it("rejects empty, oversized and excessively tall input", () => {
    expect(() => validateCode(" ")).toThrow();
    expect(() => validateCode("x".repeat(12001))).toThrow("12,000");
    expect(() => validateCode("a\n".repeat(160))).toThrow("160");
  });
});
