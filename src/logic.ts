// Synchronous facade for tests and non-browser consumers. The Worker loads each tool separately.
import { checkInput, type Options } from "./utils/shared";
import { jsonTool } from "./utils/json";
import { timestampTool } from "./utils/timestamp";
import { jwtTool } from "./utils/jwt";
import { sqlTool } from "./utils/sql";
import { cronTool } from "./utils/cron";
import { codecTool } from "./utils/codec";
import { jsonTypeTool } from "./utils/json-type";
import { textTool } from "./utils/text";
export { checkInput, MAX_BYTES, type Options } from "./utils/shared";
export { jsonTool } from "./utils/json";
export { timestampTool } from "./utils/timestamp";
export { jwtTool } from "./utils/jwt";
export { cronTool, normalizeCron } from "./utils/cron";
export { codecTool } from "./utils/codec";
export { jsonTypeTool } from "./utils/json-type";
export { textTool } from "./utils/text";
export function processTool(id: string, input: string, options: Options) {
  checkInput(input);
  switch (id) {
    case "json":
      return jsonTool(input, options);
    case "timestamp":
      return timestampTool(input, options);
    case "jwt":
      return jwtTool(input);
    case "sql":
      return sqlTool(input, options);
    case "cron":
      return cronTool(input, options);
    case "codec":
      return codecTool(input, options);
    case "json-type":
      return jsonTypeTool(input, options);
    case "text":
      return textTool(input, options);
    default:
      throw new Error("未知工具。");
  }
}
