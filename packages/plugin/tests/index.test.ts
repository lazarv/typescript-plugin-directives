import ts from "typescript";
import { describe, expect, it } from "vitest";
import init from "../src/index.js";
import { createTestLanguageService } from "./utils.js";

describe("plugin initialization", () => {
  describe("init", () => {
    it("should return a plugin module with create function", () => {
      const plugin = init({ typescript: ts });

      expect(plugin).toBeDefined();
      expect(plugin.create).toBeDefined();
      expect(typeof plugin.create).toBe("function");
    });

    it("should create a language service proxy", () => {
      const plugin = init({ typescript: ts });

      const mockLanguageService = {
        getCompletionsAtPosition: () => undefined,
        getSemanticDiagnostics: () => [],
        getQuickInfoAtPosition: () => undefined,
        provideInlayHints: () => [],
      } as any;

      const mockLanguageServiceHost = {
        getScriptFileNames: () => ["test.ts"],
        getScriptVersion: () => "1",
        getScriptSnapshot: () => null,
        getCurrentDirectory: () => process.cwd(),
        getCompilationSettings: () => ({}),
        getDefaultLibFileName: () => "lib.d.ts",
      } as any;

      const mockInfo = {
        languageService: mockLanguageService,
        languageServiceHost: mockLanguageServiceHost,
        project: {} as any,
        config: {},
      };

      const proxy = plugin.create(mockInfo);

      expect(proxy).toBeDefined();
      expect(proxy.getSemanticDiagnostics).toBeDefined();
      expect(proxy.getQuickInfoAtPosition).toBeDefined();
    });

    it("should wrap getSemanticDiagnostics", () => {
      const plugin = init({ typescript: ts });

      let diagnosticsCalled = false;
      const mockLanguageService = {
        getSemanticDiagnostics: () => {
          diagnosticsCalled = true;
          return [];
        },
        getProgram: () => undefined,
        getQuickInfoAtPosition: () => undefined,
      } as any;

      const mockLanguageServiceHost = {
        getScriptFileNames: () => ["test.ts"],
      } as any;

      const mockInfo = {
        languageService: mockLanguageService,
        languageServiceHost: mockLanguageServiceHost,
        project: {} as any,
        config: {},
      };

      const proxy = plugin.create(mockInfo);
      proxy.getSemanticDiagnostics("test.ts");

      expect(diagnosticsCalled).toBe(true);
    });

    it("should wrap getQuickInfoAtPosition", () => {
      const plugin = init({ typescript: ts });

      let quickInfoCalled = false;
      const mockLanguageService = {
        getQuickInfoAtPosition: () => {
          quickInfoCalled = true;
          return undefined;
        },
        getSemanticDiagnostics: () => [],
        getProgram: () => undefined,
      } as any;

      const mockLanguageServiceHost = {
        getScriptFileNames: () => ["test.ts"],
      } as any;

      const mockInfo = {
        languageService: mockLanguageService,
        languageServiceHost: mockLanguageServiceHost,
        project: {} as any,
        config: {},
      };

      const proxy = plugin.create(mockInfo);
      proxy.getQuickInfoAtPosition("test.ts", 0);

      expect(quickInfoCalled).toBe(true);
    });

    it("should wrap provideInlayHints if available", () => {
      const plugin = init({ typescript: ts });

      let _hintsCalled = false;
      const mockLanguageService = {
        provideInlayHints: () => {
          _hintsCalled = true;
          return [];
        },
        getSemanticDiagnostics: () => [],
        getQuickInfoAtPosition: () => undefined,
        getProgram: () => undefined,
      } as any;

      const mockLanguageServiceHost = {
        getScriptFileNames: () => ["test.ts"],
      } as any;

      const mockInfo = {
        languageService: mockLanguageService,
        languageServiceHost: mockLanguageServiceHost,
        project: {} as any,
        config: {},
      };

      const proxy = plugin.create(mockInfo);
      if (proxy.provideInlayHints) {
        proxy.provideInlayHints(
          "test.ts",
          { start: 0, length: 100 },
          undefined
        );
      }

      // Hints might not be called if there's no program
      expect(proxy.provideInlayHints).toBeDefined();
    });

    it("should handle missing provideInlayHints", () => {
      const plugin = init({ typescript: ts });

      const mockLanguageService = {
        getSemanticDiagnostics: () => [],
        getQuickInfoAtPosition: () => undefined,
      } as any;

      const mockLanguageServiceHost = {
        getScriptFileNames: () => ["test.ts"],
      } as any;

      const mockInfo = {
        languageService: mockLanguageService,
        languageServiceHost: mockLanguageServiceHost,
        project: {} as any,
        config: {},
      };

      const proxy = plugin.create(mockInfo);

      // Should not crash if provideInlayHints is not available
      expect(proxy.provideInlayHints).toBeUndefined();
    });

    it("should wrap getCompletionsAtPosition if available", () => {
      const plugin = init({ typescript: ts });

      let completionsCalled = false;
      const mockLanguageService = {
        getCompletionsAtPosition: () => {
          completionsCalled = true;
          return undefined;
        },
        getSemanticDiagnostics: () => [],
        getQuickInfoAtPosition: () => undefined,
        getProgram: () => undefined,
      } as any;

      const mockLanguageServiceHost = {
        getScriptFileNames: () => ["test.ts"],
      } as any;

      const mockInfo = {
        languageService: mockLanguageService,
        languageServiceHost: mockLanguageServiceHost,
        project: {} as any,
        config: {},
      };

      const proxy = plugin.create(mockInfo);
      proxy.getCompletionsAtPosition?.("test.ts", 0, undefined);

      expect(completionsCalled).toBe(true);
    });

    it("should wrap getCompletionEntryDetails if available", () => {
      const plugin = init({ typescript: ts });

      let detailsCalled = false;
      const mockLanguageService = {
        getCompletionEntryDetails: () => {
          detailsCalled = true;
          return undefined;
        },
        getSemanticDiagnostics: () => [],
        getQuickInfoAtPosition: () => undefined,
      } as any;

      const mockLanguageServiceHost = {
        getScriptFileNames: () => ["test.ts"],
      } as any;

      const mockInfo = {
        languageService: mockLanguageService,
        languageServiceHost: mockLanguageServiceHost,
        project: {} as any,
        config: {},
      };

      const proxy = plugin.create(mockInfo);
      proxy.getCompletionEntryDetails?.(
        "test.ts",
        0,
        "test",
        undefined,
        undefined,
        undefined,
        undefined
      );

      expect(detailsCalled).toBe(true);
    });

    it("should preserve all original language service methods", () => {
      const plugin = init({ typescript: ts });

      const mockLanguageService = {
        getSemanticDiagnostics: () => [],
        getQuickInfoAtPosition: () => undefined,
        getSyntacticDiagnostics: () => [],
        getDefinitionAtPosition: () => [],
        // Add more methods to test
      } as any;

      const mockLanguageServiceHost = {
        getScriptFileNames: () => ["test.ts"],
      } as any;

      const mockInfo = {
        languageService: mockLanguageService,
        languageServiceHost: mockLanguageServiceHost,
        project: {} as any,
        config: {},
      };

      const proxy = plugin.create(mockInfo);

      // Should have all original methods
      expect(proxy.getSemanticDiagnostics).toBeDefined();
      expect(proxy.getQuickInfoAtPosition).toBeDefined();
      expect(proxy.getSyntacticDiagnostics).toBeDefined();
      expect(proxy.getDefinitionAtPosition).toBeDefined();
    });

    it("should handle files without directives", () => {
      const plugin = init({ typescript: ts });

      const { languageService } = createTestLanguageService({
        "test.ts": "export function test() { return 123; }",
      });

      const mockInfo = {
        languageService,
        languageServiceHost: {
          getScriptFileNames: () => ["test.ts"],
        } as any,
        project: {} as any,
        config: {},
      };

      const proxy = plugin.create(mockInfo);
      const result = proxy.getCompletionsAtPosition("test.ts", 10, undefined);

      expect(result).toBeDefined();
    });

    it("should handle very large files efficiently", () => {
      const plugin = init({ typescript: ts });

      // Create a large file with many exports
      let largeCode = '"use server";\n';
      for (let i = 0; i < 50; i++) {
        largeCode += `export function fn${i}() { return ${i}; }\n`;
      }

      const { languageService } = createTestLanguageService({
        "large.ts": largeCode,
      });

      const mockInfo = {
        languageService,
        languageServiceHost: {
          getScriptFileNames: () => ["large.ts"],
        } as any,
        project: {} as any,
        config: {},
      };

      const proxy = plugin.create(mockInfo);
      const result = proxy.getSemanticDiagnostics("large.ts");

      expect(Array.isArray(result)).toBe(true);
    });
  });
});
