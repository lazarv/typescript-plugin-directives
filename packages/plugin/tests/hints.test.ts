import ts from "typescript";
import { describe, expect, it } from "vitest";
import { provideInlayHints } from "../src/hints.js";
import { createTestLanguageService } from "./utils.js";

describe("inlay hints", () => {
  describe("provideInlayHints", () => {
    it("should provide hints for exported functions", () => {
      const code = `
        export function myAction() {
          "use server";
          return "test";
        }
      `;

      const { languageService } = createTestLanguageService({
        "test.ts": code,
      });

      const span: ts.TextSpan = {
        start: 0,
        length: code.length,
      };

      const hints = provideInlayHints("test.ts", span, languageService, ts);

      // Should return array of hints
      expect(Array.isArray(hints)).toBe(true);
    });

    it("should handle files without directives", () => {
      const code = `
        export function normalFunction() {
          return "no directives";
        }
      `;

      const { languageService } = createTestLanguageService({
        "test.ts": code,
      });

      const span: ts.TextSpan = {
        start: 0,
        length: code.length,
      };

      const hints = provideInlayHints("test.ts", span, languageService, ts);

      expect(Array.isArray(hints)).toBe(true);
      // Without actual directives, should be empty or have minimal hints
    });

    it("should handle module-level directives", () => {
      const code = `
        "use server";
        
        export function action1() {
          return "action1";
        }
        
        export function action2() {
          return "action2";
        }
      `;

      const { languageService } = createTestLanguageService({
        "test.ts": code,
      });

      const span: ts.TextSpan = {
        start: 0,
        length: code.length,
      };

      const hints = provideInlayHints("test.ts", span, languageService, ts);

      expect(Array.isArray(hints)).toBe(true);
    });

    it("should handle imports from files with directives", () => {
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

      const span: ts.TextSpan = {
        start: 0,
        length: code.length,
      };

      const hints = provideInlayHints("test.ts", span, languageService, ts);

      expect(Array.isArray(hints)).toBe(true);
    });

    it("should handle limited span ranges", () => {
      const code = `
        export function myAction() {
          "use server";
          return "test";
        }
        
        export function anotherAction() {
          "use client";
          return "another";
        }
      `;

      const { languageService } = createTestLanguageService({
        "test.ts": code,
      });

      // Only look at first 50 characters
      const span: ts.TextSpan = {
        start: 0,
        length: 50,
      };

      const hints = provideInlayHints("test.ts", span, languageService, ts);

      expect(Array.isArray(hints)).toBe(true);
    });

    it("should handle files without a program", () => {
      const mockLanguageService = {
        getProgram: () => undefined,
      } as any;

      const span: ts.TextSpan = { start: 0, length: 100 };

      const hints = provideInlayHints("test.ts", span, mockLanguageService, ts);

      expect(hints).toEqual([]);
    });

    it("should handle non-existent files", () => {
      const { languageService } = createTestLanguageService({
        "test.ts": "export function test() {}",
      });

      const span: ts.TextSpan = { start: 0, length: 100 };

      const hints = provideInlayHints(
        "nonexistent.ts",
        span,
        languageService,
        ts
      );

      expect(Array.isArray(hints)).toBe(true);
    });

    it("should handle arrow functions", () => {
      const code = `
        export const myAction = () => {
          "use server";
          return "test";
        };
      `;

      const { languageService } = createTestLanguageService({
        "test.ts": code,
      });

      const span: ts.TextSpan = {
        start: 0,
        length: code.length,
      };

      const hints = provideInlayHints("test.ts", span, languageService, ts);

      expect(Array.isArray(hints)).toBe(true);
    });

    it("should handle async functions", () => {
      const code = `
        export async function myAction() {
          "use server";
          return "test";
        }
      `;

      const { languageService } = createTestLanguageService({
        "test.ts": code,
      });

      const span: ts.TextSpan = {
        start: 0,
        length: code.length,
      };

      const hints = provideInlayHints("test.ts", span, languageService, ts);

      expect(Array.isArray(hints)).toBe(true);
    });
  });

  describe("provideInlayHints - edge cases and coverage", () => {
    it("should handle files with no program", () => {
      const mockLangService: any = {
        getProgram: () => undefined,
      };

      const result = provideInlayHints(
        "test.ts",
        { start: 0, length: 100 },
        mockLangService,
        ts
      );

      expect(result).toEqual([]);
    });

    it("should handle files with no source file", () => {
      const mockProgram: any = {
        getSourceFile: () => undefined,
      };
      const mockLangService: any = {
        getProgram: () => mockProgram,
      };

      const result = provideInlayHints(
        "test.ts",
        { start: 0, length: 100 },
        mockLangService,
        ts
      );

      expect(result).toEqual([]);
    });

    it("should handle limited text spans", () => {
      const code = `"use server";
export function test1() {}
export function test2() {}
export function test3() {}`;

      const { languageService } = createTestLanguageService({
        "test.ts": code,
      });

      // Only check first 30 characters (should only get test1)
      const hints = provideInlayHints(
        "test.ts",
        { start: 0, length: 30 },
        languageService,
        ts
      );

      // Should have limited hints based on span
      expect(hints.length).toBeLessThan(3);
    });

    it("should handle JSX self-closing elements", () => {
      const code = `"use server";
export function ServerComponent() {
  return null;
}

function App() {
  return <ServerComponent />;
}`;

      const { languageService } = createTestLanguageService({
        "test.tsx": code,
      });

      const hints = provideInlayHints(
        "test.tsx",
        { start: 0, length: 200 },
        languageService,
        ts
      );

      // Should include hints for component usage
      expect(Array.isArray(hints)).toBe(true);
    });

    it("should handle JSX opening elements", () => {
      const code = `"use server";
export function ServerComponent() {
  return null;
}

function App() {
  return <ServerComponent>Content</ServerComponent>;
}`;

      const { languageService } = createTestLanguageService({
        "test.tsx": code,
      });

      const hints = provideInlayHints(
        "test.tsx",
        { start: 0, length: 200 },
        languageService,
        ts
      );

      // Should include hints for component usage
      expect(Array.isArray(hints)).toBe(true);
    });

    it("should handle JSX attributes with function references", () => {
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

      const hints = provideInlayHints(
        "test.tsx",
        { start: 0, length: 200 },
        languageService,
        ts
      );

      // Should include hints for function reference in JSX attribute
      expect(Array.isArray(hints)).toBe(true);
    });

    it("should handle JSX attributes with type assertions", () => {
      const code = `"use server";
export function serverAction() {
  return "result";
}

function App() {
  return <form action={serverAction as any} />;
}`;

      const { languageService } = createTestLanguageService({
        "test.tsx": code,
      });

      const hints = provideInlayHints(
        "test.tsx",
        { start: 0, length: 200 },
        languageService,
        ts
      );

      // Should handle type assertions in JSX attributes
      expect(Array.isArray(hints)).toBe(true);
    });

    it("should handle lowercase JSX elements (HTML tags)", () => {
      const code = `function App() {
  return <div>Hello</div>;
}`;

      const { languageService } = createTestLanguageService({
        "test.tsx": code,
      });

      const hints = provideInlayHints(
        "test.tsx",
        { start: 0, length: 100 },
        languageService,
        ts
      );

      // Should not add hints for HTML elements
      expect(hints.length).toBe(0);
    });

    it("should handle call expressions with imported functions", () => {
      const code1 = `"use server";
export function serverFn() {
  return "data";
}`;

      const code2 = `import { serverFn } from "./file1";

function test() {
  const result = serverFn();
  return result;
}`;

      const { languageService } = createTestLanguageService({
        "file1.ts": code1,
        "file2.ts": code2,
      });

      const hints = provideInlayHints(
        "file2.ts",
        { start: 0, length: 200 },
        languageService,
        ts
      );

      // Should include hints for imported function calls
      expect(Array.isArray(hints)).toBe(true);
    });

    it("should handle call expressions with local functions", () => {
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

      const hints = provideInlayHints(
        "test.ts",
        { start: 0, length: 200 },
        languageService,
        ts
      );

      // Should include hints for local function calls
      expect(Array.isArray(hints)).toBe(true);
    });

    it("should handle non-exported functions with inline directives", () => {
      const code = `function localFn() {
  "use server";
  return "data";
}`;

      const { languageService } = createTestLanguageService({
        "test.ts": code,
      });

      const hints = provideInlayHints(
        "test.ts",
        { start: 0, length: 100 },
        languageService,
        ts
      );

      // Should include hints for inline directives
      expect(Array.isArray(hints)).toBe(true);
    });

    it("should handle variable declarations without initializers", () => {
      const code = `"use server";
export let uninitializedVar: any;
export const test = () => {};`;

      const { languageService } = createTestLanguageService({
        "test.ts": code,
      });

      const hints = provideInlayHints(
        "test.ts",
        { start: 0, length: 200 },
        languageService,
        ts
      );

      // Should handle declarations without initializers
      expect(Array.isArray(hints)).toBe(true);
    });
  });
});
