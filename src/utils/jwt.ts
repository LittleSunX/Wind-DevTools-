import { MessageError, errorMessage, tr } from "../i18n";
import { jsonTool } from "./json";
function decodePart(part: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(part))
    throw new Error("JWT 包含非法 Base64URL 字符。");
  const bytes = Uint8Array.from(
    atob(part.replace(/-/g, "+").replace(/_/g, "/")),
    (c) => c.charCodeAt(0),
  );
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  const formatted = jsonTool(text, {});
  const result = JSON.parse(text);
  if (!result || typeof result !== "object" || Array.isArray(result))
    throw new Error("JWT Header 和 Payload 必须是 JSON 对象。");
  return { value: result as Record<string, unknown>, formatted };
}
export function jwtTool(input: string, now = Date.now()) {
  const parts = input.trim().split(".");
  if (parts.length === 5) throw new Error("暂不支持五段式加密 Token（JWE）。");
  if (
    parts.length !== 3 ||
    !parts[0] ||
    !parts[1] ||
    !/^[A-Za-z0-9_-]*$/.test(parts[2])
  )
    throw new Error("请输入三段式 JWT。");
  let header, payload;
  try {
    header = decodePart(parts[0]);
    payload = decodePart(parts[1]);
  } catch (error) {
    const detail = errorMessage(error, "编码或 JSON 无效");
    throw new MessageError({
      key: "JWT 解码失败：{{detail}}",
      values: { detail: typeof detail === "string" ? { key: detail } : detail },
    });
  }
  const times = ["exp", "iat", "nbf"].map((key) => {
    const value = payload.value[key];
    if (value === undefined)
      return tr(key === "exp" ? "{{key}}：未提供过期时间" : "{{key}}：未提供", {
        key,
      });
    if (
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      !Number.isFinite(new Date(value * 1000).getTime())
    )
      return tr("{{key}}：时间字段无效", { key });
    return `${key}：${new Date(value * 1000).toISOString()}${key === "exp" ? (now >= value * 1000 ? tr(" · 已过期") : tr(" · 未到过期时间")) : key === "nbf" && now < value * 1000 ? tr(" · 尚未生效") : ""}`;
  });
  return `Header\n${header.formatted}\n\nPayload\n${payload.formatted}\n\n${tr("时间信息（基于设备时钟）")}\n${times.join("\n")}\n\n${tr("⚠ 签名未经验证，以上结果不代表 Token 有效。")}`;
}
