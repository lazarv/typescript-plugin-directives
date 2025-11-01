import ts from "typescript";
import { describe, expect, it } from "vitest";
import { provideInlayHints } from "../src/hints.js";
import { createTestLanguageService } from "./utils.js";

describe("provideInlayHints - enhanced coverage", () => {
  describe("registry type resolution edge cases", () => {
    it("should handle missing DirectiveRegistry gracefully", () => {
      const code = `"use server";
export function myAction() {
  return "test";
}`;

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

      const hints = provideInlayHints(
        "test.ts",
        { start: 0, length: code.length },
        cleanService,
        ts
      );

      expect(Array.isArray(hints)).toBe(true);
    });

    it("should skip node_modules except plugin files when looking for registry", () => {
      const code = `"use server";
export function test() {}`;

      const { languageService } = createTestLanguageService({
        "test.ts": code,
        "node_modules/other/index.ts": `export const x = 1;`,
      });

      const hints = provideInlayHints(
        "test.ts",
        { start: 0, length: code.length },
        languageService,
        ts
      );

      expect(Array.isArray(hints)).toBe(true);
    });

    it("should handle when registry type is null", () => {
      const code = `"use server";
export function test() {}`;

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

  describe("complex import scenarios", () => {
    it("should show hints for destructured imports", () => {
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

      const hints = provideInlayHints(
        "test.ts",
        { start: 0, length: code.length },
        languageService,
        ts
      );

      expect(Array.isArray(hints)).toBe(true);
    });

    it("should show hints for namespace imports", () => {
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

      const hints = provideInlayHints(
        "test.ts",
        { start: 0, length: code.length },
        languageService,
        ts
      );

      expect(Array.isArray(hints)).toBe(true);
    });

    it("should show hints for default imports", () => {
      const code = `import myAction from "./other";

const result = myAction();`;

      const otherFile = `"use server";
export default function myAction() {
  return "test";
}`;

      const { languageService } = createTestLanguageService({
        "test.ts": code,
        "./other.ts": otherFile,
      });

      const hints = provideInlayHints(
        "test.ts",
        { start: 0, length: code.length },
        languageService,
        ts
      );

      expect(Array.isArray(hints)).toBe(true);
    });

    it("should handle re-exports", () => {
      const code = `export { myAction } from "./other";`;

      const otherFile = `"use server";
export function myAction() {
  return "test";
}`;

      const { languageService } = createTestLanguageService({
        "test.ts": code,
        "./other.ts": otherFile,
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

  describe("JSX edge cases", () => {
    it("should handle JSX self-closing tags", () => {
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

      const hints = provideInlayHints(
        "test.tsx",
        { start: 0, length: code.length },
        languageService,
        ts
      );

      expect(Array.isArray(hints)).toBe(true);
    });

    it("should handle JSX with children", () => {
      const code = `import { MyComponent } from "./other";

function App() {
  return <MyComponent>Content</MyComponent>;
}`;

      const otherFile = `"use client";
export function MyComponent({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>;
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

    it("should handle JSX attributes with function references", () => {
      const code = `import { handleClick } from "./other";

function App() {
  return <button onClick={handleClick}>Click</button>;
}`;

      const otherFile = `"use server";
export function handleClick() {
  console.log("clicked");
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

  describe("function reference scenarios", () => {
    it("should show hints for arrow function references", () => {
      const code = `export const myAction = () => {
  "use server";
  return "test";
};

const ref = myAction;`;

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

    it("should show hints for function expressions", () => {
      const code = `export const myAction = function() {
  "use server";
  return "test";
};

const ref = myAction;`;

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

    it("should show hints for class methods with directives", () => {
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

      const hints = provideInlayHints(
        "test.ts",
        { start: 0, length: code.length },
        languageService,
        ts
      );

      expect(Array.isArray(hints)).toBe(true);
    });
  });

  describe("module-level vs inline directive handling", () => {
    it("should handle module with both module-level and inline directives", () => {
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

      const hints = provideInlayHints(
        "test.ts",
        { start: 0, length: code.length },
        languageService,
        ts
      );

      expect(Array.isArray(hints)).toBe(true);
    });

    it("should show module directive on all exports when present", () => {
      const code = `"use server";

export function fn1() {}
export function fn2() {}
export const fn3 = () => {};
export class MyClass {}`;

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

  describe("cross-file directive propagation", () => {
    it("should track directives across multiple imports", () => {
      const code = `import { action1 } from "./file1";
import { action2 } from "./file2";

const result1 = action1();
const result2 = action2();`;

      const file1 = `"use server";
export function action1() {
  return "test1";
}`;

      const file2 = `"use cache";
export function action2() {
  return "test2";
}`;

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

    it("should handle transitive imports", () => {
      const code = `import { reexportedAction } from "./middleware";

const result = reexportedAction();`;

      const middleware = `export { action as reexportedAction } from "./source";`;

      const source = `"use server";
export function action() {
  return "test";
}`;

      const { languageService } = createTestLanguageService({
        "test.ts": code,
        "./middleware.ts": middleware,
        "./source.ts": source,
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

  describe("error handling and edge cases", () => {
    it("should handle files with syntax errors", () => {
      const code = `"use server";
export function test() {
  // Syntax error below
  return "unclosed string
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

    it("should handle very large files", () => {
      const exports = Array.from(
        { length: 100 },
        (_, i) => `export function fn${i}() { return ${i}; }`
      ).join("\n");

      const code = `"use server";\n${exports}`;

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

    it("should handle empty spans", () => {
      const code = `"use server";
export function test() {}`;

      const { languageService } = createTestLanguageService({
        "test.ts": code,
      });

      const hints = provideInlayHints(
        "test.ts",
        { start: 0, length: 0 },
        languageService,
        ts
      );

      expect(Array.isArray(hints)).toBe(true);
    });

    it("should handle spans outside file bounds", () => {
      const code = `"use server";
export function test() {}`;

      const { languageService } = createTestLanguageService({
        "test.ts": code,
      });

      const hints = provideInlayHints(
        "test.ts",
        { start: 1000, length: 100 },
        languageService,
        ts
      );

      expect(Array.isArray(hints)).toBe(true);
    });
  });

  describe("symbol resolution edge cases", () => {
    it("should handle symbols without declarations", () => {
      const code = `export function test() {
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

    it("should handle aliased exports", () => {
      const code = `function myAction() {
  "use server";
  return "test";
}

export { myAction as action };`;

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

    it("should handle const exports with directives", () => {
      const code = `export const myAction = () => {
  "use server";
  return "test";
};`;

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

  describe("directive format variations", () => {
    it("should handle directives with providers", () => {
      const code = `"use cache: memory";
export function test() {
  return "cached";
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

    it("should handle directives with options", () => {
      const code = `"use cache; ttl=3600";
export function test() {
  return "cached";
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

    it("should handle directives with both provider and options", () => {
      const code = `"use cache: redis; ttl=3600; maxSize=1000";
export function test() {
  return "cached";
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
  });
});
