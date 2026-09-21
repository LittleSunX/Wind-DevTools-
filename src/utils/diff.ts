export type DiffKind = "same" | "add" | "remove";
export type DiffLine = { kind: DiffKind; text: string; left?: number; right?: number };

export function diffLines(leftText: string, rightText: string): DiffLine[] {
  const left = leftText.replace(/\r\n?/g, "\n").split("\n");
  const right = rightText.replace(/\r\n?/g, "\n").split("\n");
  if (left.length > 1200 || right.length > 1200)
    throw new Error("Diff 单侧最多支持 1,200 行，请拆分后比较。");

  const cols = right.length + 1;
  const dp = new Uint16Array((left.length + 1) * cols);
  for (let i = left.length - 1; i >= 0; i--) {
    for (let j = right.length - 1; j >= 0; j--) {
      const idx = i * cols + j;
      dp[idx] =
        left[i] === right[j]
          ? dp[(i + 1) * cols + j + 1] + 1
          : Math.max(dp[(i + 1) * cols + j], dp[i * cols + j + 1]);
    }
  }

  const result: DiffLine[] = [];
  let i = 0, j = 0, leftNo = 1, rightNo = 1;
  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) {
      result.push({ kind: "same", text: left[i], left: leftNo++, right: rightNo++ });
      i++; j++;
    } else if (dp[(i + 1) * cols + j] >= dp[i * cols + j + 1]) {
      result.push({ kind: "remove", text: left[i++], left: leftNo++ });
    } else {
      result.push({ kind: "add", text: right[j++], right: rightNo++ });
    }
  }
  while (i < left.length) result.push({ kind: "remove", text: left[i++], left: leftNo++ });
  while (j < right.length) result.push({ kind: "add", text: right[j++], right: rightNo++ });
  return result;
}

export function formatUnifiedDiff(lines: DiffLine[]) {
  return lines
    .map((line) => `${line.kind === "add" ? "+" : line.kind === "remove" ? "-" : " "} ${line.text}`)
    .join("\n");
}
