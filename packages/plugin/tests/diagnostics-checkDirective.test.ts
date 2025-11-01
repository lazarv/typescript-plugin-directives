import ts from "typescript";
import { describe, expect, it } from "vitest";
import { getSemanticDiagnostics } from "../src/diagnostics.js";

/**
 * Tests for the checkDirective function fallback path (lines 472-503)
 * This tests the matchDirective-based validation when Directive union type is not available
 * but DirectiveRegistry interface exists.
 *
 * The fallback path is triggered when:
 * - DirectiveRegistry interface exists (so validDirectives is populated)
 * - BUT Directive union type does NOT exist (so directiveType is undefined)
 */
describe("checkDirective - fallback validation path", () => {
  /**
   * Helper to create a service with DirectiveRegistry but WITHOUT Directive union type
   * This triggers the fallback path at lines 472-503
   */
  function createFallbackService(code: string) {
    // Global types with DirectiveRegistry interface but NO Directive union type
    const globalTypes = `
interface DirectiveRegistry {
  "use server": never;
  "use client": never;
  "use cache": never;
}
`;

    const compilerOptions: ts.CompilerOptions = {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      jsx: ts.JsxEmit.React,
    };

    const host: ts.LanguageServiceHost = {
      getScriptFileNames: () => ["test.ts", "global.d.ts"],
      getScriptVersion: () => "1",
      getScriptSnapshot: (fileName) => {
        if (fileName === "test.ts") {
          return ts.ScriptSnapshot.fromString(code);
        }
        if (fileName === "global.d.ts") {
          return ts.ScriptSnapshot.fromString(globalTypes);
        }
        return undefined;
      },
      getCurrentDirectory: () => "",
      getCompilationSettings: () => compilerOptions,
      getDefaultLibFileName: () => ts.getDefaultLibFilePath(compilerOptions),
      fileExists: (fileName) =>
        fileName === "test.ts" || fileName === "global.d.ts",
      readFile: (fileName) => {
        if (fileName === "test.ts") return code;
        if (fileName === "global.d.ts") return globalTypes;
        return undefined;
      },
    };

    return ts.createLanguageService(host, ts.createDocumentRegistry());
  }

  describe("when Directive union type is not available (fallback path)", () => {
    it("should use matchDirective to validate directive (valid directive)", () => {
      const code = `"use server";
export function test() {}`;

      const service = createFallbackService(code);
      const prior = () => [];
      const diagnostics = getSemanticDiagnostics("test.ts", service, ts, prior);

      // Valid directive should not produce diagnostics
      expect(diagnostics).toEqual([]);
    });

    it("should suggest closest match for single close match", () => {
      const code = `"use servr";
export function test() {}`;

      const service = createFallbackService(code);
      const prior = () => [];
      const diagnostics = getSemanticDiagnostics("test.ts", service, ts, prior);

      expect(diagnostics.length).toBeGreaterThan(0);
      const diagnostic = diagnostics[0];
      expect(diagnostic.messageText).toContain("Unknown directive 'use servr'");
      expect(diagnostic.messageText).toContain("Did you mean");
      expect(diagnostic.messageText).toContain("'use server'");
    });

    it("should suggest multiple matches when multiple are close", () => {
      const code = `"use clien";
export function test() {}`;

      const service = createFallbackService(code);
      const prior = () => [];
      const diagnostics = getSemanticDiagnostics("test.ts", service, ts, prior);

      expect(diagnostics.length).toBeGreaterThan(0);
      const diagnostic = diagnostics[0];
      expect(diagnostic.messageText).toContain("Unknown directive 'use clien'");
      expect(diagnostic.messageText).toContain("Did you mean");
    });

    it("should list available directives when no close match found", () => {
      const code = `"use xyz123";
export function test() {}`;

      const service = createFallbackService(code);
      const prior = () => [];
      const diagnostics = getSemanticDiagnostics("test.ts", service, ts, prior);

      expect(diagnostics.length).toBeGreaterThan(0);
      const diagnostic = diagnostics[0];
      expect(diagnostic.messageText).toContain(
        "Unknown directive 'use xyz123'"
      );
      expect(diagnostic.messageText).toContain("Available directives are");
    });

    it("should allow directive with options in fallback mode", () => {
      const code = `"use cache: xyz";
export function test() {}`;

      const service = createFallbackService(code);
      const prior = () => [];
      const diagnostics = getSemanticDiagnostics("test.ts", service, ts, prior);

      // matchDirective allows options, so should be valid
      expect(diagnostics).toEqual([]);
    });

    it("should allow directive with provider in fallback mode", () => {
      const code = `"use cache; ttl=60";
export function test() {}`;

      const service = createFallbackService(code);
      const prior = () => [];
      const diagnostics = getSemanticDiagnostics("test.ts", service, ts, prior);

      // matchDirective allows providers, so should be valid
      expect(diagnostics).toEqual([]);
    });

    it("should correctly set diagnostic position (skip opening quote)", () => {
      const code = `"use invalid";
export function test() {}`;

      const service = createFallbackService(code);
      const prior = () => [];
      const diagnostics = getSemanticDiagnostics("test.ts", service, ts, prior);

      expect(diagnostics.length).toBeGreaterThan(0);
      const diagnostic = diagnostics[0];
      // Start should be +1 to skip opening quote
      expect(diagnostic.start).toBe(1);
      expect(diagnostic.length).toBe("use invalid".length);
    });

    it("should set correct error code and category", () => {
      const code = `"use invalid";
export function test() {}`;

      const service = createFallbackService(code);
      const prior = () => [];
      const diagnostics = getSemanticDiagnostics("test.ts", service, ts, prior);

      expect(diagnostics.length).toBeGreaterThan(0);
      const diagnostic = diagnostics[0];
      expect(diagnostic.code).toBe(99001);
      expect(diagnostic.category).toBe(ts.DiagnosticCategory.Error);
    });

    it("should validate multiple directives in fallback mode", () => {
      const code = `"use server";
"use client";

export function test() {}`;

      const service = createFallbackService(code);
      const prior = () => [];
      const diagnostics = getSemanticDiagnostics("test.ts", service, ts, prior);

      // Both valid directives should produce no errors
      expect(diagnostics).toEqual([]);
    });

    it("should handle mix of module and inline directives", () => {
      const code = `"use server";

export function test() {
  "use client";
  return "test";
}`;

      const service = createFallbackService(code);
      const prior = () => [];
      const diagnostics = getSemanticDiagnostics("test.ts", service, ts, prior);

      // Both are valid directives (one module-level, one inline)
      expect(diagnostics).toEqual([]);
    });

    it("should detect invalid directive among valid ones", () => {
      const code = `"use server";

export function test() {}

export function another() {
  "use notavalidone";
  return "test";
}`;

      const service = createFallbackService(code);
      const prior = () => [];
      const diagnostics = getSemanticDiagnostics("test.ts", service, ts, prior);

      // Only the invalid inline directive should produce an error
      expect(diagnostics.length).toBe(1);
      expect(diagnostics[0].messageText).toContain("use notavalidone");
    });

    it("should skip strings that don't start with 'use '", () => {
      const code = `"strict mode";
export function test() {}`;

      const service = createFallbackService(code);
      const prior = () => [];
      const diagnostics = getSemanticDiagnostics("test.ts", service, ts, prior);

      // Should skip this string entirely
      expect(diagnostics).toEqual([]);
    });

    it("should handle inline directives in fallback mode", () => {
      const code = `export function test() {
  "use invalidxyz";
  return "test";
}`;

      const service = createFallbackService(code);
      const prior = () => [];
      const diagnostics = getSemanticDiagnostics("test.ts", service, ts, prior);

      expect(diagnostics.length).toBeGreaterThan(0);
      const diagnostic = diagnostics[0];
      expect(diagnostic.messageText).toContain("use invalidxyz");
    });

    it("should handle case sensitivity correctly", () => {
      const code = `"use Server";
export function test() {}`;

      const service = createFallbackService(code);
      const prior = () => [];
      const diagnostics = getSemanticDiagnostics("test.ts", service, ts, prior);

      // Should detect case mismatch
      expect(diagnostics.length).toBeGreaterThan(0);
      const diagnostic = diagnostics[0];
      expect(diagnostic.messageText).toContain("use Server");
      expect(diagnostic.messageText).toContain("Did you mean");
    });

    it("should handle all three standard directives", () => {
      const code = `"use server";
"use client";  
"use cache";

export function test() {}`;

      const service = createFallbackService(code);
      const prior = () => [];
      const diagnostics = getSemanticDiagnostics("test.ts", service, ts, prior);

      // All valid directives
      expect(diagnostics).toEqual([]);
    });
  });

  describe("branches in suggestions logic", () => {
    it("should handle exactly one suggestion", () => {
      const code = `"use serv";
export function test() {}`;

      const service = createFallbackService(code);
      const prior = () => [];
      const diagnostics = getSemanticDiagnostics("test.ts", service, ts, prior);

      expect(diagnostics.length).toBeGreaterThan(0);
      // Note: Both branches (length === 1 and length > 1) format the same way
      expect(diagnostics[0].messageText).toContain("Did you mean");
    });

    it("should handle two or more suggestions", () => {
      const code = `"use cach";
export function test() {}`;

      const service = createFallbackService(code);
      const prior = () => [];
      const diagnostics = getSemanticDiagnostics("test.ts", service, ts, prior);

      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics[0].messageText).toContain("Did you mean");
    });

    it("should handle no suggestions (fallback to available list)", () => {
      const code = `"use qwertyuiop";
export function test() {}`;

      const service = createFallbackService(code);
      const prior = () => [];
      const diagnostics = getSemanticDiagnostics("test.ts", service, ts, prior);

      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics[0].messageText).toContain("Available directives are");
      expect(diagnostics[0].messageText).toContain("'use cache'");
      expect(diagnostics[0].messageText).toContain("'use client'");
      expect(diagnostics[0].messageText).toContain("'use server'");
    });
  });
});
