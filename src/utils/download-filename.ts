// Use the browser's local time so downloads sort in the order users see them.
export function downloadFilename(
  stem: string,
  extension: string,
  date = new Date(),
) {
  const pad = (value: number, length = 2) =>
    String(value).padStart(length, "0");
  return `${stem}-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}-${pad(date.getMilliseconds(), 3)}.${extension}`;
}
