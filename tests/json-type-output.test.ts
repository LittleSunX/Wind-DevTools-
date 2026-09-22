import { describe, expect, it } from "vitest";
import ts from "typescript";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { jsonTypeTool } from "../src/utils/json-type";

function typescriptCompiles(source: string, assignment: string) {
  const directory = mkdtempSync(join(tmpdir(), "wind-ts-"));
  try {
    const file = join(directory, "output.ts");
    writeFileSync(file, `${source}\n${assignment}\n`);
    const program = ts.createProgram([file], {
      noEmit: true,
      strict: true,
      skipLibCheck: true,
      target: ts.ScriptTarget.ES2022,
    });
    expect(
      ts
        .getPreEmitDiagnostics(program)
        .map((item) => ts.flattenDiagnosticMessageText(item.messageText, "\n")),
    ).toEqual([]);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

const localJavac =
  process.env.WIND_TEST_JAVAC ??
  (process.env.JAVA_HOME
    ? join(
        process.env.JAVA_HOME,
        "bin",
        process.platform === "win32" ? "javac.exe" : "javac",
      )
    : "javac");
const javaAvailable = !spawnSync(localJavac, ["-version"]).error;
const javaIt = javaAvailable || process.env.CI ? it : it.skip;
function javaCompiles(source: string, className: string) {
  const directory = mkdtempSync(join(tmpdir(), "wind-java-"));
  try {
    writeFileSync(join(directory, `${className}.java`), source);
    const result = spawnSync(
      localJavac,
      ["-encoding", "UTF-8", `${className}.java`],
      { cwd: directory, encoding: "utf8" },
    );
    expect(result.error?.message ?? result.stderr).toBe("");
    expect(result.status).toBe(0);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

describe("generated type validity", () => {
  it("merges object arrays without losing fields and marks missing fields optional", () => {
    const input = JSON.stringify({
      items: [
        { id: 1, nested: { a: 1 } },
        { name: "Wind", nested: { b: true } },
        null,
      ],
    });
    const output = jsonTypeTool(input, { target: "typescript" });
    expect(output).toContain('"id"?: number;');
    expect(output).toContain('"name"?: string;');
    expect(output).toContain('"a"?: number;');
    expect(output).toContain('"b"?: boolean;');
    expect(output).toContain("(RootItems | null)[]");
    typescriptCompiles(output, `const fixture: Root = ${input}; void fixture;`);
  });

  it("retains primitive unions, empty arrays, and similar nested names", () => {
    const input = JSON.stringify({
      mix: [1, "text", true],
      empty: [],
      "a-b": { first: 1 },
      a_b: { second: 2 },
    });
    const output = jsonTypeTool(input, { target: "typescript" });
    expect(output).toContain('"mix": (number | string | boolean)[];');
    expect(output).toContain('"empty": unknown[];');
    expect(output).toContain("interface RootA_b {");
    expect(output).toContain("interface RootA_b2 {");
    typescriptCompiles(output, `const fixture: Root = ${input}; void fixture;`);
  });

  javaIt(
    "makes legal, unique Java names and preserves fields in object arrays",
    () => {
      const input = JSON.stringify({
        class: "demo",
        "a-b": 1,
        a_b: 2,
        _: 3,
        "9id": 4,
        items: [{ id: 1 }, { name: "Wind" }, null],
        "a.b": { enabled: true },
        a_b_nested: { count: 2 },
      });
      const output = jsonTypeTool(input, { target: "java" });
      expect(output).toContain("private String class_;");
      expect(output).toContain("private Long a_b;");
      expect(output).toContain("private Long a_b_2;");
      expect(output).toContain("private Long _value;");
      expect(output).toContain("private Long _9id;");
      expect(output).toContain("private Long id;");
      expect(output).toContain("private String name;");
      javaCompiles(output, "Root");
    },
  );

  javaIt(
    "uses Object for mixed Java array elements and compiles nested class collisions",
    () => {
      const input = JSON.stringify({
        values: [1, "mixed"],
        "a-b": { value: 1 },
        a_b: { enabled: true },
      });
      const output = jsonTypeTool(input, { target: "java" });
      expect(output).toContain("private List<Object> values;");
      expect(output).toContain("class RootA_b {");
      expect(output).toContain("class RootA_b2 {");
      javaCompiles(output, "Root");
    },
  );
});
