import { expect, it } from "vitest";
import { downloadFilename } from "../src/utils/download-filename";

it("keeps tool names and extensions while adding a sortable local timestamp", () => {
  const date = new Date(2026, 8, 23, 10, 38, 27, 114);
  expect(downloadFilename("wind-json", "json", date)).toBe(
    "wind-json-20260923-103827-114.json",
  );
  expect(downloadFilename("wind-sql", "sql", date)).toBe(
    "wind-sql-20260923-103827-114.sql",
  );
  expect(downloadFilename("wind-cron", "txt", date)).toBe(
    "wind-cron-20260923-103827-114.txt",
  );
});
