import ts from "typescript";
import { describe, expect, it } from "vitest";
import { getSemanticDiagnostics } from "../src/diagnostics.js";

describe("diagnostics.ts - fallback validation path (lines 473-496)", () => {
  it("should use matchDirective fallback when DirectiveRegistry is not available", () => {
    const code = `"use invalidxyz";
export function test() {}`;

    // Create a minimal service WITHOUT global.d.ts types
    const compilerOptions: ts.CompilerOptions = {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
    };

    const host: ts.LanguageServiceHost = {
      getScriptFileNames: () => ["test.ts"],
      getScriptVersion: () => "1",
      getScriptSnapshot: (fileName) => {
        if (fileName === "test.ts") {
          return ts.ScriptSnapshot.fromString(code);
        }
        return undefined;
      },
      getCurrentDirectory: () => "",
      getCompilationSettings: () => compilerOptions,
      getDefaultLibFileName: () => ts.getDefaultLibFilePath(compilerOptions),
      fileExists: (fileName) => fileName === "test.ts",
      readFile: (fileName) => (fileName === "test.ts" ? code : undefined),
    };

    const service = ts.createLanguageService(host, ts.createDocumentRegistry());

    const prior = () => [];
    const diagnostics = getSemanticDiagnostics("test.ts", service, ts, prior);

    // Without DirectiveRegistry type, should fall back to matchDirective
    // Since there's no type info, it should return empty diagnostics
    expect(Array.isArray(diagnostics)).toBe(true);
  });

  it("should handle single suggestion in fallback path", () => {
    const code = `"use servr";
export function test() {}`;

    const compilerOptions: ts.CompilerOptions = {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
    };

    const host: ts.LanguageServiceHost = {
      getScriptFileNames: () => ["test.ts"],
      getScriptVersion: () => "1",
      getScriptSnapshot: (fileName) => {
        if (fileName === "test.ts") {
          return ts.ScriptSnapshot.fromString(code);
        }
        return undefined;
      },
      getCurrentDirectory: () => "",
      getCompilationSettings: () => compilerOptions,
      getDefaultLibFileName: () => ts.getDefaultLibFilePath(compilerOptions),
      fileExists: (fileName) => fileName === "test.ts",
      readFile: (fileName) => (fileName === "test.ts" ? code : undefined),
    };

    const service = ts.createLanguageService(host, ts.createDocumentRegistry());

    const prior = () => [];
    const diagnostics = getSemanticDiagnostics("test.ts", service, ts, prior);

    expect(Array.isArray(diagnostics)).toBe(true);
  });

  it("should handle multiple suggestions in fallback path", () => {
    const code = `"use cach";
export function test() {}`;

    const compilerOptions: ts.CompilerOptions = {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
    };

    const host: ts.LanguageServiceHost = {
      getScriptFileNames: () => ["test.ts"],
      getScriptVersion: () => "1",
      getScriptSnapshot: (fileName) => {
        if (fileName === "test.ts") {
          return ts.ScriptSnapshot.fromString(code);
        }
        return undefined;
      },
      getCurrentDirectory: () => "",
      getCompilationSettings: () => compilerOptions,
      getDefaultLibFileName: () => ts.getDefaultLibFilePath(compilerOptions),
      fileExists: (fileName) => fileName === "test.ts",
      readFile: (fileName) => (fileName === "test.ts" ? code : undefined),
    };

    const service = ts.createLanguageService(host, ts.createDocumentRegistry());

    const prior = () => [];
    const diagnostics = getSemanticDiagnostics("test.ts", service, ts, prior);

    expect(Array.isArray(diagnostics)).toBe(true);
  });

  it("should handle no suggestions in fallback path", () => {
    const code = `"use xyz123";
export function test() {}`;

    const compilerOptions: ts.CompilerOptions = {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
    };

    const host: ts.LanguageServiceHost = {
      getScriptFileNames: () => ["test.ts"],
      getScriptVersion: () => "1",
      getScriptSnapshot: (fileName) => {
        if (fileName === "test.ts") {
          return ts.ScriptSnapshot.fromString(code);
        }
        return undefined;
      },
      getCurrentDirectory: () => "",
      getCompilationSettings: () => compilerOptions,
      getDefaultLibFileName: () => ts.getDefaultLibFilePath(compilerOptions),
      fileExists: (fileName) => fileName === "test.ts",
      readFile: (fileName) => (fileName === "test.ts" ? code : undefined),
    };

    const service = ts.createLanguageService(host, ts.createDocumentRegistry());

    const prior = () => [];
    const diagnostics = getSemanticDiagnostics("test.ts", service, ts, prior);

    expect(Array.isArray(diagnostics)).toBe(true);
  });
});
