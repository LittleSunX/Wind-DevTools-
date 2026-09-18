import { describe, it, expect } from "vitest";
import { defaults } from "../src/utils/code-image";
import {
  readPreferences,
  writePreferences,
  sanitizePreferences,
} from "../src/utils/canvas-preferences";
describe("canvas appearance preferences", () => {
  it("stores appearance only, never source or window titles", () => {
    let saved = "";
    writePreferences(
      {
        setItem: (_key, value) => {
          saved = value;
        },
      },
      {
        ...defaults,
        title: "PRIVATE_TITLE",
        code: "PRIVATE_CODE",
      } as typeof defaults,
    );
    expect(saved).not.toContain("PRIVATE");
    expect(JSON.parse(saved).theme).toBe(defaults.theme);
  });
  it("validates all stored values and ignores unknown keys", () => {
    expect(
      sanitizePreferences({
        theme: "evil",
        width: NaN,
        padding: 500,
        fontSize: 0,
        lineNumbers: "yes",
        code: "x",
        title: "y",
        scale: 2,
        wrap: false,
      }),
    ).toEqual({ scale: 2, wrap: false });
    expect(
      sanitizePreferences({ width: 721, color: "#aBcD12", widthMode: "fixed" }),
    ).toEqual({ width: 721, color: "#aBcD12", widthMode: "fixed" });
  });
  it("recovers from corrupted, blocked or full storage", () => {
    expect(readPreferences({ getItem: () => "{" })).toEqual(defaults);
    expect(
      readPreferences({
        getItem: () => {
          throw new Error("blocked");
        },
      }),
    ).toEqual(defaults);
    expect(() =>
      writePreferences(
        {
          setItem: () => {
            throw new Error("full");
          },
        },
        defaults,
      ),
    ).not.toThrow();
  });
});
