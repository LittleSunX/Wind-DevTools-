import { describe, it, expect } from "vitest";
import { highlightCode } from "../src/utils/code-highlight";
import { splitSegments, validateCode } from "../src/utils/code-image";
describe("code image highlighting", () => {
  it.each([
    "typescript",
    "javascript",
    "java",
    "python",
    "sql",
    "json",
    "css",
    "markup",
    "plain",
  ])("preserves source text in %s", (language) => {
    const code = '// 中文\nconst name = "<script> 😀";\n';
    expect(
      highlightCode(code, language)
        .map((t) => t.text)
        .join(""),
    ).toBe(code);
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
