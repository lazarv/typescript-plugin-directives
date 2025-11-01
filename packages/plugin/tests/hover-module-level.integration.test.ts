/**
 * Integration tests for hover on module-level directives
 * Tests scenarios where module-level directives apply to exported functions
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { scanFileDirectives } from "../src/ast.js";
import { setCachedDirectives, setExportDirective } from "../src/cache.js";
import { getQuickInfoAtPosition } from "../src/hover.js";

describe("hover on module-level directives - integration", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "ts-plugin-hover-module-test-")
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
      if (
        sourceFile.isDeclarationFile ||
        sourceFile.fileName.includes("node_modules")
      ) {
        continue;
      }

      const { moduleDirectives, exportDirectives } = scanFileDirectives(
        sourceFile,
        program,
        ts
      );

      setCachedDirectives(sourceFile, moduleDirectives, exportDirectives);

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

    const allFiles = fs
      .readdirSync(tempDir)
      .filter((f) => f.endsWith(".ts") || f.endsWith(".tsx"))
      .map((f) => path.join(tempDir, f));

    const service = createLanguageService(allFiles);
    scanAllFilesInService(service);

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

  function getQuickInfoWithoutScan(
    fileName: string,
    content: string,
    searchText: string,
    occurrence: number = 0
  ): ts.QuickInfo | undefined {
    const filePath = path.join(tempDir, fileName);

    const allFiles = fs
      .readdirSync(tempDir)
      .filter((f) => f.endsWith(".ts") || f.endsWith(".tsx"))
      .map((f) => path.join(tempDir, f));

    const service = createLanguageService(allFiles);
    // DO NOT scan - let the hover function scan on demand

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

  it("should show module-level directive for exported function in same file", () => {
    const testContent = `"use server";

export function saveData() {
  return "saved";
}

const x = saveData();`;

    createFile("test.ts", testContent);

    // Hover over saveData in the local call expression
    const quickInfo = getQuickInfo("test.ts", testContent, "saveData", 1);

    expect(quickInfo).toBeDefined();
    expect(quickInfo?.displayParts).toBeDefined();

    const displayText = quickInfo?.displayParts?.map((p) => p.text).join("");
    expect(displayText).toContain('"use server"');

    const docText = quickInfo?.documentation?.map((p) => p.text).join("");
    expect(docText).toBeTruthy();
  });

  it("should show module-level directive for exported variable in same file", () => {
    const testContent = `"use client";

export const MyComponent = () => {
  return "component";
};

const c = MyComponent();`;

    createFile("test.ts", testContent);

    // Hover over MyComponent in the local call expression
    const quickInfo = getQuickInfo("test.ts", testContent, "MyComponent", 1);

    expect(quickInfo).toBeDefined();
    expect(quickInfo?.displayParts).toBeDefined();

    const displayText = quickInfo?.displayParts?.map((p) => p.text).join("");
    expect(displayText).toContain('"use client"');
  });

  it("should show module-level directive for exported class in same file", () => {
    const testContent = `"use client";

export class Button {
  render() {
    return "button";
  }
}

const b = new Button();`;

    createFile("test.ts", testContent);

    // Hover over Button in the constructor call
    const quickInfo = getQuickInfo("test.ts", testContent, "Button", 1);

    expect(quickInfo).toBeDefined();
    expect(quickInfo?.displayParts).toBeDefined();

    const displayText = quickInfo?.displayParts?.map((p) => p.text).join("");
    expect(displayText).toContain('"use client"');
  });

  it("should not show module-level directive for non-exported function", () => {
    const testContent = `"use server";

function helperFunction() {
  return "helper";
}

export function publicFunction() {
  return helperFunction();
}

const h = helperFunction();`;

    createFile("test.ts", testContent);

    // Hover over helperFunction in the local call (last occurrence)
    const quickInfo = getQuickInfo("test.ts", testContent, "helperFunction", 2);

    expect(quickInfo).toBeDefined();

    const displayText = quickInfo?.displayParts?.map((p) => p.text).join("");
    // helperFunction is NOT exported, so it should NOT have the module-level directive
    // Only the exported publicFunction should have it
    expect(displayText).not.toContain('"use server"');
  });

  it("should prioritize inline directive over module-level directive", () => {
    const testContent = `"use server";

export function serverAction() {
  "use client";
  return "client action";
}

const result = serverAction();`;

    createFile("test.ts", testContent);

    // Hover over serverAction in the call expression
    const quickInfo = getQuickInfo("test.ts", testContent, "serverAction", 1);

    expect(quickInfo).toBeDefined();
    expect(quickInfo?.displayParts).toBeDefined();

    const displayText = quickInfo?.displayParts?.map((p) => p.text).join("");
    // Should show inline "use client" not module-level "use server"
    expect(displayText).toContain('"use client"');
    expect(displayText).not.toContain('"use server"');
  });

  it("should handle module-level directive with multiple exports", () => {
    const testContent = `"use client";

export function ComponentA() {
  return "A";
}

export function ComponentB() {
  return "B";
}

const a = ComponentA();
const b = ComponentB();`;

    createFile("test.ts", testContent);

    // Hover over ComponentA
    const quickInfoA = getQuickInfo("test.ts", testContent, "ComponentA", 1);
    expect(quickInfoA?.displayParts?.map((p) => p.text).join("")).toContain(
      '"use client"'
    );

    // Hover over ComponentB
    const quickInfoB = getQuickInfo("test.ts", testContent, "ComponentB", 1);
    expect(quickInfoB?.displayParts?.map((p) => p.text).join("")).toContain(
      '"use client"'
    );
  });

  it("should show directive for local function reference with inline directive", () => {
    const testContent = `function localAction() {
  "use server";
  return "action";
}

const result = localAction();`;

    createFile("test.ts", testContent);

    // Hover over localAction in the call expression (second occurrence)
    const quickInfo = getQuickInfo("test.ts", testContent, "localAction", 1);

    expect(quickInfo).toBeDefined();
    expect(quickInfo?.displayParts).toBeDefined();

    const displayText = quickInfo?.displayParts?.map((p) => p.text).join("");
    expect(displayText).toContain('"use server"');

    const docText = quickInfo?.documentation?.map((p) => p.text).join("");
    expect(docText).toBeTruthy();
    expect(docText).toContain("function");
  });

  it("should show directive for local arrow function with inline directive", () => {
    const testContent = `const serverAction = () => {
  "use server";
  return "saved";
};

const result = serverAction();`;

    createFile("test.ts", testContent);

    // Hover over serverAction in the call expression
    const quickInfo = getQuickInfo("test.ts", testContent, "serverAction", 1);

    expect(quickInfo).toBeDefined();
    expect(quickInfo?.displayParts).toBeDefined();

    const displayText = quickInfo?.displayParts?.map((p) => p.text).join("");
    expect(displayText).toContain('"use server"');
  });

  it("should show directive for local const function with inline directive", () => {
    const testContent = `const clientComponent = function() {
  "use client";
  return "component";
};

const c = clientComponent();`;

    createFile("test.ts", testContent);

    // Hover over clientComponent in the call expression
    const quickInfo = getQuickInfo(
      "test.ts",
      testContent,
      "clientComponent",
      1
    );

    expect(quickInfo).toBeDefined();
    expect(quickInfo?.displayParts).toBeDefined();

    const displayText = quickInfo?.displayParts?.map((p) => p.text).join("");
    expect(displayText).toContain('"use client"');
  });

  it("should scan and cache file when hovering on reference from another file", () => {
    // Create a file with module-level directive (not yet scanned)
    createFile(
      "actions.ts",
      `"use server";

export function saveData() {
  return "saved";
}

export function deleteData() {
  return "deleted";
}`
    );

    // Create test file that imports and uses the function
    const testContent = `import { saveData } from "./actions";

const result = saveData();`;

    createFile("test.ts", testContent);

    // Hover over saveData in the call expression
    const quickInfo = getQuickInfo("test.ts", testContent, "saveData", 1);

    expect(quickInfo).toBeDefined();
    expect(quickInfo?.displayParts).toBeDefined();

    const displayText = quickInfo?.displayParts?.map((p) => p.text).join("");
    expect(displayText).toContain('"use server"');
  });

  it("should handle exported function without inline directive using cache", () => {
    const testContent = `"use client";

export function ComponentA() {
  // No inline directive - should use module-level
  return "A";
}

export function ComponentB() {
  "use server";
  // Has inline directive - should use this instead
  return "B";
}

// Reference them locally
const a = ComponentA();
const b = ComponentB();`;

    createFile("test.ts", testContent);

    // Hover over ComponentA - should get module-level directive from cache
    const quickInfoA = getQuickInfo("test.ts", testContent, "ComponentA", 1);
    expect(quickInfoA?.displayParts?.map((p) => p.text).join("")).toContain(
      '"use client"'
    );

    // Hover over ComponentB - should get inline directive
    const quickInfoB = getQuickInfo("test.ts", testContent, "ComponentB", 1);
    const displayB = quickInfoB?.displayParts?.map((p) => p.text).join("");
    expect(displayB).toContain('"use server"');
    expect(displayB).not.toContain('"use client"');
  });

  it("should trigger cache scanning when file not yet scanned", () => {
    const testContent = `"use server";

export function serverAction() {
  // No inline directive - will use module-level from cache
  return "action";
}

const result = serverAction();`;

    createFile("test.ts", testContent);

    // Use getQuickInfoWithoutScan to ensure cache is empty initially
    const quickInfo = getQuickInfoWithoutScan(
      "test.ts",
      testContent,
      "serverAction",
      1
    );

    expect(quickInfo).toBeDefined();
    expect(quickInfo?.displayParts).toBeDefined();

    const displayText = quickInfo?.displayParts?.map((p) => p.text).join("");
    expect(displayText).toContain('"use server"');
  });

  it("should handle function with inline directive when cache not populated", () => {
    const testContent = `export function actionWithInline() {
  "use server";
  return "inline";
}

export function actionModuleLevel() {
  return "module-level";
}

const a = actionWithInline();
const b = actionModuleLevel();`;

    createFile("test.ts", testContent);

    // Test function WITH inline directive (hits exportDirectives path - line 756)
    const quickInfoInline = getQuickInfoWithoutScan(
      "test.ts",
      testContent,
      "actionWithInline",
      1
    );
    expect(
      quickInfoInline?.displayParts?.map((p) => p.text).join("")
    ).toContain('"use server"');

    // Test function WITHOUT inline directive (doesn't have directive at all)
    const quickInfoModule = getQuickInfoWithoutScan(
      "test.ts",
      testContent,
      "actionModuleLevel",
      1
    );
    const displayModule = quickInfoModule?.displayParts
      ?.map((p) => p.text)
      .join("");
    expect(displayModule).not.toContain('"use server"');
  });
});
