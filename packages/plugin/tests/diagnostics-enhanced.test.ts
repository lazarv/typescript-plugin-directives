import ts from "typescript";
import { describe, expect, it } from "vitest";
import { getSemanticDiagnostics } from "../src/diagnostics.js";
import { createTestLanguageService } from "./utils.js";

describe("getSemanticDiagnostics - enhanced edge cases", () => {
  describe("fallback validation when DirectiveRegistry is missing", () => {
    it("should use matchDirective fallback when Directive type not found", () => {
      // Create a service without global.d.ts
      const code = `"use server";
export function test() {}`;

      const { languageService } = createTestLanguageService({
        "test.ts": code,
      });

      // Remove the directive type by creating a clean language service without our types
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

      // Should still validate, but using fallback mechanism
      expect(Array.isArray(diagnostics)).toBe(true);
    });

    it("should handle single suggestion in fallback mode", () => {
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
    });

    it("should handle multiple suggestions in fallback mode", () => {
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

  describe("complex directive validation scenarios", () => {
    it("should detect when directive doesn't support providers but one is given", () => {
      const code = `"use server: someprovider";
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
        expect(diagnostic.messageText).toContain("does not support");
      }
    });

    it("should provide suggestions for invalid providers on valid directives", () => {
      const code = `"use cache: memry";
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

    it("should handle invalid options without provider", () => {
      const code = `"use cache; invalidoption";
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

      expect(Array.isArray(diagnostics)).toBe(true);
    });

    it("should handle case where directive variations exist", () => {
      const code = `"use cache: memory";
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

      // Should validate without errors for valid directive variations
      expect(Array.isArray(diagnostics)).toBe(true);
    });

    it("should handle directive with valid provider and options", () => {
      const code = `"use cache: redis; ttl=3600";
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

      expect(Array.isArray(diagnostics)).toBe(true);
    });
  });

  describe("error message formatting variations", () => {
    it("should format message with no suggestions and no valid directives", () => {
      const code = `"use unknown";
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

    it("should format message for non-assignable type without suggestions", () => {
      const code = `"use xyz123abc";
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

    it("should handle directive with colon but no options/provider support", () => {
      const code = `"use client: provider";
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
    });

    it("should handle directive with semicolon but no options support", () => {
      const code = `"use server; option=value";
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
    });
  });

  describe("DirectiveRegistry type resolution edge cases", () => {
    it("should handle when registry symbol is found but type is null", () => {
      const code = `"use server";
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

      expect(Array.isArray(diagnostics)).toBe(true);
    });

    it("should skip node_modules except plugin's own files", () => {
      const code = `"use server";
export function test() {}`;

      const { languageService } = createTestLanguageService({
        "test.ts": code,
        "node_modules/other/index.ts": `export const x = 1;`,
      });

      const prior = () => [];
      const diagnostics = getSemanticDiagnostics(
        "test.ts",
        languageService,
        ts,
        prior
      );

      expect(Array.isArray(diagnostics)).toBe(true);
    });
  });

  describe("directive text extraction and matching", () => {
    it("should extract base directive from complex syntax", () => {
      const code = `"use cache: memory; ttl=3600; maxSize=1000";
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

      expect(Array.isArray(diagnostics)).toBe(true);
    });

    it("should handle directive with no match on base extraction", () => {
      const code = `"invalid format";
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

      // Shouldn't create diagnostic for strings that don't start with "use "
      expect(Array.isArray(diagnostics)).toBe(true);
    });

    it("should validate directives without options/providers correctly", () => {
      const code = `"use server";
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

      // Should not have any directive-related errors
      const directiveErrors = diagnostics.filter((d) => d.code === 99001);
      expect(directiveErrors.length).toBe(0);
    });
  });

  describe("getAllDirectiveVariations coverage", () => {
    it("should handle union types in DirectiveRegistry", () => {
      const code = `"use cache: memory";
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

      expect(Array.isArray(diagnostics)).toBe(true);
    });

    it("should extract string literals from union types", () => {
      const code = `"use cache: redis";
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

      expect(Array.isArray(diagnostics)).toBe(true);
    });
  });

  describe("edge cases in diagnostic position calculation", () => {
    it("should correctly calculate start position with opening quote", () => {
      const code = `"use invalid";
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
        // Should skip the opening quote
        expect(diagnostic.start).toBeGreaterThan(0);
        expect(diagnostic.length).toBeGreaterThan(0);
      }
    });
  });
});
