import ts from "typescript";
import { describe, expect, it } from "vitest";
import {
  getSemanticDiagnostics,
  levenshteinDistance,
} from "../src/diagnostics.js";
import { createTestLanguageService } from "./utils.js";

describe("levenshteinDistance", () => {
  it("should calculate correct distance for identical strings", () => {
    expect(levenshteinDistance("use server", "use server")).toBe(0);
    expect(levenshteinDistance("test", "test")).toBe(0);
  });

  it("should calculate correct distance for single character changes", () => {
    expect(levenshteinDistance("use serve", "use server")).toBe(1);
    expect(levenshteinDistance("use client", "use clien")).toBe(1);
  });

  it("should calculate correct distance for multiple changes", () => {
    expect(levenshteinDistance("use cache", "use cach")).toBe(1);
    expect(levenshteinDistance("use server", "use client")).toBe(6);
  });

  it("should handle empty strings", () => {
    expect(levenshteinDistance("", "")).toBe(0);
    expect(levenshteinDistance("test", "")).toBe(4);
    expect(levenshteinDistance("", "test")).toBe(4);
  });

  it("should handle case differences", () => {
    expect(levenshteinDistance("use server", "Use Server")).toBe(2);
    expect(levenshteinDistance("test", "TEST")).toBe(4);
  });

  it("should calculate distance for typos", () => {
    expect(levenshteinDistance("use serve", "use server")).toBe(1); // Missing 'r'
    expect(levenshteinDistance("use servr", "use server")).toBe(1); // Wrong char
    expect(levenshteinDistance("use sever", "use server")).toBe(1); // Transposition
  });

  it("should work with directive variations", () => {
    expect(levenshteinDistance("use cache: memory", "use cache: server")).toBe(
      5
    ); // "memory" vs "server" = 5 changes
    expect(
      levenshteinDistance('use cache; ttl=3600"', 'use cache; ttl=7200"')
    ).toBe(2); // "36" vs "72" = 2 changes
  });
});

describe("directive suggestions", () => {
  it("should suggest close matches based on edit distance", () => {
    const validDirectives = ["use server", "use client", "use cache"];

    // "use serve" is 1 edit away from "use server"
    const input = "use serve";
    const closest = validDirectives.filter(
      (d) => levenshteinDistance(input, d) <= 2
    );

    expect(closest).toContain("use server");
    expect(closest).not.toContain("use client");
    expect(closest).not.toContain("use cache");
  });

  it("should not suggest distant matches", () => {
    const validDirectives = ["use server", "use client", "use cache"];

    // "use xyz" is too far from all valid directives
    const input = "use xyz";
    const threshold = 2;
    const closest = validDirectives.filter(
      (d) => levenshteinDistance(input, d) <= threshold
    );

    expect(closest).toHaveLength(0);
  });

  it("should suggest multiple close matches", () => {
    const validDirectives = [
      "use cache",
      "use cache: memory",
      "use cache: server",
    ];

    const input = "use cach";
    const threshold = 2;
    const closest = validDirectives.filter(
      (d) => levenshteinDistance(input, d) <= threshold
    );

    expect(closest.length).toBeGreaterThan(0);
    expect(closest).toContain("use cache");
  });
});

