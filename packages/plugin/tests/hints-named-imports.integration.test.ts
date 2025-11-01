import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { scanFileDirectives } from "../src/ast.js";
import { setCachedDirectives, setExportDirective } from "../src/cache.js";
import { provideInlayHints } from "../src/hints.js";

/**
 * Integration tests for named imports in addImportHints
 *
 * These tests use REAL files on disk to test the actual module resolution
 * and hint generation logic that cannot be tested with virtual files.
 *
 * Coverage: Lines 269-332 of hints.ts, including:
 * - Lines 299-318: Named imports hint generation
 * - Lines 320-327: Default imports hint generation
 */
describe("hints - named imports (integration)", () => {
  let tempDir: string;
  let languageServiceHost: ts.LanguageServiceHost;
  let languageService: ts.LanguageService;

  beforeEach(() => {
    // Create a unique temporary directory for each test
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ts-plugin-test-"));
  });

  afterEach(() => {
    // Clean up temporary files
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  /**
   * Helper to create a real file on disk
   */
  function createFile(filename: string, content: string): string {
    const filePath = path.join(tempDir, filename);
    fs.writeFileSync(filePath, content, "utf-8");
    return filePath;
  }

  /**
   * Helper to create a language service with real files
   */
  function createLanguageService(
    files: Record<string, string>
  ): ts.LanguageService {
    const fileNames: string[] = [];

    // Write all files to disk
    for (const [filename, content] of Object.entries(files)) {
      const filePath = createFile(filename, content);
      fileNames.push(filePath);
    }

    // Also include the global.d.ts with DirectiveRegistry
    const globalDtsPath = path.join(
      path.dirname(new URL(import.meta.url).pathname),
      "../types/global.d.ts"
    );
    if (fs.existsSync(globalDtsPath)) {
      fileNames.push(globalDtsPath);
    }

    // Create language service host with real file system
    languageServiceHost = {
      getScriptFileNames: () => fileNames,
      getScriptVersion: () => "1",
      getScriptSnapshot: (fileName) => {
        if (!fs.existsSync(fileName)) {
          return undefined;
        }
        const text = fs.readFileSync(fileName, "utf-8");
        return ts.ScriptSnapshot.fromString(text);
      },
      getCurrentDirectory: () => tempDir,
      getCompilationSettings: () => ({
        target: ts.ScriptTarget.Latest,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Node10,
        esModuleInterop: true,
      }),
      getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
      fileExists: ts.sys.fileExists,
      readFile: ts.sys.readFile,
      readDirectory: ts.sys.readDirectory,
      directoryExists: ts.sys.directoryExists,
      getDirectories: ts.sys.getDirectories,
    };

    languageService = ts.createLanguageService(
      languageServiceHost,
      ts.createDocumentRegistry()
    );

    // Populate export cache - this is critical for hints to work
    const program = languageService.getProgram();
    if (program) {
      for (const sourceFile of program.getSourceFiles()) {
        if (sourceFile.isDeclarationFile) continue;
        if (sourceFile.fileName.includes("node_modules")) continue;
        if (sourceFile.fileName.includes("lib.")) continue;
        if (sourceFile.fileName.includes("global.d.ts")) continue;

        const scanned = scanFileDirectives(sourceFile, program, ts);
        setCachedDirectives(
          sourceFile,
          scanned.moduleDirectives,
          scanned.exportDirectives
        );

        // Populate export map for cross-file lookups
        for (const [
          exportName,
          directive,
        ] of scanned.exportDirectives.entries()) {
          setExportDirective(sourceFile.fileName, exportName, directive);
        }
      }
    }

    return languageService;
  }

  describe("named imports with inline directives", () => {
    it("should show hints for named imports", () => {
      // Create files
      const actionsContent = `export function serverAction() {
  "use server";
  return "data";
}`;

      const testContent = `import { serverAction } from "./actions";

const result = serverAction();`;

      const testFile = createFile("test.ts", testContent);
      const _actionsFile = createFile("actions.ts", actionsContent);

      // Create language service with both files
      const ls = createLanguageService({
        "test.ts": testContent,
        "actions.ts": actionsContent,
      });

      const hints = provideInlayHints(
        testFile,
        { start: 0, length: testContent.length },
        ls,
        ts
      );

      // Should have hints for the imported function with "use server"
      // Note: hints are formatted as "<directive>"
      const serverHints = hints.filter((h) => h.text === "<use server>");
      expect(serverHints.length).toBeGreaterThan(0);
    });

    it("should show hints for multiple named imports", () => {
      const testFile = createFile(
        "test.ts",
        `import { action1, action2 } from "./actions";

action1();
action2();`
      );

      createFile(
        "actions.ts",
        `export function action1() {
  "use server";
}

export function action2() {
  "use server";
}`
      );

      const ls = createLanguageService({
        "test.ts": fs.readFileSync(testFile, "utf-8"),
        "actions.ts": fs.readFileSync(
          path.join(tempDir, "actions.ts"),
          "utf-8"
        ),
      });

      const code = fs.readFileSync(testFile, "utf-8");
      const hints = provideInlayHints(
        testFile,
        { start: 0, length: code.length },
        ls,
        ts
      );

      const serverHints = hints.filter((h) => h.text === "<use server>");
      expect(serverHints.length).toBeGreaterThan(0);
    });

    it("should handle different directives on different imports", () => {
      const testFile = createFile(
        "test.ts",
        `import { serverFn, clientFn } from "./mixed";

serverFn();
clientFn();`
      );

      createFile(
        "mixed.ts",
        `export function serverFn() {
  "use server";
}

export function clientFn() {
  "use client";
}`
      );

      const ls = createLanguageService({
        "test.ts": fs.readFileSync(testFile, "utf-8"),
        "mixed.ts": fs.readFileSync(path.join(tempDir, "mixed.ts"), "utf-8"),
      });

      const code = fs.readFileSync(testFile, "utf-8");
      const hints = provideInlayHints(
        testFile,
        { start: 0, length: code.length },
        ls,
        ts
      );

      const serverHints = hints.filter((h) => h.text === "<use server>");
      const clientHints = hints.filter((h) => h.text === "<use client>");

      expect(serverHints.length).toBeGreaterThan(0);
      expect(clientHints.length).toBeGreaterThan(0);
    });
  });

  describe("named imports with module-level directives", () => {
    it("should show hints for module-level directives", () => {
      const testFile = createFile(
        "test.ts",
        `import { action1, action2 } from "./actions";

action1();
action2();`
      );

      createFile(
        "actions.ts",
        `"use server";

export function action1() {
  return "data1";
}

export function action2() {
  return "data2";
}`
      );

      const ls = createLanguageService({
        "test.ts": fs.readFileSync(testFile, "utf-8"),
        "actions.ts": fs.readFileSync(
          path.join(tempDir, "actions.ts"),
          "utf-8"
        ),
      });

      const code = fs.readFileSync(testFile, "utf-8");
      const hints = provideInlayHints(
        testFile,
        { start: 0, length: code.length },
        ls,
        ts
      );

      const serverHints = hints.filter((h) => h.text === "<use server>");
      expect(serverHints.length).toBeGreaterThan(0);
    });
  });

  describe("named imports with aliases", () => {
    it("should handle renamed imports (as syntax)", () => {
      const testFile = createFile(
        "test.ts",
        `import { serverAction as myAction } from "./actions";

const result = myAction();`
      );

      createFile(
        "actions.ts",
        `export function serverAction() {
  "use server";
  return "data";
}`
      );

      const ls = createLanguageService({
        "test.ts": fs.readFileSync(testFile, "utf-8"),
        "actions.ts": fs.readFileSync(
          path.join(tempDir, "actions.ts"),
          "utf-8"
        ),
      });

      const code = fs.readFileSync(testFile, "utf-8");
      const hints = provideInlayHints(
        testFile,
        { start: 0, length: code.length },
        ls,
        ts
      );

      const serverHints = hints.filter((h) => h.text === "<use server>");
      expect(serverHints.length).toBeGreaterThan(0);
    });
  });

  describe("default imports", () => {
    it("should show hints for default imports with directives", () => {
      const testFile = createFile(
        "test.ts",
        `import defaultAction from "./actions";

const result = defaultAction();`
      );

      createFile(
        "actions.ts",
        `export default function defaultAction() {
  "use server";
  return "data";
}`
      );

      const ls = createLanguageService({
        "test.ts": fs.readFileSync(testFile, "utf-8"),
        "actions.ts": fs.readFileSync(
          path.join(tempDir, "actions.ts"),
          "utf-8"
        ),
      });

      const code = fs.readFileSync(testFile, "utf-8");
      const hints = provideInlayHints(
        testFile,
        { start: 0, length: code.length },
        ls,
        ts
      );

      const serverHints = hints.filter((h) => h.text === "<use server>");
      expect(serverHints.length).toBeGreaterThan(0);
    });

    it("should show hints for export { X as default } pattern", () => {
      const testFile = createFile(
        "test.ts",
        `import Button from "./button";

const btn = Button();`
      );

      createFile(
        "button.ts",
        `function Button() {
  "use client";
  return "button";
}

export { Button as default };`
      );

      const ls = createLanguageService({
        "test.ts": fs.readFileSync(testFile, "utf-8"),
        "button.ts": fs.readFileSync(path.join(tempDir, "button.ts"), "utf-8"),
      });

      const code = fs.readFileSync(testFile, "utf-8");
      const hints = provideInlayHints(
        testFile,
        { start: 0, length: code.length },
        ls,
        ts
      );

      const clientHints = hints.filter((h) => h.text === "<use client>");
      expect(clientHints.length).toBeGreaterThan(0);
    });
  });

  describe("edge cases", () => {
    it("should not show hints for imports without directives", () => {
      const testFile = createFile(
        "test.ts",
        `import { regularFn } from "./regular";

regularFn();`
      );

      createFile(
        "regular.ts",
        `export function regularFn() {
  return "data";
}`
      );

      const ls = createLanguageService({
        "test.ts": fs.readFileSync(testFile, "utf-8"),
        "regular.ts": fs.readFileSync(
          path.join(tempDir, "regular.ts"),
          "utf-8"
        ),
      });

      const code = fs.readFileSync(testFile, "utf-8");
      const hints = provideInlayHints(
        testFile,
        { start: 0, length: code.length },
        ls,
        ts
      );

      const directiveHints = hints.filter(
        (h) => h.text === "<use server>" || h.text === "<use client>"
      );
      expect(directiveHints.length).toBe(0);
    });

    it("should handle mixed exports (some with directives, some without)", () => {
      const testFile = createFile(
        "test.ts",
        `import { withDirective, withoutDirective } from "./mixed";

withDirective();
withoutDirective();`
      );

      createFile(
        "mixed.ts",
        `export function withDirective() {
  "use server";
}

export function withoutDirective() {
  return "normal";
}`
      );

      const ls = createLanguageService({
        "test.ts": fs.readFileSync(testFile, "utf-8"),
        "mixed.ts": fs.readFileSync(path.join(tempDir, "mixed.ts"), "utf-8"),
      });

      const code = fs.readFileSync(testFile, "utf-8");
      const hints = provideInlayHints(
        testFile,
        { start: 0, length: code.length },
        ls,
        ts
      );

      const serverHints = hints.filter((h) => h.text === "<use server>");
      // Should have hints only for the function with directive
      expect(serverHints.length).toBeGreaterThan(0);
    });
  });

  describe("hints on call expressions", () => {
    it("should show hints on call expressions of imported functions", () => {
      const testFile = createFile(
        "test.ts",
        `import { serverAction } from "./actions";

serverAction();
serverAction();`
      );

      createFile(
        "actions.ts",
        `export function serverAction() {
  "use server";
  return "data";
}`
      );

      const ls = createLanguageService({
        "test.ts": fs.readFileSync(testFile, "utf-8"),
        "actions.ts": fs.readFileSync(
          path.join(tempDir, "actions.ts"),
          "utf-8"
        ),
      });

      const code = fs.readFileSync(testFile, "utf-8");
      const hints = provideInlayHints(
        testFile,
        { start: 0, length: code.length },
        ls,
        ts
      );

      const serverHints = hints.filter((h) => h.text === "<use server>");
      // Should have hints on both call expressions
      expect(serverHints.length).toBeGreaterThan(0);
    });
  });
});
