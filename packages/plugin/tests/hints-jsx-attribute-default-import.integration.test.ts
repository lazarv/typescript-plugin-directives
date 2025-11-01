/**
 * Integration tests for inlay hints on JSX attributes with default imports
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { scanFileDirectives } from "../src/ast.js";
import { setCachedDirectives, setExportDirective } from "../src/cache.js";
import { provideInlayHints } from "../src/hints.js";

describe("hints - JSX attributes with default imports (integration)", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "ts-plugin-jsx-attr-test-")
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
      path.dirname(new URL(import.meta.url).pathname),
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

  it("should show hints for default imported server action in JSX attribute", () => {
    createFile(
      "action.ts",
      `export default async function submitForm(formData: FormData) {
  "use server";
  console.log("Form submitted");
  return { success: true };
}`
    );

    createFile(
      "test.tsx",
      `import submitForm from "./action";

export function MyForm() {
  return <form action={submitForm}>
    <button type="submit">Submit</button>
  </form>;
}`
    );

    const hints = getHints("test.tsx");

    const actionHints = hints.filter((h) => h.text === "<use server>");
    expect(actionHints.length).toBeGreaterThanOrEqual(1);
  });

  it("should show hints for export { X as default } in JSX attribute", () => {
    createFile(
      "action.ts",
      `"use server";

async function handleSubmit(formData: FormData) {
  return { ok: true };
}

export { handleSubmit as default };`
    );

    createFile(
      "test.tsx",
      `import handleSubmit from "./action";

export function Form() {
  return <form action={handleSubmit} />;
}`
    );

    const hints = getHints("test.tsx");

    const actionHints = hints.filter((h) => h.text === "<use server>");
    expect(actionHints.length).toBeGreaterThanOrEqual(1);
  });

  it("should show hints for named imports in JSX attributes (existing functionality)", () => {
    createFile(
      "actions.ts",
      `export async function saveData(formData: FormData) {
  "use server";
  return { saved: true };
}`
    );

    createFile(
      "test.tsx",
      `import { saveData } from "./actions";

export function DataForm() {
  return <form action={saveData}>
    <input name="data" />
  </form>;
}`
    );

    const hints = getHints("test.tsx");

    const actionHints = hints.filter((h) => h.text === "<use server>");
    expect(actionHints.length).toBeGreaterThanOrEqual(1);
  });

  it("should show hints for multiple JSX attributes with default imports", () => {
    createFile(
      "create.ts",
      `export default async function createItem(formData: FormData) {
  "use server";
  return { created: true };
}`
    );

    createFile(
      "update.ts",
      `export default async function updateItem(formData: FormData) {
  "use server";
  return { updated: true };
}`
    );

    createFile(
      "test.tsx",
      `import createItem from "./create";
import updateItem from "./update";

export function Forms() {
  return (
    <>
      <form action={createItem}>
        <button>Create</button>
      </form>
      <form action={updateItem}>
        <button>Update</button>
      </form>
    </>
  );
}`
    );

    const hints = getHints("test.tsx");

    const actionHints = hints.filter((h) => h.text === "<use server>");
    // Should have at least 2 hints for the two action attributes (plus possibly import hints)
    expect(actionHints.length).toBeGreaterThanOrEqual(2);
  });

  it("should not show hints for local functions without directives in JSX attributes", () => {
    createFile(
      "test.tsx",
      `function localHandler(formData: FormData) {
  console.log("Local handler");
}

export function Form() {
  return <form action={localHandler} />;
}`
    );

    const hints = getHints("test.tsx");

    expect(hints).toHaveLength(0);
  });
});
