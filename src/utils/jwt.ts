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
    throw new Error(
      `JWT 解码失败：${error instanceof Error ? error.message : "编码或 JSON 无效"}`,
    );
  }
  const times = ["exp", "iat", "nbf"].map((key) => {
    const value = payload.value[key];
    if (value === undefined)
      return `${key}：未提供${key === "exp" ? "过期时间" : ""}`;
    if (
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      !Number.isFinite(new Date(value * 1000).getTime())
    )
      return `${key}：时间字段无效`;
    return `${key}：${new Date(value * 1000).toISOString()}${key === "exp" ? (now >= value * 1000 ? " · 已过期" : " · 未到过期时间") : key === "nbf" && now < value * 1000 ? " · 尚未生效" : ""}`;
  });
  return `Header\n${header.formatted}\n\nPayload\n${payload.formatted}\n\n时间信息（基于设备时钟）\n${times.join("\n")}\n\n⚠ 签名未经验证，以上结果不代表 Token 有效。`;
}
