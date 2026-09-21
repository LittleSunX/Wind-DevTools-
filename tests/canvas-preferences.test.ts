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
        fontFamily: "remote-url",
        lineHeight: -1,
        lineNumbers: "yes",
        code: "x",
        title: "y",
        scale: 2,
        wrap: false,
      }),
    ).toEqual({ scale: 2, wrap: false });
    expect(
      sanitizePreferences({
        width: 721,
        color: "#aBcD12",
        widthMode: "fixed",
        windowRadius: 18,
        shadow: "strong",
        windowStyle: "minimal",
        codePadding: 40,
        aspectRatio: "16:9",
        gradientStart: "#123456",
        gradientEnd: "#abcdef",
        gradientAngle: 210,
        startLine: 100,
        highlightLines: "101,103-105",
      }),
    ).toEqual({
      width: 721,
      color: "#aBcD12",
      widthMode: "fixed",
      windowRadius: 18,
      shadow: "strong",
      windowStyle: "minimal",
      codePadding: 40,
      aspectRatio: "16:9",
      gradientStart: "#123456",
      gradientEnd: "#abcdef",
      gradientAngle: 210,
      startLine: 100,
      highlightLines: "101,103-105",
    });
  });
  it("restores typography while older preferences receive safe defaults", () => {
    expect(
      readPreferences({ getItem: () => JSON.stringify({ theme: "light" }) })
        .fontFamily,
    ).toBe("jetbrains");
    expect(
      readPreferences({
        getItem: () =>
          JSON.stringify({
            fontFamily: "source",
            lineHeight: 1.4,
            theme: "paper",
          }),
      }),
    ).toMatchObject({ fontFamily: "source", lineHeight: 1.4, theme: "paper" });
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
