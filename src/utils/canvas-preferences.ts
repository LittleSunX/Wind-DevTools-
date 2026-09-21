import { defaults, type ImageOptions } from "./code-image";
export const preferenceKey = "wind.canvas.preferences.v1";
// Only appearance enums/numbers are persisted; never source text or window titles.
export function sanitizePreferences(value: unknown): Partial<ImageOptions> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const data = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  const enums: Record<string, readonly unknown[]> = {
    theme: ["night", "graphite", "light", "forest", "paper"],
    background: ["blue", "sunset", "slate", "solid", "transparent"],
    fontFamily: ["jetbrains", "source", "system"],
    lineHeight: [1.4, 1.65, 1.9],
    fontSize: [14, 16, 18, 20, 24],
    padding: [16, 32, 48, 64],
    scale: [1, 2, 3],
    widthMode: ["auto", "fixed"],
    windowRadius: [0, 8, 12, 18],
    shadow: ["none", "soft", "strong"],
  };
  for (const [key, allowed] of Object.entries(enums))
    if (allowed.includes(data[key])) result[key] = data[key];
  for (const key of ["lineNumbers", "windowBar", "wrap"])
    if (typeof data[key] === "boolean") result[key] = data[key];
  if (typeof data.color === "string" && /^#[\da-f]{6}$/i.test(data.color))
    result.color = data.color;
  if (
    typeof data.width === "number" &&
    Number.isInteger(data.width) &&
    data.width >= 320 &&
    data.width <= 2400
  )
    result.width = data.width;
  return result;
}
export function readPreferences(
  storage: Pick<Storage, "getItem">,
): ImageOptions {
  try {
    return {
      ...defaults,
      ...sanitizePreferences(
        JSON.parse(storage.getItem(preferenceKey) || "null"),
      ),
    };
  } catch {
    return { ...defaults };
  }
}
export function writePreferences(
  storage: Pick<Storage, "setItem">,
  options: ImageOptions,
) {
  try {
    storage.setItem(
      preferenceKey,
      JSON.stringify(sanitizePreferences(options)),
    );
  } catch {
    /* Storage can be disabled or full. */
  }
}
