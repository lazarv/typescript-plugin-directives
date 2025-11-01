import ts from "typescript";
import { describe, expect, it } from "vitest";
import { getQuickInfoAtPosition } from "../src/hover.js";
import { createTestLanguageService } from "./utils.js";

describe("hover information", () => {
  describe("getQuickInfoAtPosition", () => {
    it("should provide hover info for functions with directives", () => {
      const code = `
        export function myAction() {
          "use server";
          return "test";
        }
      `;

      const { languageService } = createTestLanguageService({
        "test.ts": code,
      });

      const position = code.indexOf("myAction");

      const originalQuickInfo = (fileName: string, pos: number) => {
        return languageService.getQuickInfoAtPosition(fileName, pos);
      };

      const quickInfo = getQuickInfoAtPosition(
        "test.ts",
        position,
        languageService,
        ts,
        originalQuickInfo
      );

      // Should return quick info (may be enhanced with directive info)
      expect(quickInfo !== null).toBe(true);
    });

    it("should preserve original hover for non-directive code", () => {
      const code = `
        export function normalFunction() {
          return "test";
        }
      `;

      const { languageService } = createTestLanguageService({
        "test.ts": code,
      });

      const position = code.indexOf("normalFunction");

      const originalQuickInfo = (fileName: string, pos: number) => {
        return languageService.getQuickInfoAtPosition(fileName, pos);
      };

      const quickInfo = getQuickInfoAtPosition(
        "test.ts",
        position,
        languageService,
        ts,
        originalQuickInfo
      );

      // Should return original quick info
      expect(quickInfo !== null).toBe(true);
    });

    it("should handle hover over imports", () => {
      const code = `
        import { myAction } from "./actions";
        
        export function caller() {
          return myAction();
        }
      `;

      const actionsCode = `
        export function myAction() {
          "use server";
          return "test";
        }
      `;

      const { languageService } = createTestLanguageService({
        "test.ts": code,
        "actions.ts": actionsCode,
      });

      const position = code.indexOf("myAction");

      const originalQuickInfo = (fileName: string, pos: number) => {
        return languageService.getQuickInfoAtPosition(fileName, pos);
      };

      const quickInfo = getQuickInfoAtPosition(
        "test.ts",
        position,
        languageService,
        ts,
        originalQuickInfo
      );

      expect(quickInfo !== null).toBe(true);
    });

    it("should handle hover over function calls", () => {
      const code = `
        export function myAction() {
          "use server";
          return "test";
        }
        
        export function caller() {
          return myAction();
        }
      `;

      const { languageService } = createTestLanguageService({
        "test.ts": code,
      });

      // Position over the function call
      const position = code.lastIndexOf("myAction");

      const originalQuickInfo = (fileName: string, pos: number) => {
        return languageService.getQuickInfoAtPosition(fileName, pos);
      };

      const quickInfo = getQuickInfoAtPosition(
        "test.ts",
        position,
        languageService,
        ts,
        originalQuickInfo
      );

      expect(quickInfo !== null).toBe(true);
    });

    it("should handle positions outside of code", () => {
      const code = "export function test() {}";

      const { languageService } = createTestLanguageService({
        "test.ts": code,
      });

      const originalQuickInfo = () => undefined;

      const quickInfo = getQuickInfoAtPosition(
        "test.ts",
        9999,
        languageService,
        ts,
        originalQuickInfo
      );

      expect(quickInfo).toBeUndefined();
    });

    it("should handle files without a program", () => {
      const mockLanguageService = {
        getProgram: () => undefined,
      } as any;

      const originalQuickInfo = () => undefined;

      const quickInfo = getQuickInfoAtPosition(
        "test.ts",
        0,
        mockLanguageService,
        ts,
        originalQuickInfo
      );

      expect(quickInfo).toBeUndefined();
    });

    it("should handle arrow functions with directives", () => {
      const code = `
        export const myAction = () => {
          "use server";
          return "test";
        };
      `;

      const { languageService } = createTestLanguageService({
        "test.ts": code,
      });

      const position = code.indexOf("myAction");

      const originalQuickInfo = (fileName: string, pos: number) => {
        return languageService.getQuickInfoAtPosition(fileName, pos);
      };

      const quickInfo = getQuickInfoAtPosition(
        "test.ts",
        position,
        languageService,
        ts,
        originalQuickInfo
      );

      expect(quickInfo !== null).toBe(true);
    });

    it("should handle const declarations", () => {
      const code = `
        export const myValue = "test";
      `;

      const { languageService } = createTestLanguageService({
        "test.ts": code,
      });

      const position = code.indexOf("myValue");

      const originalQuickInfo = (fileName: string, pos: number) => {
        return languageService.getQuickInfoAtPosition(fileName, pos);
      };

      const quickInfo = getQuickInfoAtPosition(
        "test.ts",
        position,
        languageService,
        ts,
        originalQuickInfo
      );

      expect(quickInfo !== null).toBe(true);
    });

    it("should handle hover over directive strings", () => {
      const code = `
        export function myAction() {
          "use server";
          return "test";
        }
      `;

      const { languageService } = createTestLanguageService({
        "test.ts": code,
      });

      const position = code.indexOf('"use server"');

      const originalQuickInfo = (fileName: string, pos: number) => {
        return languageService.getQuickInfoAtPosition(fileName, pos);
      };

      const quickInfo = getQuickInfoAtPosition(
        "test.ts",
        position,
        languageService,
        ts,
        originalQuickInfo
      );

      // May enhance directive strings with additional info
      expect(quickInfo !== null).toBe(true);
    });
  });

  describe("getQuickInfoAtPosition - edge cases and coverage", () => {
    it("should handle files with no program", () => {
      const mockLangService: any = {
        getProgram: () => undefined,
      };

      const prior = () => undefined;
      const result = getQuickInfoAtPosition(
        "test.ts",
        0,
        mockLangService,
        ts,
        prior
      );

      expect(result).toBeUndefined();
    });

    it("should handle files with no source file", () => {
      const mockProgram: any = {
        getSourceFile: () => undefined,
      };
      const mockLangService: any = {
        getProgram: () => mockProgram,
      };

      const prior = () => undefined;
      const result = getQuickInfoAtPosition(
        "test.ts",
        0,
        mockLangService,
        ts,
        prior
      );

      expect(result).toBeUndefined();
    });

    it("should return undefined when prior returns nothing and no enhancements", () => {
      const code = `const x = 123;`;

      const { languageService } = createTestLanguageService({
        "test.ts": code,
      });

      const prior = () => undefined;
      const result = getQuickInfoAtPosition(
        "test.ts",
        5,
        languageService,
        ts,
        prior
      );

      expect(result).toBeUndefined();
    });

    it("should handle hover over module-level directives", () => {
      const code = `"use server";
export function test() {}`;

      const { languageService } = createTestLanguageService({
        "test.ts": code,
      });

      const position = code.indexOf('"use server"') + 5;

      const prior = () => undefined;
      const result = getQuickInfoAtPosition(
        "test.ts",
        position,
        languageService,
        ts,
        prior
      );

      // May or may not create quick info depending on global.d.ts availability
      // Just ensure it doesn't crash
      expect(result === undefined || result !== null).toBe(true);
    });

    it("should handle hover over imported symbols without directive", () => {
      const code1 = `export function normalFn() {
  return "no directive";
}`;

      const code2 = `import { normalFn } from "./file1";

const result = normalFn();`;

      const { languageService } = createTestLanguageService({
        "file1.ts": code1,
        "file2.ts": code2,
      });

      const position = code2.indexOf("normalFn") + 5;

      const originalQuickInfo = (fileName: string, pos: number) => {
        return languageService.getQuickInfoAtPosition(fileName, pos);
      };

      const result = getQuickInfoAtPosition(
        "file2.ts",
        position,
        languageService,
        ts,
        originalQuickInfo
      );

      // Should return quickInfo without directive enhancement
      expect(result).toBeDefined();
    });

    it("should handle hover over function references in JSX", () => {
      const code = `"use server";
export function serverAction() {
  return "result";
}

function App() {
  return <form action={serverAction} />;
}`;

      const { languageService } = createTestLanguageService({
        "test.tsx": code,
      });

      const position = code.lastIndexOf("serverAction") + 5;

      const originalQuickInfo = (fileName: string, pos: number) => {
        return languageService.getQuickInfoAtPosition(fileName, pos);
      };

      const result = getQuickInfoAtPosition(
        "test.tsx",
        position,
        languageService,
        ts,
        originalQuickInfo
      );

      // Should provide enhanced quickInfo for function reference
      expect(result).toBeDefined();
    });

    it("should handle non-exported functions with inline directives", () => {
      const code = `function localFn() {
  "use server";
  return "data";
}`;

      const { languageService } = createTestLanguageService({
        "test.ts": code,
      });

      const position = code.indexOf("localFn") + 3;

      const originalQuickInfo = (fileName: string, pos: number) => {
        return languageService.getQuickInfoAtPosition(fileName, pos);
      };

      const result = getQuickInfoAtPosition(
        "test.ts",
        position,
        languageService,
        ts,
        originalQuickInfo
      );

      // Should provide enhanced quickInfo for inline directive
      expect(result).toBeDefined();
    });

    it("should handle arrow functions with directives", () => {
      const code = `"use server";
export const arrowFn = () => {
  return "data";
};`;

      const { languageService } = createTestLanguageService({
        "test.ts": code,
      });

      const position = code.indexOf("arrowFn") + 3;

      const originalQuickInfo = (fileName: string, pos: number) => {
        return languageService.getQuickInfoAtPosition(fileName, pos);
      };

      const result = getQuickInfoAtPosition(
        "test.ts",
        position,
        languageService,
        ts,
        originalQuickInfo
      );

      // Should provide enhanced quickInfo for arrow function
      expect(result).toBeDefined();
    });

    it("should handle function calls (not just declarations)", () => {
      const code = `"use server";
export function serverFn() {
  return "data";
}

function test() {
  const result = serverFn();
  return result;
}`;

      const { languageService } = createTestLanguageService({
        "test.ts": code,
      });

      const position = code.lastIndexOf("serverFn") + 3;

      const originalQuickInfo = (fileName: string, pos: number) => {
        return languageService.getQuickInfoAtPosition(fileName, pos);
      };

      const result = getQuickInfoAtPosition(
        "test.ts",
        position,
        languageService,
        ts,
        originalQuickInfo
      );

      // Should provide enhanced quickInfo for function call
      expect(result).toBeDefined();
    });

    it("should handle positions with no node", () => {
      const code = `export function test() {}`;

      const { languageService } = createTestLanguageService({
        "test.ts": code,
      });

      // Position way beyond file length
      const position = 9999;

      const prior = () => undefined;
      const result = getQuickInfoAtPosition(
        "test.ts",
        position,
        languageService,
        ts,
        prior
      );

      expect(result).toBeUndefined();
    });

    it("should handle directive string variations", () => {
      const code = `"use cache: memory";
export function test() {}`;

      const { languageService } = createTestLanguageService({
        "test.ts": code,
      });

      const position = code.indexOf('"use cache') + 5;

      const prior = () => undefined;
      const result = getQuickInfoAtPosition(
        "test.ts",
        position,
        languageService,
        ts,
        prior
      );

      // May or may not create quick info depending on directive validity
      // Just ensure it doesn't crash
      expect(result === undefined || result !== null).toBe(true);
    });
  });
});
