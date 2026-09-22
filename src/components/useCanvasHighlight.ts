import { useEffect, useState } from "react";
import { validateCode, type Segment } from "../utils/code-image";

type HighlightResponse =
  { segments: Segment[]; error?: never } | { error: string; segments?: never };

export function useCanvasHighlight(code: string, language: string) {
  const [tokens, setTokens] = useState<{
    code: string;
    language: string;
    segments: Segment[];
  } | null>(null);
  const [issue, setIssue] = useState<{
    code: string;
    language: string;
    message: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    let worker: Worker | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      validateCode(code);
    } catch {
      return;
    }
    const debounce = setTimeout(() => {
      try {
        worker = new Worker(
          new URL("../code-image.worker.ts", import.meta.url),
          {
            type: "module",
          },
        );
        worker.onmessage = (event: MessageEvent<HighlightResponse>) => {
          if (cancelled) return;
          clearTimeout(timeout);
          worker?.terminate();
          if (event.data.error)
            setIssue({ code, language, message: event.data.error });
          else if (event.data.segments) {
            setIssue({ code, language, message: "" });
            setTokens({ code, language, segments: event.data.segments });
          }
        };
        worker.onerror = () => {
          if (cancelled) return;
          clearTimeout(timeout);
          worker?.terminate();
          setIssue({
            code,
            language,
            message: "语法高亮失败，请尝试纯文本模式。",
          });
        };
        worker.postMessage({ code, language });
        timeout = setTimeout(() => {
          cancelled = true;
          worker?.terminate();
          setIssue({
            code,
            language,
            message: "高亮超过 3 秒，请精简代码或使用纯文本模式。",
          });
        }, 3000);
      } catch {
        if (!cancelled)
          setIssue({
            code,
            language,
            message: "无法启动语法高亮，请检查浏览器设置。",
          });
      }
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(debounce);
      clearTimeout(timeout);
      worker?.terminate();
    };
  }, [code, language]);

  const highlighted = tokens?.code === code && tokens.language === language;
  return {
    segments: highlighted ? tokens.segments : [{ text: code, type: "" }],
    highlighted,
    error:
      issue?.code === code && issue.language === language ? issue.message : "",
    tokens,
  };
}
