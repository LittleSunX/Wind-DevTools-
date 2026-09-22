import { i18n, resolveLanguage, errorMessage } from "./i18n";
import { checkInput, type Options } from "./utils/shared";
self.onmessage = async (
  event: MessageEvent<{
    id: string;
    input: string;
    options: Options;
    language?: string;
  }>,
) => {
  const { id, input, options } = event.data;
  await i18n.changeLanguage(resolveLanguage(event.data.language ?? null, []));
  try {
    checkInput(input);
    let result: string;
    switch (id) {
      case "json":
        result = (await import("./utils/json")).jsonTool(input, options);
        break;
      case "timestamp":
        result = (await import("./utils/timestamp")).timestampTool(
          input,
          options,
        );
        break;
      case "jwt":
        result = (await import("./utils/jwt")).jwtTool(input);
        break;
      case "sql":
        result = (await import("./utils/sql")).sqlTool(input, options);
        break;
      case "cron":
        result = (await import("./utils/cron")).cronTool(input, options);
        break;
      case "codec":
        result = (await import("./utils/codec")).codecTool(input, options);
        break;
      case "json-type":
        result = (await import("./utils/json-type")).jsonTypeTool(
          input,
          options,
        );
        break;
      case "text":
        result = (await import("./utils/text")).textTool(input, options);
        break;
      default:
        throw new Error("未知工具。");
    }
    self.postMessage({ result });
  } catch (error) {
    self.postMessage({
      error: errorMessage(error),
    });
  }
};
