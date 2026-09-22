import { jsonTool } from "./json";
import type { JsonTypeOptions } from "./shared";

type JsonValue =
  null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

type Shape =
  | { kind: "null" | "boolean" | "string" }
  | { kind: "number"; integer: boolean }
  | { kind: "array"; element?: Shape }
  | {
      kind: "object";
      count: number;
      fields: Map<string, { shape: Shape; count: number }>;
    }
  | { kind: "union"; variants: Shape[] };

function parseJson(input: string): JsonValue {
  jsonTool(input, { action: "validate" });
  return JSON.parse(input) as JsonValue;
}

function shapeOf(value: JsonValue): Shape {
  if (value === null) return { kind: "null" };
  if (Array.isArray(value))
    return {
      kind: "array",
      element: value
        .map(shapeOf)
        .reduce<Shape | undefined>((a, b) => (a ? merge(a, b) : b), undefined),
    };
  if (typeof value === "number")
    return { kind: "number", integer: Number.isInteger(value) };
  if (typeof value === "object")
    return {
      kind: "object",
      count: 1,
      fields: new Map(
        Object.entries(value).map(([key, item]) => [
          key,
          { shape: shapeOf(item), count: 1 },
        ]),
      ),
    };
  return { kind: typeof value as "string" | "boolean" };
}

function merge(left: Shape, right: Shape): Shape {
  if (left.kind === "union" || right.kind === "union") {
    const variants = [
      ...(left.kind === "union" ? left.variants : [left]),
      ...(right.kind === "union" ? right.variants : [right]),
    ];
    const merged: Shape[] = [];
    for (const variant of variants) {
      const index = merged.findIndex((item) => item.kind === variant.kind);
      if (index < 0) merged.push(variant);
      else merged[index] = merge(merged[index], variant);
    }
    return merged.length === 1
      ? merged[0]
      : { kind: "union", variants: merged };
  }
  if (left.kind !== right.kind)
    return { kind: "union", variants: [left, right] };
  if (left.kind === "number" && right.kind === "number")
    return { kind: "number", integer: left.integer && right.integer };
  if (left.kind === "array" && right.kind === "array")
    return {
      kind: "array",
      element:
        left.element && right.element
          ? merge(left.element, right.element)
          : (left.element ?? right.element),
    };
  if (left.kind === "object" && right.kind === "object") {
    const fields = new Map(left.fields);
    for (const [key, field] of right.fields) {
      const previous = fields.get(key);
      fields.set(
        key,
        previous
          ? {
              shape: merge(previous.shape, field.shape),
              count: previous.count + field.count,
            }
          : field,
      );
    }
    return { kind: "object", count: left.count + right.count, fields };
  }
  return left;
}

function identifier(value: string) {
  const cleaned = value.replace(/[^A-Za-z0-9_$]/g, "_");
  return /^[A-Za-z_$]/.test(cleaned) && cleaned !== "_"
    ? cleaned
    : `_${cleaned === "_" ? "value" : cleaned}`;
}
function titleCase(value: string) {
  const name = identifier(value || "Root");
  return name.charAt(0).toUpperCase() + name.slice(1);
}

// Paths, rather than display names, identify nested types. Similar property names
// can sanitize to the same identifier without overwriting each other's classes.
class Names {
  private byPath = new Map<string, string>();
  private used = new Set<string>();
  get(path: string, requested: string) {
    const existing = this.byPath.get(path);
    if (existing) return existing;
    const base = titleCase(requested);
    let name = base;
    for (let suffix = 2; this.used.has(name); suffix++)
      name = `${base}${suffix}`;
    this.used.add(name);
    this.byPath.set(path, name);
    return name;
  }
}

function childPath(path: string, field: string) {
  return `${path}/${JSON.stringify(field)}`;
}
function typeName(parent: string, field: string) {
  return `${parent}${titleCase(field)}`;
}

