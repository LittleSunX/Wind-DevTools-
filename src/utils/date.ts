export function renderDate(date: Date, zone: string) {
  if (!Number.isFinite(date.getTime())) throw new Error("日期超出支持范围。");
  return zone === "UTC"
    ? date.toISOString()
    : `${date.toLocaleString("zh-CN", { hour12: false })}（${Intl.DateTimeFormat().resolvedOptions().timeZone}，UTC${date.getTimezoneOffset() <= 0 ? "+" : "-"}${String(Math.floor(Math.abs(date.getTimezoneOffset()) / 60)).padStart(2, "0")}:${String(Math.abs(date.getTimezoneOffset()) % 60).padStart(2, "0")}）`;
}
