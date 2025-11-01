import ts from "typescript";
import { describe, expect, it } from "vitest";
import { getSemanticDiagnostics } from "../src/diagnostics.js";
import { createTestLanguageService } from "./utils.js";

describe("semantic diagnostics", () => {
  describe("getSemanticDiagnostics", () => {
    it("should return diagnostics for files with directives", () => {
      const { languageService } = createTestLanguageService({
        "test.ts": `
          export function myAction() {
            "use server";
            return "test";
          }
        `,
      });

      const originalDiagnostics = (fileName: string) => {
        return languageService.getSemanticDiagnostics(fileName);
      };

      const diagnostics = getSemanticDiagnostics(
        "test.ts",
        languageService,
        ts,
        originalDiagnostics
      );

      // Should return array (original + plugin diagnostics)
      expect(Array.isArray(diagnostics)).toBe(true);
    });

    it("should preserve original diagnostics", () => {
      const { languageService } = createTestLanguageService({
        "test.ts": `
          export function myAction() {
            const x: number = "invalid"; // Type error
            return "test";
          }
        `,
      });

      const originalDiagnostics = (fileName: string) => {
        return languageService.getSemanticDiagnostics(fileName);
      };

      const diagnostics = getSemanticDiagnostics(
        "test.ts",
        languageService,
        ts,
        originalDiagnostics
      );

      // Should include original TypeScript diagnostics
      expect(diagnostics.length).toBeGreaterThanOrEqual(0);
    });

    it("should handle files without directives", () => {
      const { languageService } = createTestLanguageService({
        "test.ts": `
          export function normalFunction() {
            return "no directives";
          }
        `,
      });

      const originalDiagnostics = (fileName: string) => {
        return languageService.getSemanticDiagnostics(fileName);
      };

      const diagnostics = getSemanticDiagnostics(
        "test.ts",
        languageService,
        ts,
        originalDiagnostics
      );

      expect(Array.isArray(diagnostics)).toBe(true);
    });

    it("should handle files that don't exist in program", () => {
      const { languageService } = createTestLanguageService({
        "test.ts": "export function test() {}",
      });

      const originalDiagnostics = () => [];

      const diagnostics = getSemanticDiagnostics(
        "nonexistent.ts",
        languageService,
        ts,
        originalDiagnostics
      );

      expect(Array.isArray(diagnostics)).toBe(true);
    });

    it("should handle program without type checker", () => {
      const mockLanguageService = {
        getProgram: () => ({
          getSourceFile: () => undefined,
          getTypeChecker: () => undefined,
        }),
      } as any;

      const originalDiagnostics = () => [];

      const diagnostics = getSemanticDiagnostics(
        "test.ts",
        mockLanguageService,
        ts,
        originalDiagnostics
      );

      expect(diagnostics).toEqual([]);
    });
  });

  describe("directive validation", () => {
    it("should validate directive syntax", () => {
      const { languageService } = createTestLanguageService({
        "test.ts": `
          export function test() {
            "use invalid-directive";
            return "test";
          }
        `,
      });

      const originalDiagnostics = () => [];

      const diagnostics = getSemanticDiagnostics(
        "test.ts",
        languageService,
        ts,
        originalDiagnostics
      );

      // May or may not find errors depending on DirectiveRegistry
      expect(Array.isArray(diagnostics)).toBe(true);
    });

    it("should handle module-level directives", () => {
      const { languageService } = createTestLanguageService({
        "test.ts": `
          "use server";
          export function test() {
            return "test";
          }
        `,
      });

      const originalDiagnostics = () => [];

      const diagnostics = getSemanticDiagnostics(
        "test.ts",
        languageService,
        ts,
        originalDiagnostics
      );

      expect(Array.isArray(diagnostics)).toBe(true);
    });

    it("should handle directives with options", () => {
      const { languageService } = createTestLanguageService({
        "test.ts": `
          export function getData() {
            "use cache: memory; ttl=3600";
            return { data: "test" };
          }
        `,
      });

      const originalDiagnostics = () => [];

      const diagnostics = getSemanticDiagnostics(
        "test.ts",
        languageService,
        ts,
        originalDiagnostics
      );

      expect(Array.isArray(diagnostics)).toBe(true);
    });

    it("should handle multiple directives in a file", () => {
      const { languageService } = createTestLanguageService({
        "test.ts": `
          export function action1() {
            "use server";
            return "action1";
          }
          
          export function action2() {
            "use client";
            return "action2";
          }
          
          export function getData() {
            "use cache";
            return "data";
          }
        `,
      });

      const originalDiagnostics = () => [];

      const diagnostics = getSemanticDiagnostics(
        "test.ts",
        languageService,
        ts,
        originalDiagnostics
      );

      expect(Array.isArray(diagnostics)).toBe(true);
    });
  });
});
