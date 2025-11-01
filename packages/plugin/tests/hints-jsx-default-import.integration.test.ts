/**
 * Integration test for JSX elements with default imports
 * This test verifies that inlay hints work for default imported components used in JSX
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { provideInlayHints } from "../src/hints.js";

describe("hints - JSX default imports (integration)", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ts-plugin-jsx-test-"));
  });

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  function createFile(filename: string, content: string): string {
    const filePath = path.join(tempDir, filename);
    fs.writeFileSync(filePath, content, "utf-8");
    return filePath;
  }

  function createLanguageService(files: Record<string, string>) {
    const fileNames: string[] = [];

    for (const [filename, content] of Object.entries(files)) {
      const filePath = createFile(filename, content);
      fileNames.push(filePath);
    }

    // Include global.d.ts
    const globalDtsPath = path.join(
      path.dirname(new URL(import.meta.url).pathname),
      "../types/global.d.ts"
    );
    if (fs.existsSync(globalDtsPath)) {
      fileNames.push(globalDtsPath);
    }

    const servicesHost: ts.LanguageServiceHost = {
      getScriptFileNames: () => fileNames,
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
        jsx: ts.JsxEmit.React,
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

  function getInlayHints(fileName: string, service: ts.LanguageService) {
    const filePath = path.join(tempDir, fileName);
    const sourceFile = service.getProgram()?.getSourceFile(filePath);

    if (!sourceFile) {
      throw new Error(`Could not get source file for ${fileName}`);
    }

    const span: ts.TextSpan = {
      start: 0,
      length: sourceFile.text.length,
    };

    return provideInlayHints(filePath, span, service, ts);
  }

  it("should show hints for default imported component in JSX", () => {
    const service = createLanguageService({
      "Button.tsx": `"use client";

export default function Button({ children }: { children: React.ReactNode }) {
  return <button>{children}</button>;
}`,
      "App.tsx": `import Button from "./Button";

export function App() {
  return (
    <div>
      <Button>Click me</Button>
    </div>
  );
}`,
    });

    const hints = getInlayHints("App.tsx", service);
    const clientHints = hints.filter((h) => h.text === "<use client>");

    // Should have hints on both import and JSX element
    expect(clientHints).toHaveLength(2);
    expect(clientHints[0].position).toBeGreaterThan(0);
  });

  it("should show hints for export { X as default } in JSX", () => {
    const service = createLanguageService({
      "Button.tsx": `"use client";

function Button({ children }: { children: React.ReactNode }) {
  return <button>{children}</button>;
}

export { Button as default };`,
      "App.tsx": `import Button from "./Button";

export function App() {
  return (
    <div>
      <Button>Click me</Button>
    </div>
  );
}`,
    });

    const hints = getInlayHints("App.tsx", service);
    const clientHints = hints.filter((h) => h.text === "<use client>");

    // Should have hints on both import and JSX element
    expect(clientHints).toHaveLength(2);
  });

  it("should show hints for inline directive on default export in JSX", () => {
    const service = createLanguageService({
      "ServerAction.tsx": `export default function ServerAction() {
  "use server";
  return <div>Server Action</div>;
}`,
      "App.tsx": `import ServerAction from "./ServerAction";

export function App() {
  return (
    <div>
      <ServerAction />
    </div>
  );
}`,
    });

    const hints = getInlayHints("App.tsx", service);
    const serverHints = hints.filter((h) => h.text === "<use server>");

    // Should have hints on both import and JSX element
    expect(serverHints).toHaveLength(2);
  });

  it("should show hints for named imports in JSX (existing functionality)", () => {
    const service = createLanguageService({
      "components.tsx": `"use client";

export function Button({ children }: { children: React.ReactNode }) {
  return <button>{children}</button>;
}

export function Input() {
  return <input />;
}`,
      "App.tsx": `import { Button, Input } from "./components";

export function App() {
  return (
    <div>
      <Button>Click</Button>
      <Input />
    </div>
  );
}`,
    });

    const hints = getInlayHints("App.tsx", service);
    const clientHints = hints.filter((h) => h.text === "<use client>");

    // Should have hints on both imports and JSX elements (2 imports + 2 JSX usages = 4 total)
    expect(clientHints).toHaveLength(4);
  });

  it("should not show hints for local components without directives", () => {
    const service = createLanguageService({
      "App.tsx": `function LocalButton() {
  return <button>Local</button>;
}

export function App() {
  return (
    <div>
      <LocalButton />
    </div>
  );
}`,
    });

    const hints = getInlayHints("App.tsx", service);
    const directiveHints = hints.filter(
      (h) => h.text === "<use client>" || h.text === "<use server>"
    );

    expect(directiveHints).toHaveLength(0);
  });
});
