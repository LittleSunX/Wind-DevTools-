import { tr } from "../i18n";
import type { Options } from "./shared";
import { renderDate } from "./date";
export function timestampTool(input: string, options: Options) {
  const zone = options.zone || "UTC";
  let date: Date;
  if (options.direction === "date") {
    const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(
      input.trim(),
    );
    if (!match) throw new Error("请输入 YYYY-MM-DD HH:mm:ss 格式的日期。");
    const [y, m, d, h, mi, se] = match.slice(1).map(Number);
    date = new Date(0);
    if (zone === "UTC") {
      date.setUTCFullYear(y, m - 1, d);
      date.setUTCHours(h, mi, se, 0);
    } else {
      date.setFullYear(y, m - 1, d);
      date.setHours(h, mi, se, 0);
    }
    const parts =
      zone === "UTC"
        ? [
            date.getUTCFullYear(),
            date.getUTCMonth() + 1,
            date.getUTCDate(),
            date.getUTCHours(),
            date.getUTCMinutes(),
            date.getUTCSeconds(),
          ]
        : [
            date.getFullYear(),
            date.getMonth() + 1,
            date.getDate(),
            date.getHours(),
            date.getMinutes(),
            date.getSeconds(),
          ];
    if (parts.some((v, i) => v !== [y, m, d, h, mi, se][i]))
      throw new Error("日期无效，或该本地时间因夏令时不存在。");
    if (zone !== "UTC") {
      for (let delta = -180; delta <= 180; delta++) {
        if (!delta) continue;
        const other = new Date(date.getTime() + delta * 60000);
        if (
          other.getFullYear() === y &&
          other.getMonth() === m - 1 &&
          other.getDate() === d &&
          other.getHours() === h &&
          other.getMinutes() === mi &&
          other.getSeconds() === se
        )
          throw new Error("该本地时间因夏令时存在歧义，请切换 UTC。");
      }
    }
  } else {
    if (!/^-?\d+$/.test(input.trim())) throw new Error("时间戳必须是整数。");
    const value = Number(input);
    if (!Number.isSafeInteger(value))
      throw new Error("时间戳超出安全整数范围。");
    date = new Date(value * (options.unit === "s" ? 1000 : 1));
  }
  return `${tr("日期时间")}\n${renderDate(date, zone)}\n\nISO 8601\n${date.toISOString()}\n\n${tr("秒级时间戳")}\n${Math.floor(date.getTime() / 1000)}\n\n${tr("毫秒级时间戳")}\n${date.getTime()}`;
}
