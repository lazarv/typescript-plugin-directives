/**
 * Integration tests for hover on imports (named and default)
 * These tests use real filesystem to ensure module resolution works correctly
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { scanFileDirectives } from "../src/ast.js";
import { setCachedDirectives, setExportDirective } from "../src/cache.js";
import { getQuickInfoAtPosition } from "../src/hover.js";

describe("hover on imports - integration", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ts-plugin-hover-test-"));
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

  function getQuickInfo(
    fileName: string,
    content: string,
    searchText: string,
    occurrence: number = 0
  ): ts.QuickInfo | undefined {
    const filePath = path.join(tempDir, fileName);

    // Include all TypeScript files in the temp directory
    const allFiles = fs
      .readdirSync(tempDir)
      .filter((f) => f.endsWith(".ts") || f.endsWith(".tsx"))
      .map((f) => path.join(tempDir, f));

    const service = createLanguageService(allFiles);

    // Scan all files first (mimics what the real plugin does)
    scanAllFilesInService(service);

    // Find the nth occurrence (default to first)
    let position = -1;
    let currentIndex = 0;
    for (let i = 0; i <= occurrence; i++) {
      position = content.indexOf(searchText, currentIndex);
      if (position === -1) {
        throw new Error(
          `Could not find occurrence ${i} of "${searchText}" in ${fileName}`
        );
      }
      currentIndex = position + 1;
    }

    const prior = (file: string, pos: number) =>
      service.getQuickInfoAtPosition(file, pos);

    return getQuickInfoAtPosition(filePath, position, service, ts, prior);
  }

  it("should show directive info for default imports", () => {
    createFile(
      "button.ts",
      `"use client";

export default function Button() {
  return "button";
}`
    );

    const testContent = `import Button from "./button";

const b = Button();`;

    const _testFile = createFile("test.ts", testContent);

    // Hover over Button in the usage (const b = Button()), not the import
    const quickInfo = getQuickInfo(
      "test.ts",
      testContent,
      "Button",
      1 // Second occurrence (first is import, second is usage)
    );

    expect(quickInfo).toBeDefined();
    expect(quickInfo?.displayParts).toBeDefined();

    const displayText = quickInfo?.displayParts?.map((p) => p.text).join("");
    expect(displayText).toContain('"use client"');

    const docText = quickInfo?.documentation?.map((p) => p.text).join("");
    expect(docText).toBeTruthy();
  });

  it("should show directive info for export { X as default } pattern", () => {
    createFile(
      "button.ts",
      `"use client";

function Button() {
  return "button";
}

export { Button as default };`
    );

    const testContent = `import Button from "./button";

const b = Button();`;

    const _testFile = createFile("test.ts", testContent);

    // Hover over Button in the usage
    const quickInfo = getQuickInfo("test.ts", testContent, "Button", 1);

    expect(quickInfo).toBeDefined();
    expect(quickInfo?.displayParts).toBeDefined();

    const displayText = quickInfo?.displayParts?.map((p) => p.text).join("");
    expect(displayText).toContain('"use client"');

    const docText = quickInfo?.documentation?.map((p) => p.text).join("");
    expect(docText).toBeTruthy();
  });

  it("should show directive info for named imports", () => {
    createFile(
      "utils.ts",
      `"use server";

export function saveData() {
  return "saved";
}`
    );

    const testContent = `import { saveData } from "./utils";

const result = saveData();`;

    const _testFile = createFile("test.ts", testContent);

    // Hover over saveData in the usage
    const quickInfo = getQuickInfo("test.ts", testContent, "saveData", 1);

    expect(quickInfo).toBeDefined();
    expect(quickInfo?.displayParts).toBeDefined();

    const displayText = quickInfo?.displayParts?.map((p) => p.text).join("");
    expect(displayText).toContain('"use server"');

    const docText = quickInfo?.documentation?.map((p) => p.text).join("");
    expect(docText).toBeTruthy();
  });

  it("should show directive info for inline directives on named exports", () => {
    createFile(
      "actions.ts",
      `export function deleteItem() {
  "use server";
  return "deleted";
}

export function updateItem() {
  "use server";
  return "updated";
}`
    );

    const testContent = `import { deleteItem } from "./actions";

const result = deleteItem();`;

    const _testFile = createFile("test.ts", testContent);

    // Hover over deleteItem in the usage
    const quickInfo = getQuickInfo("test.ts", testContent, "deleteItem", 1);

    expect(quickInfo).toBeDefined();
    expect(quickInfo?.displayParts).toBeDefined();

    const displayText = quickInfo?.displayParts?.map((p) => p.text).join("");
    expect(displayText).toContain('"use server"');
  });

  it("should show directive info for inline directive on default export", () => {
    createFile(
      "action.ts",
      `export default function submitForm() {
  "use server";
  return "submitted";
}`
    );

    const testContent = `import submitForm from "./action";

const result = submitForm();`;

    const _testFile = createFile("test.ts", testContent);

    // Hover over submitForm in the usage
    const quickInfo = getQuickInfo("test.ts", testContent, "submitForm", 1);

    expect(quickInfo).toBeDefined();
    expect(quickInfo?.displayParts).toBeDefined();

    const displayText = quickInfo?.displayParts?.map((p) => p.text).join("");
    expect(displayText).toContain('"use server"');
  });

  it("should show directive info for renamed imports", () => {
    createFile(
      "button.ts",
      `"use client";

export function Button() {
  return "button";
}`
    );

    const testContent = `import { Button as MyButton } from "./button";

const b = MyButton();`;

    const _testFile = createFile("test.ts", testContent);

    // Hover over MyButton in the usage
    const quickInfo = getQuickInfo("test.ts", testContent, "MyButton", 1);

    expect(quickInfo).toBeDefined();
    expect(quickInfo?.displayParts).toBeDefined();

    const displayText = quickInfo?.displayParts?.map((p) => p.text).join("");
    expect(displayText).toContain('"use client"');
  });

  it("should not show directive info for imports without directives", () => {
    createFile(
      "utils.ts",
      `export function helper() {
  return "help";
}`
    );

    const testContent = `import { helper } from "./utils";

const result = helper();`;

    const _testFile = createFile("test.ts", testContent);

    // Hover over helper in the usage
    const quickInfo = getQuickInfo("test.ts", testContent, "helper", 1);

    // Should still have quickInfo from TypeScript, just no directive
    expect(quickInfo).toBeDefined();

    const displayText = quickInfo?.displayParts?.map((p) => p.text).join("");
    expect(displayText).not.toContain('"use server"');
    expect(displayText).not.toContain('"use client"');
  });

  it("should handle mixed exports with different directives", () => {
    createFile(
      "mixed.ts",
      `export function serverAction() {
  "use server";
  return "server";
}

export function clientComponent() {
  "use client";
  return "client";
}`
    );

    const testContent = `import { serverAction, clientComponent } from "./mixed";

const s = serverAction();
const c = clientComponent();`;

    const _testFile = createFile("test.ts", testContent);

    // Check serverAction in usage (second occurrence)
    const serverQuickInfo = getQuickInfo(
      "test.ts",
      testContent,
      "serverAction",
      1
    );
    expect(
      serverQuickInfo?.displayParts?.map((p) => p.text).join("")
    ).toContain('"use server"');

    // Check clientComponent in usage (second occurrence)
    const clientQuickInfo = getQuickInfo(
      "test.ts",
      testContent,
      "clientComponent",
      1
    );
    expect(
      clientQuickInfo?.displayParts?.map((p) => p.text).join("")
    ).toContain('"use client"');
  });

  it("should show directive info when hovering on default import statement", () => {
    createFile(
      "button.ts",
      `"use client";

export default function Button() {
  return "button";
}`
    );

    const testContent = `import Button from "./button";

const b = Button();`;

    const _testFile = createFile("test.ts", testContent);

    // Hover over Button in the IMPORT STATEMENT (first occurrence)
    const quickInfo = getQuickInfo(
      "test.ts",
      testContent,
      "Button",
      0 // First occurrence (the import statement itself)
    );

    expect(quickInfo).toBeDefined();
    expect(quickInfo?.displayParts).toBeDefined();

    const displayText = quickInfo?.displayParts?.map((p) => p.text).join("");
    expect(displayText).toContain('"use client"');

    const docText = quickInfo?.documentation?.map((p) => p.text).join("");
    expect(docText).toBeTruthy();
  });

  it("should show directive info when hovering on named import statement", () => {
    createFile(
      "utils.ts",
      `"use server";

export function saveData() {
  return "saved";
}`
    );

    const testContent = `import { saveData } from "./utils";

const result = saveData();`;

    const _testFile = createFile("test.ts", testContent);

    // Hover over saveData in the IMPORT STATEMENT (first occurrence)
    const quickInfo = getQuickInfo(
      "test.ts",
      testContent,
      "saveData",
      0 // First occurrence (the import statement itself)
    );

    expect(quickInfo).toBeDefined();
    expect(quickInfo?.displayParts).toBeDefined();

    const displayText = quickInfo?.displayParts?.map((p) => p.text).join("");
    expect(displayText).toContain('"use server"');

    const docText = quickInfo?.documentation?.map((p) => p.text).join("");
    expect(docText).toBeTruthy();
  });
});
