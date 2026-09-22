import { MessageError, tr } from "../i18n";
import { CronExpressionParser } from "cron-parser";
import type { Options } from "./shared";
import { renderDate } from "./date";
export function normalizeCron(input: string, mode: string) {
  const fields = input.trim().split(/\s+/);
  if (fields.length !== (mode === "linux" ? 5 : 6))
    throw new Error(
      mode === "linux"
        ? "Linux 需要 5 个字段。"
        : "Quartz 需要 6 个字段，暂不支持年份。",
    );
  if (fields.some((f) => !/^[0-9*?,/\-]+$/.test(f)))
    throw new Error(
      "仅支持数字、*、?、范围、列表和步长；不支持名称、L、W、#。",
    );
  if (mode === "linux") {
    if (input.includes("?")) throw new Error("Linux 模式不支持 ?。");
    return input;
  }
  const [sec, min, hour, day, month, week] = fields;
  if (
    fields.some(
      (f, i) => f.includes("?") && !((i === 3 || i === 5) && f === "?"),
    )
  )
    throw new Error("? 只能单独用于日或周字段。");
  if ((day === "?") === (week === "?"))
    throw new Error("Quartz 的日和周字段必须有且仅有一个为 ?。");
  // Expand Quartz weekday values before mapping 1..7 to the parser’s 0..6.
  let mapped = week;
  if (week !== "?") {
    const values = new Set<number>();
    for (const item of week.split(",")) {
      const match = /^(\*|[1-7](?:-[1-7])?)(?:\/([1-7]))?$/.exec(item);
      if (!match) throw new Error("Quartz 星期范围为 1（周日）至 7（周六）。");
      const step = Number(match[2] || 1);
      const base = match[1];
      const bounds =
        base === "*"
          ? [1, 7]
          : base.includes("-")
            ? base.split("-").map(Number)
            : [Number(base), match[2] ? 7 : Number(base)];
      if (bounds[0] > bounds[1]) throw new Error("星期范围起点不能大于终点。");
      for (let n = bounds[0]; n <= bounds[1]; n += step) values.add(n - 1);
    }
    mapped = [...values].sort().join(",");
  }
  return [
    sec,
    min,
    hour,
    day === "?" ? "*" : day,
    month,
    mapped === "?" ? "*" : mapped,
  ].join(" ");
}
export function cronTool(input: string, options: Options, now = new Date()) {
  const mode = options.mode || "quartz";
  const expression = normalizeCron(input, mode);
  const zone =
    options.zone === "local"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : "UTC";
  const end = new Date(now);
  end.setUTCFullYear(end.getUTCFullYear() + 5);
  let interval;
  try {
    interval = CronExpressionParser.parse(expression, {
      currentDate: now,
      endDate: end,
      tz: zone,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Invalid explicit day of month definition"
    )
      return tr(
        "指定的月份与日期组合不存在，未来 5 年搜索范围内未找到执行时间。",
      );
    throw new MessageError({
      key: "Cron 表达式无效：{{detail}}",
      values: {
        detail:
          error instanceof Error ? error.message : { key: "请检查字段范围" },
      },
    });
  }
  const dates: string[] = [];
  for (let i = 0; i < 5; i++) {
    try {
      dates.push(
        renderDate(interval.next().toDate(), zone === "UTC" ? "UTC" : "local"),
      );
    } catch {
      break;
    }
  }
  const labels =
    mode === "linux"
      ? ["分", "时", "日", "月", "周"]
      : ["秒", "分", "时", "日", "月", "周"];
  const desc = input
    .trim()
    .split(/\s+/)
    .map(
      (v, i) =>
        `${tr(labels[i])}：${v === "*" ? tr("每个值") : v === "?" ? tr("不指定") : v.startsWith("*/") ? tr("每 {{step}} 个单位", { step: v.slice(2) }) : v}`,
    )
    .join(" · ");
  return `${mode === "linux" ? tr("Linux · 5 字段") : tr("Quartz · 6 字段")}\n${desc}\n\n${tr("计算基准")}：${now.toISOString()}\n${tr("时区")}：${zone}\n\n${tr("未来执行时间")}\n${dates.length ? dates.map((d, i) => `${i + 1}. ${d}`).join("\n") : tr("未来 5 年搜索范围内未找到执行时间。")}${dates.length > 0 && dates.length < 5 ? tr("\n搜索范围内不足 5 次。") : ""}${zone !== "UTC" ? tr("\n\n本地时区可能受夏令时影响。") : ""}`;
}
