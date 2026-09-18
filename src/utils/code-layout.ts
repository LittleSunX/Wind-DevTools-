import type { Segment } from "./code-image";

export type CodeRow = { segments: Segment[]; lineNumber: number | null };

/** Layout only: never insert line breaks into the source or split a grapheme. */
export function layoutCodeLines(
  lines: Segment[][],
  availableWidth: number,
  wrap: boolean,
  measure: (text: string) => number,
): CodeRow[] {
  if (availableWidth <= 0)
    throw new Error("画布宽度不足，请增加宽度或减少外边距。");
  const rows: CodeRow[] = [];
  const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  lines.forEach((line, index) => {
    if (!wrap) {
      if (
        line.reduce((sum, segment) => sum + measure(segment.text), 0) >
        availableWidth
      )
        throw new Error(
          `第 ${index + 1} 行超出画布宽度，请开启长行换行、增加宽度或缩小字号。`,
        );
      rows.push({ segments: line, lineNumber: index + 1 });
      return;
    }
    let row: CodeRow = { segments: [], lineNumber: index + 1 };
    let width = 0;
    let token = 0;
    let tokenEnd = line[0]?.text.length || 0;
    const source = line.map((segment) => segment.text).join("");
    for (const { segment: text, index: offset } of graphemes.segment(source)) {
      while (offset >= tokenEnd && token < line.length - 1)
        tokenEnd += line[++token].text.length;
      const type = line[token].type;
      // Prefer keeping an identifier whole when it fits on a fresh row.
      if (
        (offset === 0 || !/[\p{L}\p{N}_$]/u.test(source[offset - 1])) &&
        row.segments.some((s) => /\S/.test(s.text))
      ) {
        const word = source.slice(offset).match(/^[\p{L}\p{N}_$]+/u)?.[0];
        if (word) {
          let start = 0;
          const wordWidth = line.reduce((sum, segment) => {
            const end = start + segment.text.length;
            const part = segment.text.slice(
              Math.max(0, offset - start),
              Math.max(0, Math.min(end, offset + word.length) - start),
            );
            start = end;
            return sum + measure(part);
          }, 0);
          if (
            wordWidth <= availableWidth &&
            width + wordWidth > availableWidth
          ) {
            rows.push(row);
            row = { segments: [], lineNumber: null };
            width = 0;
          }
        }
      }
      let previous = row.segments.at(-1);
      let delta =
        previous?.type === type
          ? measure(previous.text + text) - measure(previous.text)
          : measure(text);
      if (width + delta > availableWidth && row.segments.length) {
        rows.push(row);
        row = { segments: [], lineNumber: null };
        width = 0;
        previous = undefined;
        delta = measure(text);
      }
      if (delta > availableWidth)
        throw new Error("画布宽度不足以容纳字符，请增加宽度或缩小字号。");
      if (previous?.type === type) previous.text += text;
      else row.segments.push({ text, type });
      width += delta;
    }
    rows.push(row);
  });
  return rows;
}
