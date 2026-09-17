import type { Segment } from "./utils/code-image";
(globalThis as unknown as { Prism: object }).Prism = {
  disableWorkerMessageHandler: true,
  manual: true,
};
self.onmessage = async (
  event: MessageEvent<{ code: string; language: string }>,
) => {
  try {
    const { highlightCode } = await import("./utils/code-highlight");
    const segments: Segment[] = highlightCode(
      event.data.code,
      event.data.language,
    );
    self.postMessage({ segments });
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : "语法高亮失败。",
    });
  }
};
