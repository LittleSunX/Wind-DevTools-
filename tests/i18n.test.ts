import { afterEach, describe, expect, it } from "vitest";
import {
  errorMessage,
  i18n,
  MessageError,
  resolveLanguage,
  tr,
} from "../src/i18n";
import en from "../src/i18n/locales/en.json";
import zh from "../src/i18n/locales/zh.json";
import { jsonTool } from "../src/utils/json";
import { localizedPath, parseLocalizedPath } from "../src/i18n/routing";

afterEach(() => i18n.changeLanguage("zh"));
describe("internationalization", () => {
  it("prefers a valid saved language and normalizes browser locales", () => {
    expect(resolveLanguage("zh", ["en-US"])).toBe("zh");
    expect(resolveLanguage("invalid", ["fr-FR", "en-GB"])).toBe("en");
    expect(resolveLanguage(null, ["zh-TW", "en"])).toBe("zh");
    expect(resolveLanguage(null, ["fr"])).toBe("zh");
  });
  it("maps stable Chinese routes to English SEO routes", () => {
    expect(parseLocalizedPath("/tools/json")).toEqual({
      language: "zh",
      path: "/tools/json",
    });
    expect(parseLocalizedPath("/en/tools/json")).toEqual({
      language: "en",
      path: "/tools/json",
    });
    expect(parseLocalizedPath("/en")).toEqual({
      language: "en",
      path: "/tools",
    });
    expect(localizedPath("/tools/json", "zh")).toBe("/tools/json");
    expect(localizedPath("/tools/json", "en")).toBe("/en/tools/json");
    expect(localizedPath("/", "en")).toBe("/en/tools");
  });
  it("keeps translation keys and interpolation variables aligned", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(zh).sort());
    for (const key of Object.keys(zh) as (keyof typeof zh)[]) {
      const variables = (text: string) =>
        [...text.matchAll(/{{(.*?)}}/g)].map((m) => m[1]).sort();
      expect(variables(en[key]), key).toEqual(variables(zh[key]));
      expect(en[key], key).not.toMatch(/\p{Script=Han}/u);
    }
  });
  it("uses English plurals and Chinese fallback for missing translations", async () => {
    await i18n.changeLanguage("en");
    expect(tr("{{count}} 个工具", { count: 1 })).toBe("1 tool");
    expect(tr("{{count}} 个工具", { count: 2 })).toBe("2 tools");
    i18n.addResource("zh", "translation", "fallback-test", "中文回退");
    expect(tr("fallback-test")).toBe("中文回退");
  });
  it("retranslates structured errors without translating user keys", async () => {
    const key = "代码 {{name}} <tag>";
    let message;
    try {
      jsonTool(`{"${key}":1,"${key}":2}`, {});
    } catch (error) {
      message = structuredClone(errorMessage(error));
    }
    expect(tr(message)).toContain(`「${key}」`);
    await i18n.changeLanguage("en");
    expect(tr(message)).toBe(
      `Duplicate key “${key}”. Correct it before converting.`,
    );
    expect(
      tr({ key: "JWT 解码失败：{{detail}}", values: { detail: message! } }),
    ).toContain("JWT decoding failed: Duplicate key");
  });
  it("keeps JSON content identical across languages", async () => {
    const input = '{"代码":"工具箱", "large":90071992547409931234}';
    const before = jsonTool(input, {});
    await i18n.changeLanguage("en");
    expect(jsonTool(input, {})).toBe(before);
    expect(
      new MessageError({
        key: "JSON 语法错误：{{detail}}",
        values: { detail: "raw error" },
      }).message,
    ).toContain("JSON 语法错误");
  });
});
