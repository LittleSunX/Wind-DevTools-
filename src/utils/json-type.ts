import { jsonTool } from "./json";
import type { Options } from "./shared";

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

function parseJson(input: string): JsonValue {
  jsonTool(input, { action: "validate" });
  return JSON.parse(input) as JsonValue;
}

function safeIdentifier(name: string) {
  const cleaned = name.replace(/[^A-Za-z0-9_$]/g, "_");
  return /^[A-Za-z_$]/.test(cleaned) ? cleaned : `_${cleaned}`;
}

function titleCase(name: string) {
  const id = safeIdentifier(name || "Root");
  return id.charAt(0).toUpperCase() + id.slice(1);
}

function tsType(value: JsonValue, name: string, defs: string[]): string {
  if (value === null) return "null";
  if (Array.isArray(value)) {
    if (!value.length) return "unknown[]";
    const types = [...new Set(value.map((item) => tsType(item, name, defs)))];
    return types.length === 1 ? `${types[0]}[]` : `(${types.join(" | ")})[]`;
  }
  switch (typeof value) {
    case "string":
      return "string";
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "object": {
      const typeName = titleCase(name);
      const fields = Object.entries(value).map(([key, item]) => {
        const childName = `${typeName}${titleCase(key)}`;
        return `  ${JSON.stringify(key)}: ${tsType(item, childName, defs)};`;
      });
      defs.push(`export interface ${typeName} {\n${fields.join("\n")}\n}`);
      return typeName;
    }
  }
}

function javaType(value: JsonValue, name: string, defs: string[]): string {
  if (value === null) return "Object";
  if (Array.isArray(value)) {
    if (!value.length) return "List<Object>";
    const first = javaType(value[0], name, defs);
    return `List<${first}>`;
  }
  switch (typeof value) {
    case "string":
      return "String";
    case "number":
      return Number.isInteger(value) ? "Long" : "Double";
    case "boolean":
      return "Boolean";
    case "object": {
      const className = titleCase(name);
      const fields = Object.entries(value).map(([key, item]) => {
        const childName = `${className}${titleCase(key)}`;
        return `    private ${javaType(item, childName, defs)} ${safeIdentifier(key)};`;
      });
      defs.push(`public static class ${className} {\n${fields.join("\n")}\n}`);
      return className;
    }
  }
}

export function jsonTypeTool(input: string, options: Options) {
  const value = parseJson(input);
  const rootName = titleCase(options.rootName || "Root");
  const defs: string[] = [];
  if (options.target === "java") {
    const rootType = javaType(value, rootName, defs);
    const body =
      typeof value === "object" && value !== null && !Array.isArray(value)
        ? defs.reverse().join("\n\n")
        : `public class ${rootName} {\n    private ${rootType} value;\n}`;
    return `import java.util.List;\n\n${body}`;
  }
  const rootType = tsType(value, rootName, defs);
  if (typeof value === "object" && value !== null && !Array.isArray(value))
    return defs.reverse().join("\n\n");
  return `export type ${rootName} = ${rootType};`;
}
