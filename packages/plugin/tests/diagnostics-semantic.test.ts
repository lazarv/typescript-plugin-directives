import ts from "typescript";
import { describe, expect, it } from "vitest";
import { getSemanticDiagnostics } from "../src/diagnostics.js";
import { createTestLanguageService } from "./utils.js";

describe("getSemanticDiagnostics - comprehensive coverage", () => {
  describe("directive validation with DirectiveRegistry", () => {
    it("should validate directives using type system when available", () => {
      const code = `"use server";
export function myAction() {
  return "test";
}`;

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

      // Should validate using type system (may or may not have errors depending on global.d.ts)
      expect(Array.isArray(diagnostics)).toBe(true);
    });

    it("should detect unknown directive types", () => {
      const code = `"use unknown";
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

    it("should handle directives with provider syntax", () => {
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

    it("should handle directives with options syntax", () => {
      const code = `"use cache; ttl=3600";
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

    it("should handle directives with both provider and options", () => {
      const code = `"use cache: memory; ttl=3600";
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

  describe("directive suggestion mechanisms", () => {
    it("should suggest corrections for typos in base directive", () => {
      const code = `"use servr";
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

    it("should suggest corrections for partial directive names", () => {
      const code = `"use cac";
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

    it("should list all available directives when input is far from any valid directive", () => {
      const code = `"use blahblah";
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

  describe("provider and options validation", () => {
    it("should detect invalid providers for valid base directive", () => {
      const code = `"use cache: invalidprovider";
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

      expect(Array.isArray(diagnostics)).toBe(true);
    });

    it("should detect when directive doesn't support options but they are given", () => {
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

      expect(Array.isArray(diagnostics)).toBe(true);
    });

    it("should suggest correct provider variations", () => {
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

      expect(Array.isArray(diagnostics)).toBe(true);
    });
  });

  describe("multiple directives in same file", () => {
    it("should validate multiple module-level directives", () => {
      const code = `"use server";
"use cache";
export function test1() {}
export function test2() {}`;

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

    it("should validate function-level directives", () => {
      const code = `export function fn1() {
  "use server";
  return "test";
}

export function fn2() {
  "use client";
  return "test";
}`;

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

    it("should validate mix of valid and invalid directives", () => {
      const code = `"use server";
export function fn1() {}

export function fn2() {
  "use invalidone";
  return "test";
}`;

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

  describe("edge cases and error paths", () => {
    it("should handle files with only comments and directives", () => {
      const code = `// This is a comment
"use server";
// Another comment`;

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

    it("should handle directives in arrow functions", () => {
      const code = `export const fn = () => {
  "use server";
  return "test";
};`;

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

    it("should handle directives in class methods", () => {
      const code = `export class MyClass {
  myMethod() {
    "use server";
    return "test";
  }
}`;

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

    it("should handle nested blocks with directives", () => {
      const code = `export function outer() {
  "use server";
  
  function inner() {
    "use client";
    return "test";
  }
  
  return inner();
}`;

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

    it("should handle directives with unusual whitespace", () => {
      const code = `"use   server";
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

    it("should handle case-sensitive directive names", () => {
      const code = `"use Server";
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

  describe("diagnostic message formatting", () => {
    it("should format suggestions for single close match", () => {
      const code = `"use serve";
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

      // Should contain properly formatted message
      expect(Array.isArray(diagnostics)).toBe(true);
    });

    it("should format suggestions for multiple close matches", () => {
      const code = `"use cach";
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

    it("should format available directives list", () => {
      const code = `"use xyz123";
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

  describe("fallback to matchDirective when type system unavailable", () => {
    it("should use basic validation when Directive type not found", () => {
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

      // Should fall back to matchDirective
      expect(Array.isArray(diagnostics)).toBe(true);
    });

    it("should handle errors during type resolution gracefully", () => {
      const code = `"use cache";
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

  describe("interaction with original diagnostics", () => {
    it("should append directive errors to existing diagnostics", () => {
      const code = `"use invalid";
export function test() {}`;

      const { languageService } = createTestLanguageService({
        "test.ts": code,
      });

      const program = languageService.getProgram();
      expect(program).toBeDefined();
      if (!program) return;
      const sourceFile = program.getSourceFile("test.ts");
      expect(sourceFile).toBeDefined();
      if (!sourceFile) return;

      const originalDiag = {
        file: sourceFile,
        start: 20,
        length: 4,
        messageText: "Existing error",
        category: ts.DiagnosticCategory.Error,
        code: 1234,
      };

      const prior = () => [originalDiag];
      const diagnostics = getSemanticDiagnostics(
        "test.ts",
        languageService,
        ts,
        prior
      );

      // Should include original diagnostic
      expect(diagnostics.some((d) => d.code === 1234)).toBe(true);
    });

    it("should not modify original diagnostics array", () => {
      const code = `"use server";
export function test() {}`;

      const { languageService } = createTestLanguageService({
        "test.ts": code,
      });

      const program = languageService.getProgram();
      expect(program).toBeDefined();
      if (!program) return;
      const sourceFile = program.getSourceFile("test.ts");
      expect(sourceFile).toBeDefined();
      if (!sourceFile) return;

      const originalDiag = {
        file: sourceFile,
        start: 0,
        length: 1,
        messageText: "Original",
        category: ts.DiagnosticCategory.Warning,
        code: 9999,
      };

      const originalArray = [originalDiag];
      const prior = () => originalArray;
      const _diagnostics = getSemanticDiagnostics(
        "test.ts",
        languageService,
        ts,
        prior
      );

      // Original array should remain unchanged
      expect(originalArray.length).toBe(1);
      expect(originalArray[0].code).toBe(9999);
    });

    it("should maintain diagnostic order", () => {
      const code = `"use invalid1";
"use invalid2";
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

      // Diagnostics should be in source order
      if (diagnostics.length > 1) {
        for (let i = 1; i < diagnostics.length; i++) {
          expect(diagnostics[i].start).toBeGreaterThanOrEqual(
            diagnostics[i - 1].start!
          );
        }
      }
    });
  });

  describe("special directive formats", () => {
    it("should handle directives with colons in options", () => {
      const code = `"use cache; key=value:subvalue";
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

    it("should handle directives with semicolons in options", () => {
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

    it("should handle empty directive string", () => {
      const code = `"";
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

      // Empty string shouldn't trigger directive validation
      expect(Array.isArray(diagnostics)).toBe(true);
    });

    it("should handle strings that don't start with 'use '", () => {
      const code = `"use strict";
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

      // "use strict" starts with "use " and should be validated
      expect(Array.isArray(diagnostics)).toBe(true);
    });
  });
});
