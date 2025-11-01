/**
 * Integration tests for inlay hints on call expressions with default imports
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { scanFileDirectives } from "../src/ast.js";
import { setCachedDirectives, setExportDirective } from "../src/cache.js";
import { provideInlayHints } from "../src/hints.js";

describe("hints - call expressions with default imports (integration)", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "ts-plugin-call-hints-test-")
    );
  });

  afterEach(() => {
    if (tempDir) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  function createFile(fileName: string, content: string): string {
    const filePath = path.join(tempDir, fileName);
    fs.writeFileSync(filePath, content, "utf-8");
    return filePath;
  }

  function createLanguageService(files: string[]) {
    // Include the global.d.ts file for DirectiveRegistry
    const globalDtsPath = path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      "../types/global.d.ts"
    );

    const allFiles = [...files];
    if (fs.existsSync(globalDtsPath)) {
      allFiles.push(globalDtsPath);
    }

    const servicesHost: ts.LanguageServiceHost = {
      getScriptFileNames: () => allFiles,
      getScriptVersion: () => "1",
      getScriptSnapshot: (fileName) => {
        if (!fs.existsSync(fileName)) {
          return undefined;
        }
        return ts.ScriptSnapshot.fromString(fs.readFileSync(fileName, "utf-8"));
      },
      getCurrentDirectory: () => tempDir,
      getCompilationSettings: () => ({
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ESNext,
        moduleResolution: ts.ModuleResolutionKind.NodeNext,
        jsx: ts.JsxEmit.React,
        strict: true,
      }),
      getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
      fileExists: ts.sys.fileExists,
      readFile: ts.sys.readFile,
      readDirectory: ts.sys.readDirectory,
      directoryExists: ts.sys.directoryExists,
      getDirectories: ts.sys.getDirectories,
    };

    return ts.createLanguageService(servicesHost, ts.createDocumentRegistry());
  }

  function scanAllFilesInService(service: ts.LanguageService) {
    const program = service.getProgram();
    if (!program) return;

    const sourceFiles = program.getSourceFiles();
    for (const sourceFile of sourceFiles) {
      // Skip declaration files and node_modules
      if (
        sourceFile.isDeclarationFile ||
        sourceFile.fileName.includes("node_modules")
      ) {
        continue;
      }

      // Scan file for directives
      const { moduleDirectives, exportDirectives } = scanFileDirectives(
        sourceFile,
        program,
        ts
      );

      // Update cache
      setCachedDirectives(sourceFile, moduleDirectives, exportDirectives);

      // Update global export map
      for (const [exportName, directive] of exportDirectives.entries()) {
        setExportDirective(sourceFile.fileName, exportName, directive);
      }
    }
  }

  function getHints(fileName: string): ts.InlayHint[] {
    const filePath = path.join(tempDir, fileName);

    // Include all TypeScript files in the temp directory
    const allFiles = fs
      .readdirSync(tempDir)
      .filter((f) => f.endsWith(".ts") || f.endsWith(".tsx"))
      .map((f) => path.join(tempDir, f));

    const service = createLanguageService(allFiles);

    // Scan all files first (mimics what the real plugin does)
    scanAllFilesInService(service);

    const sourceFile = service.getProgram()?.getSourceFile(filePath);
    if (!sourceFile) {
      throw new Error(`Could not get source file for ${filePath}`);
    }

    const span: ts.TextSpan = {
      start: 0,
      length: sourceFile.getFullText().length,
    };

    return provideInlayHints(filePath, span, service, ts);
  }

  it("should show hints for default imported function in call expression", () => {
    createFile(
      "button.tsx",
      `"use client";

export default function Button(props: any) {
  return <button>{props.children}</button>;
}`
    );

    createFile(
      "test.tsx",
      `import Button from "./button";

const a = Button({
  onClick: () => console.log("Clicked"),
  children: "Click me",
});`
    );

    const hints = getHints("test.tsx");

    // Should have hints for both the import and the call expression
    expect(hints.length).toBeGreaterThanOrEqual(1);
    expect(hints.every((h) => h.text === "<use client>")).toBe(true);
    expect(hints.some((h) => h.kind === ts.InlayHintKind.Type)).toBe(true);
  });

  it("should show hints for export { X as default } in call expression", () => {
    createFile(
      "button.tsx",
      `"use client";

function Button(props: any) {
  return <button>{props.children}</button>;
}

export { Button as default };`
    );

    createFile(
      "test.tsx",
      `import Button from "./button";

const result = Button({ children: "Test" });`
    );

    const hints = getHints("test.tsx");

    // Should have hints for both the import and the call expression
    expect(hints.length).toBeGreaterThanOrEqual(1);
    expect(hints.every((h) => h.text === "<use client>")).toBe(true);
  });

  it("should show hints for inline directive on default export in call expression", () => {
    createFile(
      "action.ts",
      `export default function submitForm(data: any) {
  "use server";
  console.log("Submitting:", data);
  return { success: true };
}`
    );

    createFile(
      "test.ts",
      `import submitForm from "./action";

const result = submitForm({ name: "John" });`
    );

    const hints = getHints("test.ts");

    // Should have hints for both the import and the call expression
    expect(hints.length).toBeGreaterThanOrEqual(1);
    expect(hints.every((h) => h.text === "<use server>")).toBe(true);
  });

  it("should show hints for named imports in call expressions (existing functionality)", () => {
    createFile(
      "actions.ts",
      `export function saveData(data: any) {
  "use server";
  return { saved: true };
}`
    );

    createFile(
      "test.ts",
      `import { saveData } from "./actions";

const result = saveData({ value: 42 });`
    );

    const hints = getHints("test.ts");

    // Should have hints for both the import and the call expression
    expect(hints.length).toBeGreaterThanOrEqual(1);
    expect(hints.every((h) => h.text === "<use server>")).toBe(true);
  });

  it("should not show hints for local functions without directives", () => {
    createFile(
      "test.ts",
      `function helper(x: number) {
  return x * 2;
}

const result = helper(5);`
    );

    const hints = getHints("test.ts");

    expect(hints).toHaveLength(0);
  });

  it("should show hints for multiple call expressions", () => {
    createFile(
      "client.tsx",
      `"use client";

export default function Component(props: any) {
  return <div>{props.text}</div>;
}`
    );

    createFile(
      "test.tsx",
      `import Component from "./client";

const a = Component({ text: "First" });
const b = Component({ text: "Second" });
const c = Component({ text: "Third" });`
    );

    const hints = getHints("test.tsx");

    // Should have at least 3 hints for the call expressions (plus 1 for import)
    expect(hints.length).toBeGreaterThanOrEqual(3);
    expect(hints.every((h) => h.text === "<use client>")).toBe(true);
  });
});
