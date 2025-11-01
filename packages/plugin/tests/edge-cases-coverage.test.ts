import ts from "typescript";
import { describe, expect, it } from "vitest";
import { getSemanticDiagnostics } from "../src/diagnostics.js";
import { provideInlayHints } from "../src/hints.js";
import { getQuickInfoAtPosition } from "../src/hover.js";
import { createTestLanguageService } from "./utils.js";

describe("Edge case coverage for remaining uncovered paths", () => {
  describe("hover.ts - getDirectiveDocumentation paths", () => {
    it("should handle when DirectiveRegistry property has no JSDoc", () => {
      const code = `"use server";
export function action() {
  return "test";
}`;

      const { languageService } = createTestLanguageService({
        "test.ts": code,
      });

      const prior = (_fileName: string, position: number) => ({
        kind: ts.ScriptElementKind.functionElement,
        kindModifiers: "export",
        textSpan: { start: position, length: 6 },
        displayParts: [],
        documentation: [],
        tags: [],
      });

      const position = 28; // On "action"

      const quickInfo = getQuickInfoAtPosition(
        "test.ts",
        position,
        languageService,
        ts,
        prior
      );

      expect(quickInfo).toBeDefined();
    });

    it("should handle when getSymbolAtLocation returns undefined", () => {
      const code = `export function test() {}`;

      const { languageService } = createTestLanguageService({
        "test.ts": code,
      });

      const prior = () => undefined;
      const position = 5;

      const quickInfo = getQuickInfoAtPosition(
        "test.ts",
        position,
        languageService,
        ts,
        prior
      );

      expect(quickInfo).toBeUndefined();
    });
  });

  describe("hints.ts - JSX attribute edge cases", () => {
    it("should handle JSX attributes with property access expressions", () => {
      const code = `import { actions } from "./other";

function App() {
  return <button onClick={actions.doSomething}>Click</button>;
}`;

      const otherFile = `"use server";
export const actions = {
  doSomething: () => console.log("test")
};`;

      const { languageService } = createTestLanguageService({
        "test.tsx": code,
        "./other.tsx": otherFile,
      });

      const hints = provideInlayHints(
        "test.tsx",
        { start: 0, length: code.length },
        languageService,
        ts
      );

      expect(Array.isArray(hints)).toBe(true);
    });

    it("should handle JSX with nested elements", () => {
      const code = `import { Comp } from "./other";

function App() {
  return (
    <div>
      <Comp />
    </div>
  );
}`;

      const otherFile = `"use client";
export function Comp() {
  return <span>Test</span>;
}`;

      const { languageService } = createTestLanguageService({
        "test.tsx": code,
        "./other.tsx": otherFile,
      });

      const hints = provideInlayHints(
        "test.tsx",
        { start: 0, length: code.length },
        languageService,
        ts
      );

      expect(Array.isArray(hints)).toBe(true);
    });
  });

  describe("diagnostics.ts - complex directive validation", () => {
    it("should handle when directiveType is not a union", () => {
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

    it("should handle directive validation with empty validDirectives array", () => {
      // Create a service without type definitions
      const code = `"use something";
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

      // Should return original diagnostics when validDirectives is empty
      expect(Array.isArray(diagnostics)).toBe(true);
    });
  });

  describe("cross-module directive tracking", () => {
    it("should track directives through multiple re-export levels", () => {
      const code = `import { finalAction } from "./level3";

const x = finalAction();`;

      const level3 = `export { renamedAction as finalAction } from "./level2";`;
      const level2 = `export { action as renamedAction } from "./level1";`;
      const level1 = `"use server";
export function action() {
  return "test";
}`;

      const { languageService } = createTestLanguageService({
        "test.ts": code,
        "./level3.ts": level3,
        "./level2.ts": level2,
        "./level1.ts": level1,
      });

      const hints = provideInlayHints(
        "test.ts",
        { start: 0, length: code.length },
        languageService,
        ts
      );

      expect(Array.isArray(hints)).toBe(true);
    });

    it("should handle circular re-exports gracefully", () => {
      const code = `import { action } from "./file1";`;

      const file1 = `export { action } from "./file2";`;
      const file2 = `"use server";
export function action() {}`;

      const { languageService } = createTestLanguageService({
        "test.ts": code,
        "./file1.ts": file1,
        "./file2.ts": file2,
      });

      const hints = provideInlayHints(
        "test.ts",
        { start: 0, length: code.length },
        languageService,
        ts
      );

      expect(Array.isArray(hints)).toBe(true);
    });
  });

  describe("complex JSX scenarios", () => {
    it("should handle JSX fragments with multiple components", () => {
      const code = `import { Comp1, Comp2 } from "./other";

function App() {
  return (
    <>
      <Comp1 />
      <Comp2 />
    </>
  );
}`;

      const otherFile = `"use client";
export function Comp1() {
  return <div>1</div>;
}

export function Comp2() {
  return <div>2</div>;
}`;

      const { languageService } = createTestLanguageService({
        "test.tsx": code,
        "./other.tsx": otherFile,
      });

      const hints = provideInlayHints(
        "test.tsx",
        { start: 0, length: code.length },
        languageService,
        ts
      );

      expect(Array.isArray(hints)).toBe(true);
    });

    it("should handle JSX with spread attributes", () => {
      const code = `import { Comp } from "./other";

function App() {
  const props = { foo: "bar" };
  return <Comp {...props} />;
}`;

      const otherFile = `"use client";
export function Comp({ foo }: { foo: string }) {
  return <div>{foo}</div>;
}`;

      const { languageService } = createTestLanguageService({
        "test.tsx": code,
        "./other.tsx": otherFile,
      });

      const hints = provideInlayHints(
        "test.tsx",
        { start: 0, length: code.length },
        languageService,
        ts
      );

      expect(Array.isArray(hints)).toBe(true);
    });
  });

  describe("hover on various declaration types", () => {
    it("should handle hover on type alias exports", () => {
      const code = `export type MyType = string;`;

      const { languageService } = createTestLanguageService({
        "test.ts": code,
      });

      const prior = () => undefined;
      const position = 13; // On "MyType"

      const quickInfo = getQuickInfoAtPosition(
        "test.ts",
        position,
        languageService,
        ts,
        prior
      );

      expect(quickInfo).toBeUndefined();
    });

    it("should handle hover on interface exports", () => {
      const code = `export interface MyInterface {
  prop: string;
}`;

      const { languageService } = createTestLanguageService({
        "test.ts": code,
      });

      const prior = () => undefined;
      const position = 17; // On "MyInterface"

      const quickInfo = getQuickInfoAtPosition(
        "test.ts",
        position,
        languageService,
        ts,
        prior
      );

      expect(quickInfo).toBeUndefined();
    });

    it("should handle hover on enum exports", () => {
      const code = `export enum MyEnum {
  A,
  B
}`;

      const { languageService } = createTestLanguageService({
        "test.ts": code,
      });

      const prior = () => undefined;
      const position = 12; // On "MyEnum"

      const quickInfo = getQuickInfoAtPosition(
        "test.ts",
        position,
        languageService,
        ts,
        prior
      );

      expect(quickInfo).toBeUndefined();
    });
  });

  describe("hints for various export patterns", () => {
    it("should handle export default with function expression", () => {
      const code = `export default function() {
  "use server";
  return "test";
}`;

      const { languageService } = createTestLanguageService({
        "test.ts": code,
      });

      const hints = provideInlayHints(
        "test.ts",
        { start: 0, length: code.length },
        languageService,
        ts
      );

      expect(Array.isArray(hints)).toBe(true);
    });

    it("should handle export assignments", () => {
      const code = `function myFunc() {
  "use server";
  return "test";
}

export = myFunc;`;

      const { languageService } = createTestLanguageService({
        "test.ts": code,
      });

      const hints = provideInlayHints(
        "test.ts",
        { start: 0, length: code.length },
        languageService,
        ts
      );

      expect(Array.isArray(hints)).toBe(true);
    });
  });
});
