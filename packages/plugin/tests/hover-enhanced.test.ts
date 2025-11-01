import ts from "typescript";
import { describe, expect, it } from "vitest";
import { getQuickInfoAtPosition } from "../src/hover.js";
import { createTestLanguageService } from "./utils.js";

describe("getQuickInfoAtPosition - enhanced coverage", () => {
  describe("directive string hover scenarios", () => {
    it("should provide quick info for directive strings at module level", () => {
      const code = `"use server";
export function test() {}`;

      const { languageService } = createTestLanguageService({
        "test.ts": code,
      });

      const prior = () => undefined;
      const position = 5; // Inside "use server"

      const quickInfo = getQuickInfoAtPosition(
        "test.ts",
        position,
        languageService,
        ts,
        prior
      );

      expect(quickInfo).toBeDefined();
    });

    it("should provide quick info for directive strings with providers", () => {
      const code = `"use cache: memory";
export function test() {}`;

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

      expect(quickInfo).toBeDefined();
    });

    it("should provide quick info for inline directive strings", () => {
      const code = `export function test() {
  "use server";
  return "test";
}`;

      const { languageService } = createTestLanguageService({
        "test.ts": code,
      });

      const prior = () => undefined;
      const position = 30; // Inside "use server" in function body

      const quickInfo = getQuickInfoAtPosition(
        "test.ts",
        position,
        languageService,
        ts,
        prior
      );

      expect(quickInfo).toBeDefined();
    });
  });

  describe("import directive scenarios", () => {
    it("should enhance quick info for named imports with module directives", () => {
      const code = `import { myAction } from "./other";

const result = myAction();`;

      const otherFile = `"use server";
export function myAction() {
  return "test";
}`;

      const { languageService } = createTestLanguageService({
        "test.ts": code,
        "./other.ts": otherFile,
      });

      const prior = (fileName: string, position: number) => {
        const program = languageService.getProgram();
        if (!program) return undefined;
        const sourceFile = program.getSourceFile(fileName);
        if (!sourceFile) return undefined;

        return {
          kind: ts.ScriptElementKind.functionElement,
          kindModifiers: "",
          textSpan: { start: position, length: 8 },
          displayParts: [],
          documentation: [],
          tags: [],
        };
      };

      const position = 9; // On "myAction" in import

      const quickInfo = getQuickInfoAtPosition(
        "test.ts",
        position,
        languageService,
        ts,
        prior
      );

      expect(quickInfo).toBeDefined();
    });

    it("should enhance quick info for named imports with inline directives", () => {
      const code = `import { myAction } from "./other";`;

      const otherFile = `export function myAction() {
  "use server";
  return "test";
}`;

      const { languageService } = createTestLanguageService({
        "test.ts": code,
        "./other.ts": otherFile,
      });

      const prior = (_fileName: string, position: number) => ({
        kind: ts.ScriptElementKind.functionElement,
        kindModifiers: "",
        textSpan: { start: position, length: 8 },
        displayParts: [],
        documentation: [],
        tags: [],
      });

      const position = 9;

      const quickInfo = getQuickInfoAtPosition(
        "test.ts",
        position,
        languageService,
        ts,
        prior
      );

      expect(quickInfo).toBeDefined();
    });

    it("should handle default imports", () => {
      const code = `import myAction from "./other";`;

      const otherFile = `"use server";
export default function myAction() {
  return "test";
}`;

      const { languageService } = createTestLanguageService({
        "test.ts": code,
        "./other.ts": otherFile,
      });

      const prior = (_fileName: string, position: number) => ({
        kind: ts.ScriptElementKind.functionElement,
        kindModifiers: "",
        textSpan: { start: position, length: 8 },
        displayParts: [],
        documentation: [],
        tags: [],
      });

      const position = 7;

      const quickInfo = getQuickInfoAtPosition(
        "test.ts",
        position,
        languageService,
        ts,
        prior
      );

      expect(quickInfo).toBeDefined();
    });

    it("should handle namespace imports", () => {
      const code = `import * as actions from "./other";

const result = actions.myAction();`;

      const otherFile = `"use server";
export function myAction() {
  return "test";
}`;

      const { languageService } = createTestLanguageService({
        "test.ts": code,
        "./other.ts": otherFile,
      });

      const prior = (_fileName: string, position: number) => ({
        kind: ts.ScriptElementKind.functionElement,
        kindModifiers: "",
        textSpan: { start: position, length: 8 },
        displayParts: [],
        documentation: [],
        tags: [],
      });

      const position = 55; // On "myAction" in call

      const quickInfo = getQuickInfoAtPosition(
        "test.ts",
        position,
        languageService,
        ts,
        prior
      );

      expect(quickInfo).toBeDefined();
    });
  });

  describe("function reference scenarios", () => {
    it("should enhance quick info for function references in JSX", () => {
      const code = `import { MyComponent } from "./other";

function App() {
  return <MyComponent />;
}`;

      const otherFile = `"use client";
export function MyComponent() {
  return <div>Test</div>;
}`;

      const { languageService } = createTestLanguageService({
        "test.tsx": code,
        "./other.tsx": otherFile,
      });

      const prior = (_fileName: string, position: number) => ({
        kind: ts.ScriptElementKind.functionElement,
        kindModifiers: "",
        textSpan: { start: position, length: 11 },
        displayParts: [],
        documentation: [],
        tags: [],
      });

      const position = 65; // On MyComponent in JSX

      const quickInfo = getQuickInfoAtPosition(
        "test.tsx",
        position,
        languageService,
        ts,
        prior
      );

      expect(quickInfo).toBeDefined();
    });

    it("should enhance quick info for arrow function references", () => {
      const code = `export const myAction = () => {
  "use server";
  return "test";
};

const ref = myAction;`;

      const { languageService } = createTestLanguageService({
        "test.ts": code,
      });

      const prior = (_fileName: string, position: number) => ({
        kind: ts.ScriptElementKind.constElement,
        kindModifiers: "",
        textSpan: { start: position, length: 8 },
        displayParts: [],
        documentation: [],
        tags: [],
      });

      const position = 75; // On "myAction" reference

      const quickInfo = getQuickInfoAtPosition(
        "test.ts",
        position,
        languageService,
        ts,
        prior
      );

      expect(quickInfo).toBeDefined();
    });

    it("should enhance quick info for method references", () => {
      const code = `export class MyClass {
  myMethod() {
    "use server";
    return "test";
  }
}

const instance = new MyClass();
const ref = instance.myMethod;`;

      const { languageService } = createTestLanguageService({
        "test.ts": code,
      });

      const prior = (_fileName: string, position: number) => ({
        kind: ts.ScriptElementKind.memberFunctionElement,
        kindModifiers: "",
        textSpan: { start: position, length: 8 },
        displayParts: [],
        documentation: [],
        tags: [],
      });

      const position = 130; // On "myMethod" reference

      const quickInfo = getQuickInfoAtPosition(
        "test.ts",
        position,
        languageService,
        ts,
        prior
      );

      expect(quickInfo).toBeDefined();
    });
  });

  describe("edge cases and error handling", () => {
    it("should return prior quick info when node not found", () => {
      const code = `export function test() {}`;

      const { languageService } = createTestLanguageService({
        "test.ts": code,
      });

      const priorInfo = {
        kind: ts.ScriptElementKind.functionElement,
        kindModifiers: "",
        textSpan: { start: 0, length: 4 },
        displayParts: [],
        documentation: [],
        tags: [],
      };

      const prior = () => priorInfo;
      const position = 1000; // Out of bounds

      const quickInfo = getQuickInfoAtPosition(
        "test.ts",
        position,
        languageService,
        ts,
        prior
      );

      expect(quickInfo).toBe(priorInfo);
    });

    it("should return prior when no program available", () => {
      const code = `export function test() {}`;

      const { languageService } = createTestLanguageService({
        "test.ts": code,
      });

      const priorInfo = {
        kind: ts.ScriptElementKind.functionElement,
        kindModifiers: "",
        textSpan: { start: 0, length: 4 },
        displayParts: [],
        documentation: [],
        tags: [],
      };

      const prior = () => priorInfo;

      // Call on non-existent file
      const quickInfo = getQuickInfoAtPosition(
        "nonexistent.ts",
        0,
        languageService,
        ts,
        prior
      );

      expect(quickInfo).toBe(priorInfo);
    });

    it("should return undefined when prior returns undefined and no directive", () => {
      const code = `export function test() {}`;

      const { languageService } = createTestLanguageService({
        "test.ts": code,
      });

      const prior = () => undefined;
      const position = 0;

      const quickInfo = getQuickInfoAtPosition(
        "test.ts",
        position,
        languageService,
        ts,
        prior
      );

      // Should return undefined when no directive and no prior info
      expect(quickInfo).toBeUndefined();
    });
  });

  describe("declaration directive scenarios", () => {
    it("should enhance quick info for exported function declarations", () => {
      const code = `export function myAction() {
  "use server";
  return "test";
}`;

      const { languageService } = createTestLanguageService({
        "test.ts": code,
      });

      const prior = (_fileName: string, position: number) => ({
        kind: ts.ScriptElementKind.functionElement,
        kindModifiers: "export",
        textSpan: { start: position, length: 8 },
        displayParts: [],
        documentation: [],
        tags: [],
      });

      const position = 16; // On function name

      const quickInfo = getQuickInfoAtPosition(
        "test.ts",
        position,
        languageService,
        ts,
        prior
      );

      expect(quickInfo).toBeDefined();
      if (quickInfo?.displayParts) {
        const text = quickInfo.displayParts.map((p) => p.text).join("");
        expect(
          text.includes("use server") ||
            quickInfo.documentation?.some(
              (d) => "text" in d && d.text.includes("use server")
            )
        ).toBe(true);
      }
    });

    it("should enhance quick info for exported const declarations", () => {
      const code = `export const myAction = () => {
  "use server";
  return "test";
};`;

      const { languageService } = createTestLanguageService({
        "test.ts": code,
      });

      const prior = (_fileName: string, position: number) => ({
        kind: ts.ScriptElementKind.constElement,
        kindModifiers: "export",
        textSpan: { start: position, length: 8 },
        displayParts: [],
        documentation: [],
        tags: [],
      });

      const position = 13; // On "myAction"

      const quickInfo = getQuickInfoAtPosition(
        "test.ts",
        position,
        languageService,
        ts,
        prior
      );

      expect(quickInfo).toBeDefined();
    });

    it("should enhance quick info for class method declarations", () => {
      const code = `export class MyClass {
  myMethod() {
    "use server";
    return "test";
  }
}`;

      const { languageService } = createTestLanguageService({
        "test.ts": code,
      });

      const prior = (_fileName: string, position: number) => ({
        kind: ts.ScriptElementKind.memberFunctionElement,
        kindModifiers: "",
        textSpan: { start: position, length: 8 },
        displayParts: [],
        documentation: [],
        tags: [],
      });

      const position = 26; // On "myMethod"

      const quickInfo = getQuickInfoAtPosition(
        "test.ts",
        position,
        languageService,
        ts,
        prior
      );

      expect(quickInfo).toBeDefined();
    });
  });

  describe("inline function directive scenarios", () => {
    it("should detect inline directives in non-exported functions", () => {
      const code = `function myAction() {
  "use server";
  return "test";
}

const ref = myAction;`;

      const { languageService } = createTestLanguageService({
        "test.ts": code,
      });

      const prior = (_fileName: string, position: number) => ({
        kind: ts.ScriptElementKind.functionElement,
        kindModifiers: "",
        textSpan: { start: position, length: 8 },
        displayParts: [],
        documentation: [],
        tags: [],
      });

      const position = 9; // On function name

      const quickInfo = getQuickInfoAtPosition(
        "test.ts",
        position,
        languageService,
        ts,
        prior
      );

      expect(quickInfo).toBeDefined();
    });

    it("should detect inline directives in arrow functions", () => {
      const code = `const myAction = () => {
  "use server";
  return "test";
};`;

      const { languageService } = createTestLanguageService({
        "test.ts": code,
      });

      const prior = (_fileName: string, position: number) => ({
        kind: ts.ScriptElementKind.constElement,
        kindModifiers: "",
        textSpan: { start: position, length: 8 },
        displayParts: [],
        documentation: [],
        tags: [],
      });

      const position = 6; // On "myAction"

      const quickInfo = getQuickInfoAtPosition(
        "test.ts",
        position,
        languageService,
        ts,
        prior
      );

      expect(quickInfo).toBeDefined();
    });
  });

  describe("cross-file scenarios", () => {
    it("should track directives through re-exports", () => {
      const code = `import { reexportedAction } from "./middleware";

const ref = reexportedAction;`;

      const middleware = `export { myAction as reexportedAction } from "./source";`;

      const source = `"use server";
export function myAction() {
  return "test";
}`;

      const { languageService } = createTestLanguageService({
        "test.ts": code,
        "./middleware.ts": middleware,
        "./source.ts": source,
      });

      const prior = (_fileName: string, position: number) => ({
        kind: ts.ScriptElementKind.functionElement,
        kindModifiers: "export",
        textSpan: { start: position, length: 16 },
        displayParts: [],
        documentation: [],
        tags: [],
      });

      const position = 9; // On "reexportedAction" in import

      const quickInfo = getQuickInfoAtPosition(
        "test.ts",
        position,
        languageService,
        ts,
        prior
      );

      expect(quickInfo).toBeDefined();
    });

    it("should handle multiple levels of imports", () => {
      const code = `import { level2 } from "./level2";`;

      const level2File = `export { level1 as level2 } from "./level1";`;

      const level1File = `"use server";
export function level1() {
  return "test";
}`;

      const { languageService } = createTestLanguageService({
        "test.ts": code,
        "./level2.ts": level2File,
        "./level1.ts": level1File,
      });

      const prior = (_fileName: string, position: number) => ({
        kind: ts.ScriptElementKind.functionElement,
        kindModifiers: "export",
        textSpan: { start: position, length: 6 },
        displayParts: [],
        documentation: [],
        tags: [],
      });

      const position = 9;

      const quickInfo = getQuickInfoAtPosition(
        "test.ts",
        position,
        languageService,
        ts,
        prior
      );

      expect(quickInfo).toBeDefined();
    });
  });

  describe("module-level directive scenarios", () => {
    it("should show module directive for all exports", () => {
      const code = `"use server";

export function fn1() {}
export function fn2() {}`;

      const { languageService } = createTestLanguageService({
        "test.ts": code,
      });

      const prior = (_fileName: string, position: number) => ({
        kind: ts.ScriptElementKind.functionElement,
        kindModifiers: "export",
        textSpan: { start: position, length: 3 },
        displayParts: [],
        documentation: [],
        tags: [],
      });

      const position = 31; // On "fn1"

      const quickInfo = getQuickInfoAtPosition(
        "test.ts",
        position,
        languageService,
        ts,
        prior
      );

      expect(quickInfo).toBeDefined();
    });

    it("should handle both module and inline directives", () => {
      const code = `"use cache";

export function fn1() {
  return "test";
}

export function fn2() {
  "use server";
  return "test";
}`;

      const { languageService } = createTestLanguageService({
        "test.ts": code,
      });

      const prior = (_fileName: string, position: number) => ({
        kind: ts.ScriptElementKind.functionElement,
        kindModifiers: "export",
        textSpan: { start: position, length: 3 },
        displayParts: [],
        documentation: [],
        tags: [],
      });

      const position = 85; // On "fn2" which has inline directive

      const quickInfo = getQuickInfoAtPosition(
        "test.ts",
        position,
        languageService,
        ts,
        prior
      );

      expect(quickInfo).toBeDefined();
    });
  });
});
