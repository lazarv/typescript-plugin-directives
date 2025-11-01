/**
 * Tests specifically targeting uncovered branches to improve branch coverage
 */

import ts from "typescript";
import { beforeEach, describe, expect, it } from "vitest";
import { scanFileDirectives } from "../src/ast.js";
import { getCachedDirectives, setCachedDirectives } from "../src/cache.js";
import {
  getCompletionEntryDetails,
  getCompletionsAtPosition,
} from "../src/completions.js";
import { provideInlayHints } from "../src/hints.js";
import { getQuickInfoAtPosition } from "../src/hover.js";

describe("branch coverage improvements", () => {
  let service: ts.LanguageService;
  let program: ts.Program;

  beforeEach(() => {
    // Cache is per-file, no global clear needed

    const fileContent = `"use server";
export function testFunction() {
  return "test";
}`;

    const servicesHost: ts.LanguageServiceHost = {
      getScriptFileNames: () => ["test.ts"],
      getScriptVersion: () => "1",
      getScriptSnapshot: (_fileName) =>
        ts.ScriptSnapshot.fromString(fileContent),
      getCurrentDirectory: () => "/",
      getCompilationSettings: () => ({
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ESNext,
      }),
      getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
      fileExists: ts.sys.fileExists,
      readFile: ts.sys.readFile,
    };

    service = ts.createLanguageService(
      servicesHost,
      ts.createDocumentRegistry()
    );
    const p = service.getProgram();
    expect(p).toBeDefined();
    if (!p) throw new Error("Program not created");
    program = p;
  });

  describe("hints.ts branch coverage", () => {
    it("should handle JSX with no opening element name", () => {
      const jsxContent = `<>Content</>`;
      const sourceFile = ts.createSourceFile(
        "test.tsx",
        jsxContent,
        ts.ScriptTarget.ESNext,
        true,
        ts.ScriptKind.TSX
      );

      const mockService = {
        getProgram: () => ({
          getSourceFile: () => sourceFile,
          getTypeChecker: () => program.getTypeChecker(),
          getCompilerOptions: () => ({}),
        }),
      } as any;

      const hints = provideInlayHints(
        "test.tsx",
        { start: 0, length: jsxContent.length },
        mockService,
        ts
      );

      expect(hints).toBeDefined();
    });

    it("should handle JSX element with no opening element", () => {
      const jsxContent = `const el = <div />`;
      const sourceFile = ts.createSourceFile(
        "test.tsx",
        jsxContent,
        ts.ScriptTarget.ESNext,
        true,
        ts.ScriptKind.TSX
      );

      const mockService = {
        getProgram: () => ({
          getSourceFile: () => sourceFile,
          getTypeChecker: () => program.getTypeChecker(),
          getCompilerOptions: () => ({}),
        }),
      } as any;

      const hints = provideInlayHints(
        "test.tsx",
        { start: 0, length: jsxContent.length },
        mockService,
        ts
      );

      expect(hints).toBeDefined();
    });

    it("should handle call expression with no expression identifier", () => {
      const content = `(function() { "use server"; })()`;
      const sourceFile = ts.createSourceFile(
        "test.ts",
        content,
        ts.ScriptTarget.ESNext,
        true
      );

      const mockService = {
        getProgram: () => ({
          getSourceFile: () => sourceFile,
          getTypeChecker: () => program.getTypeChecker(),
          getCompilerOptions: () => ({}),
        }),
      } as any;

      const hints = provideInlayHints(
        "test.ts",
        { start: 0, length: content.length },
        mockService,
        ts
      );

      expect(hints).toBeDefined();
    });

    it("should handle import with no module specifier", () => {
      // This is syntactically invalid but tests the branch
      const content = `import x from`;
      const sourceFile = ts.createSourceFile(
        "test.ts",
        content,
        ts.ScriptTarget.ESNext,
        true
      );

      const mockService = {
        getProgram: () => ({
          getSourceFile: () => sourceFile,
          getTypeChecker: () => program.getTypeChecker(),
          getCompilerOptions: () => ({}),
        }),
      } as any;

      const hints = provideInlayHints(
        "test.ts",
        { start: 0, length: content.length },
        mockService,
        ts
      );

      expect(hints).toBeDefined();
    });

    it("should handle JSX attribute with no initializer", () => {
      const jsxContent = `<form action>Content</form>`;
      const sourceFile = ts.createSourceFile(
        "test.tsx",
        jsxContent,
        ts.ScriptTarget.ESNext,
        true,
        ts.ScriptKind.TSX
      );

      const mockService = {
        getProgram: () => ({
          getSourceFile: () => sourceFile,
          getTypeChecker: () => program.getTypeChecker(),
          getCompilerOptions: () => ({}),
        }),
      } as any;

      const hints = provideInlayHints(
        "test.tsx",
        { start: 0, length: jsxContent.length },
        mockService,
        ts
      );

      expect(hints).toBeDefined();
    });

    it("should handle JSX attribute with non-expression initializer", () => {
      const jsxContent = `<div className="test" />`;
      const sourceFile = ts.createSourceFile(
        "test.tsx",
        jsxContent,
        ts.ScriptTarget.ESNext,
        true,
        ts.ScriptKind.TSX
      );

      const mockService = {
        getProgram: () => ({
          getSourceFile: () => sourceFile,
          getTypeChecker: () => program.getTypeChecker(),
          getCompilerOptions: () => ({}),
        }),
      } as any;

      const hints = provideInlayHints(
        "test.tsx",
        { start: 0, length: jsxContent.length },
        mockService,
        ts
      );

      expect(hints).toBeDefined();
    });
  });

  describe("hover.ts branch coverage", () => {
    it("should handle hover on directive string", () => {
      const content = `"use server";
export function test() {}`;
      const sourceFile = ts.createSourceFile(
        "test.ts",
        content,
        ts.ScriptTarget.ESNext,
        true
      );

      const mockService = {
        getProgram: () => ({
          getSourceFile: () => sourceFile,
          getTypeChecker: () => program.getTypeChecker(),
        }),
        getQuickInfoAtPosition: () => ({
          kind: ts.ScriptElementKind.string,
          kindModifiers: "",
          textSpan: { start: 0, length: 13 },
          displayParts: [],
        }),
      } as any;

      // Hover on the directive string
      const quickInfo = getQuickInfoAtPosition(
        "test.ts",
        7,
        mockService,
        ts,
        () => ({
          kind: ts.ScriptElementKind.string,
          kindModifiers: "",
          textSpan: { start: 0, length: 13 },
          displayParts: [],
        })
      );

      // Should either enhance or return the original quick info
      expect(quickInfo).toBeDefined();
    });

    it("should handle anonymous function with directive", () => {
      const content = `export default function() { 
  "use server"; 
  return "test";
}`;
      const sourceFile = ts.createSourceFile(
        "test.ts",
        content,
        ts.ScriptTarget.ESNext,
        true
      );

      const mockService = {
        getProgram: () => ({
          getSourceFile: () => sourceFile,
          getTypeChecker: () => program.getTypeChecker(),
        }),
        getQuickInfoAtPosition: () => ({
          kind: ts.ScriptElementKind.functionElement,
          kindModifiers: "export",
          textSpan: { start: 15, length: 8 },
          displayParts: [{ text: "function", kind: "keyword" }],
        }),
      } as any;

      const quickInfo = getQuickInfoAtPosition(
        "test.ts",
        20,
        mockService,
        ts,
        () => ({
          kind: ts.ScriptElementKind.functionElement,
          kindModifiers: "export",
          textSpan: { start: 15, length: 8 },
          displayParts: [{ text: "function", kind: "keyword" }],
        })
      );

      // Function should be handled even without a name
      expect(quickInfo).toBeDefined();
    });

    it("should handle variable declaration without initializer", () => {
      const content = `let x;`;
      const sourceFile = ts.createSourceFile(
        "test.ts",
        content,
        ts.ScriptTarget.ESNext,
        true
      );

      const mockService = {
        getProgram: () => ({
          getSourceFile: () => sourceFile,
          getTypeChecker: () => program.getTypeChecker(),
        }),
        getQuickInfoAtPosition: () => ({
          kind: ts.ScriptElementKind.letElement,
          kindModifiers: "",
          textSpan: { start: 4, length: 1 },
          displayParts: [],
        }),
      } as any;

      const quickInfo = getQuickInfoAtPosition(
        "test.ts",
        4,
        mockService,
        ts,
        () => ({
          kind: ts.ScriptElementKind.letElement,
          kindModifiers: "",
          textSpan: { start: 4, length: 1 },
          displayParts: [],
        })
      );

      expect(quickInfo).toBeDefined();
    });
  });

  describe("completions.ts branch coverage", () => {
    it("should return original completions when not in directive position", () => {
      const content = `const x = `;
      const sourceFile = ts.createSourceFile(
        "test.ts",
        content,
        ts.ScriptTarget.ESNext,
        true
      );

      const mockService = {
        getProgram: () => ({
          getSourceFile: () => sourceFile,
          getTypeChecker: () => program.getTypeChecker(),
        }),
      } as any;

      const mockPrior = () => ({
        entries: [
          { name: "test", kind: "var", kindModifiers: "", sortText: "0" },
        ],
      });

      const completions = getCompletionsAtPosition(
        "test.ts",
        10,
        mockService,
        ts,
        mockPrior as any
      );

      expect(completions).toBeDefined();
    });

    it("should return undefined for completion details when prior is undefined", () => {
      const details = getCompletionEntryDetails(
        "test.ts",
        5,
        "someOtherEntry", // Not a directive entry
        ts,
        () => undefined as any
      );

      expect(details).toBeUndefined();
    });
  });

  describe("cache.ts branch coverage", () => {
    it("should handle cache get and set operations", () => {
      const content = `export function test() {}`;
      const sourceFile = ts.createSourceFile(
        "cache-test.ts",
        content,
        ts.ScriptTarget.ESNext,
        true
      );

      // Test cache when empty
      const emptyCache = getCachedDirectives(sourceFile);
      expect(emptyCache).toBeNull();

      // Set cache
      const moduleDirectives = ["use server"];
      const exportDirectives = new Map([["test", "use cache"]]);
      setCachedDirectives(sourceFile, moduleDirectives, exportDirectives);

      // Get from cache
      const cached = getCachedDirectives(sourceFile);
      expect(cached).toBeDefined();
      expect(cached?.moduleDirectives).toEqual(["use server"]);
      expect(cached?.exportDirectives.get("test")).toEqual("use cache");
    });
  });

  describe("ast.ts branch coverage", () => {
    it("should handle various export patterns", () => {
      const testCases = [
        // Export declaration without declaration list
        `export { x };`,
        // Export with from clause
        `export { x } from './other';`,
        // Export default without declaration
        `const x = 1; export default x;`,
        // Export with type only
        `export type MyType = string;`,
      ];

      for (const content of testCases) {
        const sourceFile = ts.createSourceFile(
          "test.ts",
          content,
          ts.ScriptTarget.ESNext,
          true
        );

        const result = scanFileDirectives(sourceFile, program, ts);
        expect(result).toBeDefined();
        expect(result.moduleDirectives).toBeDefined();
        expect(result.exportDirectives).toBeDefined();
      }
    });

    it("should handle function without body", () => {
      const content = `declare function test(): void;`;
      const sourceFile = ts.createSourceFile(
        "test.ts",
        content,
        ts.ScriptTarget.ESNext,
        true
      );

      const result = scanFileDirectives(sourceFile, program, ts);
      expect(result).toBeDefined();
    });

    it("should handle arrow function without body", () => {
      const content = `const fn = () => "test";`;
      const sourceFile = ts.createSourceFile(
        "test.ts",
        content,
        ts.ScriptTarget.ESNext,
        true
      );

      const result = scanFileDirectives(sourceFile, program, ts);
      expect(result).toBeDefined();
    });
  });
});
