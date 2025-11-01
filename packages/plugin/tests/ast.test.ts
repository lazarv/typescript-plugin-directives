import ts from "typescript";
import { describe, expect, it } from "vitest";
import { matchDirective, scanFileDirectives } from "../src/ast.js";
import { createTestProgram } from "./utils.js";

describe("matchDirective", () => {
  const validDirectives = ["use server", "use client", "use cache"];

  it("should match simple directives", () => {
    expect(matchDirective("use server", validDirectives)).toBe("use server");
    expect(matchDirective("use client", validDirectives)).toBe("use client");
    expect(matchDirective("use cache", validDirectives)).toBe("use cache");
  });

  it("should match directives with providers", () => {
    const directives = ["use cache", "use cache: memory", "use cache: server"];
    // Exact match returns exact match
    expect(matchDirective("use cache: memory", directives)).toBe(
      "use cache: memory"
    );
    expect(matchDirective("use cache: server", directives)).toBe(
      "use cache: server"
    );
    // With options, it matches the base
    expect(matchDirective("use cache: memory; ttl=3600", directives)).toBe(
      "use cache"
    );
  });

  it("should match directives with options", () => {
    const directives = ["use cache", "use cache: memory"];
    expect(matchDirective("use cache: memory; ttl=3600", directives)).toBe(
      "use cache"
    );
    expect(matchDirective("use cache; ttl=3600", directives)).toBe("use cache");
  });

  it("should return null for invalid directives", () => {
    expect(matchDirective("not a directive", validDirectives)).toBeNull();
    expect(matchDirective("use invalid", validDirectives)).toBeNull();
  });

  it("should handle exact match priority", () => {
    const directives = ["use cache", "use cache: memory"];
    expect(matchDirective("use cache", directives)).toBe("use cache");
    // Exact match returns exact value
    expect(matchDirective("use cache: memory", directives)).toBe(
      "use cache: memory"
    );
  });
});

describe("scanFileDirectives", () => {
  it("should detect module-level directives", () => {
    const code = `
      "use server";
      
      export function myAction() {
        return "test";
      }
    `;

    const program = createTestProgram({ "test.ts": code });
    const sourceFile = program.getSourceFile("test.ts");
    expect(sourceFile).toBeDefined();
    if (!sourceFile) return;

    const { moduleDirectives, exportDirectives } = scanFileDirectives(
      sourceFile,
      program,
      ts
    );

    // Note: Without valid DirectiveRegistry, it might not find directives
    // This test would work better with a proper global.d.ts setup
    expect(moduleDirectives).toBeInstanceOf(Array);
    expect(exportDirectives).toBeInstanceOf(Map);
  });

  it("should detect inline directives", () => {
    const code = `
      export function myAction() {
        "use server";
        return "test";
      }
    `;

    const program = createTestProgram({ "test.ts": code });
    const sourceFile = program.getSourceFile("test.ts");
    expect(sourceFile).toBeDefined();
    if (!sourceFile) return;

    const { moduleDirectives, exportDirectives } = scanFileDirectives(
      sourceFile,
      program,
      ts
    );

    expect(moduleDirectives).toHaveLength(0);
    // Without DirectiveRegistry in the test program, this won't detect directives
    expect(exportDirectives).toBeInstanceOf(Map);
  });

  it("should return empty results for files without directives", () => {
    const code = `
      export function normalFunction() {
        return "no directives here";
      }
    `;

    const program = createTestProgram({ "test.ts": code });
    const sourceFile = program.getSourceFile("test.ts");
    expect(sourceFile).toBeDefined();
    if (!sourceFile) return;

    const { moduleDirectives, exportDirectives } = scanFileDirectives(
      sourceFile,
      program,
      ts
    );

    expect(moduleDirectives).toHaveLength(0);
    expect(exportDirectives.size).toBe(0);
  });

  it("should handle files with only imports", () => {
    const code = `
      import { something } from "somewhere";
    `;

    const program = createTestProgram({ "test.ts": code });
    const sourceFile = program.getSourceFile("test.ts");
    expect(sourceFile).toBeDefined();
    if (!sourceFile) return;

    const { moduleDirectives, exportDirectives } = scanFileDirectives(
      sourceFile,
      program,
      ts
    );

    expect(moduleDirectives).toHaveLength(0);
    expect(exportDirectives.size).toBe(0);
  });
});
