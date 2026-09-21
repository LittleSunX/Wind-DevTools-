export type CanvasTransferPayload = {
  code: string;
  language: string;
  title: string;
  sourceTool: string;
};

export const canvasTransferKey = "wind.canvas.transfer.v1";

const transferByTool: Record<
  string,
  Pick<CanvasTransferPayload, "language" | "title">
> = {
  json: { language: "json", title: "data.json" },
  sql: { language: "sql", title: "query.sql" },
  jwt: { language: "plain", title: "jwt.txt" },
  cron: { language: "plain", title: "cron.txt" },
  timestamp: { language: "plain", title: "timestamp.txt" },
  codec: { language: "plain", title: "encoded.txt" },
  text: { language: "plain", title: "text.txt" },
  "json-type": { language: "plain", title: "types.txt" },
};

export function createCanvasTransfer(
  sourceTool: string,
  code: string,
): CanvasTransferPayload | null {
  const preset = transferByTool[sourceTool];
  if (!preset || !code.trim()) return null;
  return {
    code,
    language: preset.language,
    title: preset.title,
    sourceTool,
  };
}

export function writeCanvasTransfer(
  storage: Pick<Storage, "setItem">,
  payload: CanvasTransferPayload,
) {
  storage.setItem(canvasTransferKey, JSON.stringify(payload));
}

export function readCanvasTransfer(
  storage: Pick<Storage, "getItem" | "removeItem">,
): CanvasTransferPayload | null {
  try {
    const raw = storage.getItem(canvasTransferKey);
    if (!raw) return null;
    storage.removeItem(canvasTransferKey);
    const value = JSON.parse(raw) as Partial<CanvasTransferPayload>;
    if (
      typeof value.code !== "string" ||
      typeof value.language !== "string" ||
      typeof value.title !== "string" ||
      typeof value.sourceTool !== "string"
    )
      return null;
    return {
      code: value.code,
      language: value.language,
      title: value.title.slice(0, 80),
      sourceTool: value.sourceTool,
    };
  } catch {
    try {
      storage.removeItem(canvasTransferKey);
    } catch {
      /* Optional storage. */
    }
    return null;
  }
}
