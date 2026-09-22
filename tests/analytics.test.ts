import { describe, it, expect } from "vitest";
import { sanitizeAnalytics } from "../src/analytics";

describe("analytics whitelist", () => {
  it("discards free-form input, errors, query strings and referrer paths", () => {
    const safe = sanitizeAnalytics(
      {
        website: "public-id",
        hostname: "tools.test",
        url: "/tools/json?token=SECRET",
        title: "SECRET",
        referrer: "https://source.test/private?secret=SECRET",
        input: "SECRET",
        data: {
          tool: "json",
          action: "format",
          status: "error",
          error: "SECRET",
          result: "SECRET",
        },
      },
      "/tools/json",
    );
    expect(JSON.stringify(safe)).not.toContain("SECRET");
    expect(safe.url).toBe("/tools/json");
    expect(safe.referrer).toBe("https://source.test");
    expect(safe.data).toEqual({
      tool: "json",
      action: "format",
      status: "error",
    });
  });

  it("keeps English SEO routes distinct from Chinese routes", () => {
    expect(sanitizeAnalytics({}, "/en/tools/json")).toMatchObject({
      url: "/en/tools/json",
      title: "JSON Formatter | Wind DevTools",
    });
    expect(sanitizeAnalytics({}, "/en/tools/")).toEqual({
      url: "/en/tools",
      title: "Wind DevTools",
    });
    expect(sanitizeAnalytics({}, "/en")).toEqual({
      url: "/en/tools",
      title: "Wind DevTools",
    });
  });

  it("reduces arbitrary unknown paths to fixed localized 404 routes", () => {
    expect(sanitizeAnalytics({}, "/SECRET")).toEqual({
      url: "/404",
      title: "Wind DevTools",
    });
    expect(sanitizeAnalytics({}, "/en/SECRET")).toEqual({
      url: "/en/404",
      title: "Wind DevTools",
    });
  });

  it("includes only enumerated error categories", () =>
    expect(
      sanitizeAnalytics(
        {
          data: {
            tool: "cron",
            action: "parse",
            status: "error",
            error: "timeout",
          },
        },
        "/tools/cron",
      ).data,
    ).toEqual({
      tool: "cron",
      action: "parse",
      status: "error",
      error: "timeout",
    }));
});