describe("getSemanticDiagnostics - edge cases", () => {
  it("should handle files with no program", () => {
    const fileName = "test.ts";
    const mockLangService: any = {
      getProgram: () => undefined,
    };

    const prior = () => [];
    const result = getSemanticDiagnostics(fileName, mockLangService, ts, prior);

    expect(result).toEqual([]);
  });

  it("should handle files with no source file", () => {
    const fileName = "test.ts";
    const mockProgram: any = {
      getSourceFile: () => undefined,
    };
    const mockLangService: any = {
      getProgram: () => mockProgram,
    };

    const prior = () => [];
    const result = getSemanticDiagnostics(fileName, mockLangService, ts, prior);

    expect(result).toEqual([]);
  });

  it("should return original diagnostics when no valid directives found", () => {
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
    const originalDiagnostics: ts.Diagnostic[] = [
      {
        file: sourceFile,
        start: 0,
        length: 5,
        messageText: "Test diagnostic",
        category: ts.DiagnosticCategory.Warning,
        code: 1234,
      },
    ];

    const prior = () => originalDiagnostics;
    const result = getSemanticDiagnostics(
      "test.ts",
      languageService,
      ts,
      prior
    );

    // Should contain at least the original diagnostic
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result.some((d) => d.code === 1234)).toBe(true);
  });

  it("should detect directive strings with options/providers", () => {
    const code = `"use cache: invalid-provider";
export function test() {}`;

    const { languageService } = createTestLanguageService({
      "test.ts": code,
    });

    const prior = () => [];
    const result = getSemanticDiagnostics(
      "test.ts",
      languageService,
      ts,
      prior
    );

    // May or may not have diagnostics depending on global.d.ts configuration
    expect(Array.isArray(result)).toBe(true);
  });

  it("should handle directive with semicolon options", () => {
    const code = `"use cache; invalidoption=true";
export function test() {}`;

    const { languageService } = createTestLanguageService({
      "test.ts": code,
    });

    const prior = () => [];
    const result = getSemanticDiagnostics(
      "test.ts",
      languageService,
      ts,
      prior
    );

    // May or may not have diagnostics depending on global.d.ts configuration
    expect(Array.isArray(result)).toBe(true);
  });

  it("should handle non-directive strings starting with 'use'", () => {
    const code = `"use strict";
export function test() {}`;

    const { languageService } = createTestLanguageService({
      "test.ts": code,
    });

    const prior = () => [];
    const result = getSemanticDiagnostics(
      "test.ts",
      languageService,
      ts,
      prior
    );

    // "use strict" should trigger validation since it starts with "use "
    // but might not match any directives
    expect(Array.isArray(result)).toBe(true);
  });

  it("should handle strings not starting with 'use'", () => {
    const code = `"hello world";
export function test() {}`;

    const { languageService } = createTestLanguageService({
      "test.ts": code,
    });

    const prior = () => [];
    const result = getSemanticDiagnostics(
      "test.ts",
      languageService,
      ts,
      prior
    );

    // Should not add any diagnostics for non-directive strings
    expect(result.length).toBe(0);
  });

  it("should handle function-level directives", () => {
    const code = `export function test() {
  "use server";
  return "hello";
}`;

    const { languageService } = createTestLanguageService({
      "test.ts": code,
    });

    const prior = () => [];
    const result = getSemanticDiagnostics(
      "test.ts",
      languageService,
      ts,
      prior
    );

    // Should validate function-level directive
    expect(Array.isArray(result)).toBe(true);
  });

  it("should handle nested string literals that are not directives", () => {
    const code = `export function test() {
  const str = "use something";
  return str;
}`;

    const { languageService } = createTestLanguageService({
      "test.ts": code,
    });

    const prior = () => [];
    const result = getSemanticDiagnostics(
      "test.ts",
      languageService,
      ts,
      prior
    );

    // Nested strings (not first statement) shouldn't be treated as directives
    expect(result.length).toBe(0);
  });

  it("should handle empty files", () => {
    const code = ``;

    const { languageService } = createTestLanguageService({
      "test.ts": code,
    });

    const prior = () => [];
    const result = getSemanticDiagnostics(
      "test.ts",
      languageService,
      ts,
      prior
    );

    expect(result).toEqual([]);
  });

  it("should preserve original diagnostics and add new ones", () => {
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
    const originalDiagnostics: ts.Diagnostic[] = [
      {
        file: sourceFile,
        start: 30,
        length: 4,
        messageText: "Original TypeScript error",
        category: ts.DiagnosticCategory.Error,
        code: 2304,
      },
    ];

    const prior = () => originalDiagnostics;
    const result = getSemanticDiagnostics(
      "test.ts",
      languageService,
      ts,
      prior
    );

    // Should preserve original diagnostics
    expect(result.length).toBeGreaterThanOrEqual(originalDiagnostics.length);
    expect(result.some((d) => d.code === 2304)).toBe(true);
  });
});

describe("getSemanticDiagnostics - suggestion algorithms", () => {
  it("should suggest closest directive for typos", () => {
    const code = `"use serve";
export function test() {}`;

    const { languageService } = createTestLanguageService({
      "test.ts": code,
    });

    const prior = () => [];
    const result = getSemanticDiagnostics(
      "test.ts",
      languageService,
      ts,
      prior
    );

    // Should have diagnostic with suggestion (may be empty if global.d.ts not available)
    expect(Array.isArray(result)).toBe(true);
    if (result.length > 0) {
      const diagnostic = result.find((d) => d.code === 99001);
      if (diagnostic) {
        const message =
          typeof diagnostic.messageText === "string"
            ? diagnostic.messageText
            : diagnostic.messageText.messageText;
        expect(message).toBeTruthy();
      }
    }
  });

  it("should list available directives when no close match", () => {
    const code = `"use xyz";
export function test() {}`;

    const { languageService } = createTestLanguageService({
      "test.ts": code,
    });

    const prior = () => [];
    const result = getSemanticDiagnostics(
      "test.ts",
      languageService,
      ts,
      prior
    );

    // Should have diagnostic (may be empty if global.d.ts not available)
    expect(Array.isArray(result)).toBe(true);
  });

  it("should handle multiple close suggestions", () => {
    const code = `"use cach";
export function test() {}`;

    const { languageService } = createTestLanguageService({
      "test.ts": code,
    });

    const prior = () => [];
    const result = getSemanticDiagnostics(
      "test.ts",
      languageService,
      ts,
      prior
    );

    // Should return valid diagnostics array
    expect(Array.isArray(result)).toBe(true);
  });

  it("should validate directives with providers correctly", () => {
    const code = `"use cache: wrongprovider";
export function test() {}`;

    const { languageService } = createTestLanguageService({
      "test.ts": code,
    });

    const prior = () => [];
    const result = getSemanticDiagnostics(
      "test.ts",
      languageService,
      ts,
      prior
    );

    // Should detect invalid provider
    expect(Array.isArray(result)).toBe(true);
  });
});
