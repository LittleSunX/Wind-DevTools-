import { describe, it, expect } from "vitest";
import { layoutCodeLines } from "../src/utils/code-layout";
import { splitSegments, imageFilename } from "../src/utils/code-image";
const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
const measure = (text: string) => [...segmenter.segment(text)].length;
const text = (row: ReturnType<typeof layoutCodeLines>[number]) =>
  row.segments.map((s) => s.text).join("");
describe("code image wrapping", () => {
  it("keeps source line numbers, empty lines, spaces and token colors", () => {
    const source = [
      { text: "const ", type: "keyword" },
      { text: "value\n\n  end", type: "string" },
    ];
    const before = JSON.stringify(source);
    const rows = layoutCodeLines(splitSegments(source), 4, true, measure);
    expect(rows.map(text)).toEqual(["cons", "t va", "lue", "", "  en", "d"]);
    expect(rows.map((row) => row.lineNumber)).toEqual([
      1,
      null,
      null,
      2,
      3,
      null,
    ]);
    expect(rows[1].segments).toEqual([
      { text: "t ", type: "keyword" },
      { text: "va", type: "string" },
    ]);
    expect(JSON.stringify(source)).toBe(before);
  });
  it("does not split emoji sequences or combining characters", () => {
    const rows = layoutCodeLines(
      [[{ text: "中👨‍👩‍👧‍👦e\u0301🇨🇳", type: "string" }]],
      1,
      true,
      measure,
    );
    expect(rows.map(text)).toEqual(["中", "👨‍👩‍👧‍👦", "e\u0301", "🇨🇳"]);
  });
  it("preserves a grapheme crossing token boundaries", () => {
    expect(
      layoutCodeLines(
        [
          [
            { text: "e", type: "keyword" },
            { text: "\u0301x", type: "string" },
          ],
        ],
        1,
        true,
        measure,
      ).map(text),
    ).toEqual(["e\u0301", "x"]);
  });
  it("does not add a row at an exact fit", () => {
    expect(
      layoutCodeLines([[{ text: "abcd", type: "" }]], 4, true, measure).map(
        text,
      ),
    ).toEqual(["abcd"]);
  });
  it("rejects overflow when wrapping is disabled and identifies the source line", () => {
    expect(() =>
      layoutCodeLines(
        splitSegments([{ text: "ok\nlonger", type: "" }]),
        4,
        false,
        measure,
      ),
    ).toThrow("第 2 行");
  });
  it("rejects widths too narrow for a complete character", () => {
    expect(() =>
      layoutCodeLines([[{ text: "中", type: "" }]], 1, true, () => 2),
    ).toThrow("字符");
  });
  it("creates a sortable local timestamp filename with milliseconds", () => {
    expect(imageFilename(new Date(2026, 8, 18, 9, 5, 2, 7))).toBe(
      "wind-code-20260918-090502-007.png",
    );
  });
});

it("moves a complete identifier to the next row when it fits", () => {
  const rows = layoutCodeLines(
    [[{ text: "let variable = 1;", type: "" }]],
    10,
    true,
    measure,
  );
  expect(rows.map(text)).toEqual(["let ", "variable =", " 1;"]);
  expect(rows.map(text).join("")).toBe("let variable = 1;");
});
