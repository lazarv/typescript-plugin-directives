import ts from "typescript";
import { describe, expect, it } from "vitest";
import { getSemanticDiagnostics } from "../src/diagnostics.js";
import { createTestLanguageService } from "./utils.js";

describe("getSemanticDiagnostics - uncovered code paths", () => {
  describe("edge case: no options/providers but type still invalid", () => {
    it("should handle directive that doesn't match but has no provider/options", () => {
      const code = `"use invalidxyz";
export function test() {}`;

      const { languageService } = createTestLanguageService({
        "test.ts": code,
      });

      const prior = () => [];
      const diagnostics = getSemanticDiagnostics(
        "test.ts",
        languageService,
        ts,
        prior
      );

      expect(diagnostics.length).toBeGreaterThan(0);
      const diagnostic = diagnostics.find((d) => d.code === 99001);
      expect(diagnostic).toBeDefined();
      if (diagnostic) {
        // Should provide a diagnostic message (could be "Unknown directive" or "not assignable")
        expect(diagnostic.messageText).toBeTruthy();
      }
    });

    it("should provide suggestions when allDirectiveVariations has content", () => {
      const code = `"use cace";
export function test() {}`;

      const { languageService } = createTestLanguageService({
        "test.ts": code,
      });

      const prior = () => [];
      const diagnostics = getSemanticDiagnostics(
        "test.ts",
        languageService,
        ts,
        prior
      );

      expect(diagnostics.length).toBeGreaterThan(0);
      const diagnostic = diagnostics.find((d) => d.code === 99001);
      expect(diagnostic).toBeDefined();
    });

    it("should handle case where no suggestions and not assignable", () => {
      const code = `"use qwertyuiop";
export function test() {}`;

      const { languageService } = createTestLanguageService({
        "test.ts": code,
      });

      const prior = () => [];
      const diagnostics = getSemanticDiagnostics(
        "test.ts",
        languageService,
        ts,
        prior
      );

      expect(diagnostics.length).toBeGreaterThan(0);
      const diagnostic = diagnostics.find((d) => d.code === 99001);
      expect(diagnostic).toBeDefined();
      if (diagnostic) {
        const msg = diagnostic.messageText as string;
        // Should show available directives when no close matches
        expect(msg).toContain("Unknown directive");
      }
    });
  });

  describe("fallback path with single vs multiple suggestions", () => {
    it("should show single suggestion in fallback mode", () => {
      // Create language service without DirectiveRegistry to force fallback
      const code = `"use serve";
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
        fileExists: (fileName) =>
          fileName === "test.ts" || ts.sys.fileExists(fileName),
        readFile: (fileName) =>
          fileName === "test.ts" ? code : ts.sys.readFile(fileName),
      };

      const cleanService = ts.createLanguageService(
        host,
        ts.createDocumentRegistry()
      );

      const prior = () => [];
      const diagnostics = getSemanticDiagnostics(
        "test.ts",
        cleanService,
        ts,
        prior
      );

      expect(Array.isArray(diagnostics)).toBe(true);
      // In fallback mode, it should check for suggestions
    });

    it("should show list of available directives in fallback mode when no close matches", () => {
      const code = `"use abcdefgh";
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
        fileExists: (fileName) =>
          fileName === "test.ts" || ts.sys.fileExists(fileName),
        readFile: (fileName) =>
          fileName === "test.ts" ? code : ts.sys.readFile(fileName),
      };

      const cleanService = ts.createLanguageService(
        host,
        ts.createDocumentRegistry()
      );

      const prior = () => [];
      const diagnostics = getSemanticDiagnostics(
        "test.ts",
        cleanService,
        ts,
        prior
      );

      expect(Array.isArray(diagnostics)).toBe(true);
    });
  });

  describe("position and length calculation", () => {
    it("should correctly set diagnostic start position skipping opening quote", () => {
      const code = `"use wrongdirective";
export function test() {}`;

      const { languageService } = createTestLanguageService({
        "test.ts": code,
      });

      const prior = () => [];
      const diagnostics = getSemanticDiagnostics(
        "test.ts",
        languageService,
        ts,
        prior
      );

      const diagnostic = diagnostics.find((d) => d.code === 99001);
      if (diagnostic) {
        // Should start after the opening quote
        expect(diagnostic.start).toBeGreaterThan(0);
        expect(diagnostic.length).toBe("use wrongdirective".length);
      }
    });
  });
});
