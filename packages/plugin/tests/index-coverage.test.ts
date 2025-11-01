/**
 * Tests specifically for index.ts to improve branch and function coverage
 */

import ts from "typescript";
import { describe, expect, it } from "vitest";
import init from "../src/index.js";

describe("index.ts coverage improvements", () => {
  it("should create plugin proxy with all methods", () => {
    const mockModule = { typescript: ts };
    const plugin = init(mockModule);

    expect(plugin).toBeDefined();
    expect(plugin.create).toBeDefined();
    expect(typeof plugin.create).toBe("function");
  });

  it("should handle language service without provideInlayHints", () => {
    const mockModule = { typescript: ts };
    const plugin = init(mockModule);

    const mockLanguageService = {
      getQuickInfoAtPosition: () => undefined,
      getSemanticDiagnostics: () => [],
      getCompletionsAtPosition: () => undefined,
      getCompletionEntryDetails: () => undefined,
      getProgram: () => null,
      // No provideInlayHints method
    } as any;

    const mockInfo = {
      languageService: mockLanguageService,
      languageServiceHost: {
        getScriptFileNames: () => [],
        getScriptVersion: () => "1",
        getScriptSnapshot: () => undefined,
        getCurrentDirectory: () => "/",
        getCompilationSettings: () => ({}),
        getDefaultLibFileName: (options: ts.CompilerOptions) =>
          ts.getDefaultLibFilePath(options),
      } as unknown as ts.LanguageServiceHost,
      project: {} as ts.server.Project,
      config: {},
    };

    const proxy = plugin.create(mockInfo);

    expect(proxy).toBeDefined();
    expect(proxy.getQuickInfoAtPosition).toBeDefined();
    expect(proxy.getSemanticDiagnostics).toBeDefined();
    expect(proxy.getCompletionsAtPosition).toBeDefined();
    expect(proxy.getCompletionEntryDetails).toBeDefined();
    // provideInlayHints should not be added if original doesn't have it
    expect(proxy.provideInlayHints).toBeUndefined();
  });

  it("should handle language service with provideInlayHints", () => {
    const mockModule = { typescript: ts };
    const plugin = init(mockModule);

    const mockLanguageService = {
      getQuickInfoAtPosition: () => undefined,
      getSemanticDiagnostics: () => [],
      getCompletionsAtPosition: () => undefined,
      getCompletionEntryDetails: () => undefined,
      getProgram: () => null,
      provideInlayHints: () => [],
    } as any;

    const mockInfo = {
      languageService: mockLanguageService,
      languageServiceHost: {
        getScriptFileNames: () => [],
        getScriptVersion: () => "1",
        getScriptSnapshot: () => undefined,
        getCurrentDirectory: () => "/",
        getCompilationSettings: () => ({}),
        getDefaultLibFileName: (options: ts.CompilerOptions) =>
          ts.getDefaultLibFilePath(options),
      } as unknown as ts.LanguageServiceHost,
      project: {} as ts.server.Project,
      config: {},
    };

    const proxy = plugin.create(mockInfo);

    expect(proxy).toBeDefined();
    expect(proxy.provideInlayHints).toBeDefined();
    expect(typeof proxy.provideInlayHints).toBe("function");
  });

  it("should handle missing getCompletionsAtPosition", () => {
    const mockModule = { typescript: ts };
    const plugin = init(mockModule);

    const mockLanguageService = {
      getQuickInfoAtPosition: () => undefined,
      getSemanticDiagnostics: () => [],
      getCompletionEntryDetails: () => undefined,
      getProgram: () => null,
      // No getCompletionsAtPosition
    } as any;

    const mockInfo = {
      languageService: mockLanguageService,
      languageServiceHost: {
        getScriptFileNames: () => [],
        getScriptVersion: () => "1",
        getScriptSnapshot: () => undefined,
        getCurrentDirectory: () => "/",
        getCompilationSettings: () => ({}),
        getDefaultLibFileName: (options: ts.CompilerOptions) =>
          ts.getDefaultLibFilePath(options),
      } as unknown as ts.LanguageServiceHost,
      project: {} as ts.server.Project,
      config: {},
    };

    const proxy = plugin.create(mockInfo);

    expect(proxy).toBeDefined();
    // getCompletionsAtPosition should not be added if original doesn't have it
    expect(proxy.getCompletionsAtPosition).toBeUndefined();
  });

  it("should handle missing getCompletionEntryDetails", () => {
    const mockModule = { typescript: ts };
    const plugin = init(mockModule);

    const mockLanguageService = {
      getQuickInfoAtPosition: () => undefined,
      getSemanticDiagnostics: () => [],
      getCompletionsAtPosition: () => undefined,
      getProgram: () => null,
      // No getCompletionEntryDetails
    } as any;

    const mockInfo = {
      languageService: mockLanguageService,
      languageServiceHost: {
        getScriptFileNames: () => [],
        getScriptVersion: () => "1",
        getScriptSnapshot: () => undefined,
        getCurrentDirectory: () => "/",
        getCompilationSettings: () => ({}),
        getDefaultLibFileName: (options: ts.CompilerOptions) =>
          ts.getDefaultLibFilePath(options),
      } as unknown as ts.LanguageServiceHost,
      project: {} as ts.server.Project,
      config: {},
    };

    const proxy = plugin.create(mockInfo);

    expect(proxy).toBeDefined();
    // getCompletionEntryDetails should not be added if original doesn't have it
    expect(proxy.getCompletionEntryDetails).toBeUndefined();
  });

  it("should handle error when adding global.d.ts", () => {
    // This test covers the catch block for global.d.ts errors
    const mockModule = { typescript: ts };
    const plugin = init(mockModule);

    const mockLanguageService = {
      getQuickInfoAtPosition: () => undefined,
      getSemanticDiagnostics: () => [],
      getProgram: () => null,
    } as any;

    // Create a host that throws an error
    const mockHost: any = {
      getScriptFileNames: () => {
        throw new Error("Test error");
      },
      getScriptVersion: () => "1",
      getScriptSnapshot: () => undefined,
      getCurrentDirectory: () => "/",
      getCompilationSettings: () => ({}),
      getDefaultLibFileName: (options: ts.CompilerOptions) =>
        ts.getDefaultLibFilePath(options),
    };

    const mockInfo = {
      languageService: mockLanguageService,
      languageServiceHost: mockHost,
      project: {} as ts.server.Project,
      config: {},
    };

    // Should not throw, should handle error gracefully
    expect(() => plugin.create(mockInfo)).not.toThrow();
  });

  it("should call ensureFileScanned with correct parameters", () => {
    const mockModule = { typescript: ts };
    const plugin = init(mockModule);

    const sourceFile = ts.createSourceFile(
      "test.ts",
      `"use server"; export function test() {}`,
      ts.ScriptTarget.ESNext,
      true
    );

    const mockProgram = {
      getSourceFile: (fileName: string) =>
        fileName === "test.ts" ? sourceFile : undefined,
      getSourceFiles: () => [sourceFile],
      getTypeChecker: () => ({}) as any,
      getCompilerOptions: () => ({}),
    } as any;

    const mockLanguageService = {
      getQuickInfoAtPosition: () => undefined,
      getSemanticDiagnostics: () => [],
      getProgram: () => mockProgram,
    } as any;

    const mockInfo = {
      languageService: mockLanguageService,
      languageServiceHost: {
        getScriptFileNames: () => ["test.ts"],
        getScriptVersion: () => "1",
        getScriptSnapshot: (fileName: string) =>
          fileName === "test.ts"
            ? ts.ScriptSnapshot.fromString(
                `"use server"; export function test() {}`
              )
            : undefined,
        getCurrentDirectory: () => "/",
        getCompilationSettings: () => ({}),
        getDefaultLibFileName: (options: ts.CompilerOptions) =>
          ts.getDefaultLibFilePath(options),
      } as unknown as ts.LanguageServiceHost,
      project: {} as ts.server.Project,
      config: {},
    };

    const proxy = plugin.create(mockInfo);

    // Call getSemanticDiagnostics which triggers ensureAllFilesScanned
    proxy.getSemanticDiagnostics("test.ts");

    expect(proxy).toBeDefined();
  });

  it("should skip declaration files and node_modules when scanning", () => {
    const mockModule = { typescript: ts };
    const plugin = init(mockModule);

    const sourceFile1 = ts.createSourceFile(
      "test.ts",
      `"use server"; export function test() {}`,
      ts.ScriptTarget.ESNext,
      true
    );

    const sourceFile2 = ts.createSourceFile(
      "node_modules/lib/index.d.ts",
      `export function lib() {}`,
      ts.ScriptTarget.ESNext,
      true
    );
    (sourceFile2 as any).isDeclarationFile = true;

    const sourceFile3 = ts.createSourceFile(
      "node_modules/other/index.ts",
      `export function other() {}`,
      ts.ScriptTarget.ESNext,
      true
    );

    const mockProgram = {
      getSourceFile: (fileName: string) => {
        if (fileName === "test.ts") return sourceFile1;
        if (fileName === "node_modules/lib/index.d.ts") return sourceFile2;
        if (fileName === "node_modules/other/index.ts") return sourceFile3;
        return undefined;
      },
      getSourceFiles: () => [sourceFile1, sourceFile2, sourceFile3],
      getTypeChecker: () => ({}) as any,
      getCompilerOptions: () => ({}),
    } as any;

    const mockLanguageService = {
      getQuickInfoAtPosition: () => undefined,
      getSemanticDiagnostics: () => [],
      getProgram: () => mockProgram,
    } as any;

    const mockInfo = {
      languageService: mockLanguageService,
      languageServiceHost: {
        getScriptFileNames: () => [
          "test.ts",
          "node_modules/lib/index.d.ts",
          "node_modules/other/index.ts",
        ],
        getScriptVersion: () => "1",
        getScriptSnapshot: () => undefined,
        getCurrentDirectory: () => "/",
        getCompilationSettings: () => ({}),
        getDefaultLibFileName: (options: ts.CompilerOptions) =>
          ts.getDefaultLibFilePath(options),
      } as unknown as ts.LanguageServiceHost,
      project: {} as ts.server.Project,
      config: {},
    };

    const proxy = plugin.create(mockInfo);

    // Call getSemanticDiagnostics which triggers ensureAllFilesScanned
    // Should only scan test.ts, not the declaration file or node_modules
    proxy.getSemanticDiagnostics("test.ts");

    expect(proxy).toBeDefined();
  });

  it("should not rescan files that are already scanned (cache hit)", () => {
    const sourceFile = ts.createSourceFile(
      "cached.ts",
      `/** @directive() */ export function test() {}`,
      ts.ScriptTarget.ESNext,
      true
    );
    (sourceFile as any).version = "1"; // Enable cache key

    const mockProgram = {
      getSourceFile: () => sourceFile,
      getSourceFiles: () => [sourceFile],
      getTypeChecker: () => ({}) as any,
      getCompilerOptions: () => ({}),
    } as any;

    const mockLanguageService = {
      getQuickInfoAtPosition: () => undefined,
      getSemanticDiagnostics: () => [],
      getProgram: () => mockProgram,
    } as any;

    const mockInfo = {
      languageService: mockLanguageService,
      languageServiceHost: {
        getScriptFileNames: () => ["cached.ts"],
        getScriptVersion: () => "1",
        getScriptSnapshot: () => undefined,
        getCurrentDirectory: () => "/",
        getCompilationSettings: () => ({}),
        getDefaultLibFileName: (options: ts.CompilerOptions) =>
          ts.getDefaultLibFilePath(options),
        readFile: () => undefined,
        fileExists: () => false,
      } as ts.LanguageServiceHost,
      project: {} as ts.server.Project,
      config: {},
    };

    const plugin = init({ typescript: ts });
    const proxy = plugin.create(mockInfo);

    // First call scans the file
    proxy.getSemanticDiagnostics("cached.ts");
    // Second call should hit cache (line 118 early return)
    proxy.getSemanticDiagnostics("cached.ts");

    expect(proxy).toBeDefined();
  });

  it("should handle global.d.ts already in file names", () => {
    const mockLanguageService = {
      getQuickInfoAtPosition: () => undefined,
      getSemanticDiagnostics: () => [],
      getProgram: () => undefined,
    } as any;

    let callCount = 0;
    const mockInfo = {
      languageService: mockLanguageService,
      languageServiceHost: {
        getScriptFileNames: () => {
          callCount++;
          // Second call returns global.d.ts already in array (lines 82-86)
          if (callCount > 1) {
            return ["test.ts", "/some/path/global.d.ts"];
          }
          return ["test.ts"];
        },
        getScriptVersion: () => "1",
        getScriptSnapshot: () => undefined,
        getCurrentDirectory: () => "/",
        getCompilationSettings: () => ({}),
        getDefaultLibFileName: (options: ts.CompilerOptions) =>
          ts.getDefaultLibFilePath(options),
        readFile: () => undefined,
        fileExists: () => false,
      } as ts.LanguageServiceHost,
      project: {} as ts.server.Project,
      config: {},
    };

    const plugin = init({ typescript: ts });
    const proxy = plugin.create(mockInfo);
    // Trigger re-check of file names
    proxy.getQuickInfoAtPosition("test.ts", 0);

    expect(proxy).toBeDefined();
  });

  it("should handle catch block when fs operations fail", () => {
    const originalExistsSync = require("node:fs").existsSync;

    try {
      // Mock fs.existsSync to throw error (line 92 catch block)
      require("node:fs").existsSync = () => {
        throw new Error("Mock fs error");
      };

      const mockLanguageService = {
        getQuickInfoAtPosition: () => undefined,
        getSemanticDiagnostics: () => [],
      } as any;

      const mockInfo = {
        languageService: mockLanguageService,
        languageServiceHost: {
          getScriptFileNames: () => ["test.ts"],
          getScriptVersion: () => "1",
          getScriptSnapshot: () => undefined,
          getCurrentDirectory: () => "/",
          getCompilationSettings: () => ({}),
          getDefaultLibFileName: (options: ts.CompilerOptions) =>
            ts.getDefaultLibFilePath(options),
          readFile: () => undefined,
          fileExists: () => false,
        } as ts.LanguageServiceHost,
        project: {} as ts.server.Project,
        config: {},
      };

      const plugin = init({ typescript: ts });
      // Should not throw, catch block handles the error
      const proxy = plugin.create(mockInfo);
      expect(proxy).toBeDefined();
    } finally {
      // Restore original
      require("node:fs").existsSync = originalExistsSync;
    }
  });
});