function typescript(
  shape: Shape,
  path: string,
  name: string,
  names: Names,
  defs: Map<string, string>,
): string {
  switch (shape.kind) {
    case "null":
    case "boolean":
    case "number":
    case "string":
      return shape.kind;
    case "array": {
      if (!shape.element) return "unknown[]";
      const member = typescript(shape.element, path, name, names, defs);
      return `${shape.element.kind === "union" ? `(${member})` : member}[]`;
    }
    case "union": {
      const members = shape.variants.map((item) =>
        typescript(item, path, name, names, defs),
      );
      return [...new Set(members)].join(" | ");
    }
    case "object": {
      const id = names.get(path, name);
      const fields = [...shape.fields].map(([key, field]) => {
        const value = typescript(
          field.shape,
          childPath(path, key),
          typeName(id, key),
          names,
          defs,
        );
        return `  ${JSON.stringify(key)}${field.count < shape.count ? "?" : ""}: ${value};`;
      });
      defs.set(id, `export interface ${id} {\n${fields.join("\n")}\n}`);
      return id;
    }
  }
}

const javaKeywords = new Set(
  "abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally float for goto if implements import instanceof int interface long native new package private protected public return short static strictfp super switch synchronized this throw throws transient try void volatile while true false null _ record sealed permits yield var".split(
    " ",
  ),
);
function javaField(key: string, used: Set<string>) {
  const base = identifier(key);
  let name = javaKeywords.has(base) ? `${base}_` : base;
  for (let suffix = 2; used.has(name); suffix++) name = `${base}_${suffix}`;
  used.add(name);
  return name;
}
function java(
  shape: Shape,
  path: string,
  name: string,
  names: Names,
  defs: Map<string, string>,
): string {
  switch (shape.kind) {
    case "null":
      return "Object";
    case "boolean":
      return "Boolean";
    case "number":
      return shape.integer ? "Long" : "Double";
    case "string":
      return "String";
    case "array":
      return `List<${shape.element ? java(shape.element, path, name, names, defs) : "Object"}>`;
    case "union": {
      const meaningful = shape.variants.filter((item) => item.kind !== "null");
      return meaningful.length === 1
        ? java(meaningful[0], path, name, names, defs)
        : "Object";
    }
    case "object": {
      const id = names.get(path, name);
      const used = new Set<string>();
      const fields = [...shape.fields].map(([key, field]) => {
        const value = java(
          field.shape,
          childPath(path, key),
          typeName(id, key),
          names,
          defs,
        );
        return `    private ${value} ${javaField(key, used)};`;
      });
      defs.set(id, `class ${id} {\n${fields.join("\n")}\n}`);
      return id;
    }
  }
}

export function jsonTypeTool(input: string, options: JsonTypeOptions = {}) {
  const value = parseJson(input);
  const shape = shapeOf(value);
  const rootName = titleCase(options.rootName || "Root");
  const itemName = shape.kind === "array" ? `${rootName}Item` : rootName;
  if (options.target === "java") {
    const names = new Names(),
      defs = new Map<string, string>();
    names.get("$root", rootName);
    const rootType = java(
      shape,
      shape.kind === "array" ? "$root/items" : "$root",
      itemName,
      names,
      defs,
    );
    if (shape.kind === "object")
      defs.set(
        rootName,
        defs
          .get(rootName)!
          .replace(`class ${rootName}`, `public class ${rootName}`),
      );
    else
      defs.set(
        rootName,
        `public class ${rootName} {\n    private ${rootType} value;\n}`,
      );
    const root = defs.get(rootName)!;
    return `import java.util.List;\n\n${[root, ...[...defs].filter(([name]) => name !== rootName).map(([, body]) => body)].join("\n\n")}`;
  }
  const names = new Names(),
    defs = new Map<string, string>();
  names.get("$root", rootName);
  const rootType = typescript(
    shape,
    shape.kind === "array" ? "$root/items" : "$root",
    itemName,
    names,
    defs,
  );
  if (shape.kind === "object") defs.set(rootName, defs.get(rootName)!);
  const root =
    shape.kind === "object"
      ? defs.get(rootName)!
      : `export type ${rootName} = ${rootType};`;
  return [
    root,
    ...[...defs].filter(([name]) => name !== rootName).map(([, body]) => body),
  ].join("\n\n");
}
