import { describe, expect, it } from "vitest";
import {
  canvasTransferKey,
  createCanvasTransfer,
  readCanvasTransfer,
  writeCanvasTransfer,
} from "../src/utils/canvas-transfer";

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
  };
}

describe("canvas transfer", () => {
  it("maps tool results to a useful canvas language and title", () => {
    expect(createCanvasTransfer("json", '{"ok":true}')).toMatchObject({
      language: "json",
      title: "data.json",
      sourceTool: "json",
    });
    expect(createCanvasTransfer("sql", "select 1")).toMatchObject({
      language: "sql",
      title: "query.sql",
    });
    expect(createCanvasTransfer("jwt", "Header")).toMatchObject({
      language: "plain",
      title: "jwt.txt",
    });
  });

  it("writes and consumes a transfer once", () => {
    const storage = memoryStorage();
    const payload = createCanvasTransfer("sql", "SELECT 1;");
    expect(payload).not.toBeNull();
    writeCanvasTransfer(storage, payload!);
    expect(storage.getItem(canvasTransferKey)).toContain("SELECT 1");
    expect(readCanvasTransfer(storage)).toEqual(payload);
    expect(readCanvasTransfer(storage)).toBeNull();
  });

  it("rejects empty or unsupported transfers and clears malformed data", () => {
    expect(createCanvasTransfer("unknown", "x")).toBeNull();
    expect(createCanvasTransfer("json", "   ")).toBeNull();

    const storage = memoryStorage();
    storage.setItem(canvasTransferKey, "{");
    expect(readCanvasTransfer(storage)).toBeNull();
    expect(storage.getItem(canvasTransferKey)).toBeNull();
  });
});
