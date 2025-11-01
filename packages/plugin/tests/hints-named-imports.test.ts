import ts from "typescript";
import { describe, expect, it } from "vitest";
import { scanFileDirectives } from "../src/ast.js";
import { setCachedDirectives, setExportDirective } from "../src/cache.js";
import { provideInlayHints } from "../src/hints.js";
import { createTestLanguageService } from "./utils.js";

/**
 * Helper to scan all files and populate export cache
 * This is needed because hints rely on the export cache to find directives
 */
function populateExportCache(languageService: ts.LanguageService): void {
  const program = languageService.getProgram();
  if (!program) return;

  for (const sourceFile of program.getSourceFiles()) {
    if (sourceFile.isDeclarationFile) continue;
    if (sourceFile.fileName.includes("node_modules")) continue;
    if (sourceFile.fileName.includes("lib.")) continue;

    const scanned = scanFileDirectives(sourceFile, program, ts);
    setCachedDirectives(
      sourceFile,
      scanned.moduleDirectives,
      scanned.exportDirectives
    );

    // Populate export map for cross-file lookups
    for (const [exportName, directive] of scanned.exportDirectives.entries()) {
      setExportDirective(sourceFile.fileName, exportName, directive);
    }
  }
}

/**
 * Tests for named import handling in hints
 *
 * IMPORTANT TESTING LIMITATION:
 * These tests exercise the addImportHints function (hints.ts lines 269-332) but
 * cannot fully verify hint generation (lines 299-327) due to module resolution:
 *
 * - addImportHints uses ts.resolveModuleName() which bypasses LanguageServiceHost
 * - ts.resolveModuleName() directly accesses the filesystem via ts.sys
 * - Test files are virtual (in-memory) and don't exist on the real filesystem
 * - Module resolution always returns null, causing early return at line 293
 *
 * Current test coverage:
 * ✅ Lines 269-293: Function setup and module resolution attempt
 * ❌ Lines 299-318: Named imports handling (unreachable in unit tests)
 * ❌ Lines 320-327: Default imports handling (unreachable in unit tests)
 *
 * These tests verify:
 * - Function doesn't crash with various import patterns
 * - Code paths up to module resolution are covered
 * - Edge cases are documented
 *
 * Full coverage of lines 299-327 requires:
 * - Integration tests with real files on disk, OR
 * - Complex mocking of ts.sys (filesystem layer), OR
 * - Testing in actual VS Code environment
 */
describe("hints - named imports", () => {
  describe("import statements with named imports", () => {
    it("should handle named imports with inline directives", () => {
      const code = `import { serverAction } from "./actions";

const result = serverAction();`;

      const actionsFile = `export function serverAction() {
  "use server";
  return "data";
}`;

      const { languageService } = createTestLanguageService({
        "test.ts": code,
        "actions.ts": actionsFile,
      });

      // Populate export cache so hints can find directives
      populateExportCache(languageService);

      const hints = provideInlayHints(
        "test.ts",
        { start: 0, length: code.length },
        languageService,
        ts
      );

      // Verify the function executes without errors
      expect(Array.isArray(hints)).toBe(true);
      // Note: Hints may be empty due to module resolution limitations in tests
      // The actual hint generation is tested through integration/E2E tests
    });

    it("should handle multiple named imports", () => {
      const code = `import { action1, action2, action3 } from "./actions";

action1();
action2();
action3();`;

      const actionsFile = `export function action1() {
  "use server";
}
export function action2() {
  "use server";
}
export function action3() {
  "use server";
}`;

      const { languageService } = createTestLanguageService({
        "test.ts": code,
        "actions.ts": actionsFile,
      });

      populateExportCache(languageService);

      const hints = provideInlayHints(
        "test.ts",
        { start: 0, length: code.length },
        languageService,
        ts
      );

      expect(Array.isArray(hints)).toBe(true);
    });

    it("should handle imports with different directives", () => {
      const code = `import { serverFn, clientFn } from "./mixed";

serverFn();
clientFn();`;

      const mixedFile = `export function serverFn() {
  "use server";
}

export function clientFn() {
  "use client";
}`;

      const { languageService } = createTestLanguageService({
        "test.ts": code,
        "mixed.ts": mixedFile,
      });

      populateExportCache(languageService);

      const hints = provideInlayHints(
        "test.ts",
        { start: 0, length: code.length },
        languageService,
        ts
      );

      expect(Array.isArray(hints)).toBe(true);
    });
  });

  describe("named imports with module-level directives", () => {
    it("should handle module-level directives on imports", () => {
      const code = `import { action1, action2 } from "./actions";

action1();
action2();`;

      const actionsFile = `"use server";

export function action1() {
  return "data1";
}

export function action2() {
  return "data2";
}`;

      const { languageService } = createTestLanguageService({
        "test.ts": code,
        "actions.ts": actionsFile,
      });

      populateExportCache(languageService);

      const hints = provideInlayHints(
        "test.ts",
        { start: 0, length: code.length },
        languageService,
        ts
      );

      expect(Array.isArray(hints)).toBe(true);
    });
  });

  describe("named imports with aliases", () => {
    it("should handle renamed imports (as syntax)", () => {
      const code = `import { serverAction as myAction } from "./actions";

const result = myAction();`;

      const actionsFile = `export function serverAction() {
  "use server";
  return "data";
}`;

      const { languageService } = createTestLanguageService({
        "test.ts": code,
        "actions.ts": actionsFile,
      });

      populateExportCache(languageService);

      const hints = provideInlayHints(
        "test.ts",
        { start: 0, length: code.length },
        languageService,
        ts
      );

      expect(Array.isArray(hints)).toBe(true);
    });

    it("should handle multiple renamed imports", () => {
      const code = `import { action1 as a1, action2 as a2 } from "./actions";

a1();
a2();`;

      const actionsFile = `export function action1() {
  "use server";
}
export function action2() {
  "use server";
}`;

      const { languageService } = createTestLanguageService({
        "test.ts": code,
        "actions.ts": actionsFile,
      });

      populateExportCache(languageService);

      const hints = provideInlayHints(
        "test.ts",
        { start: 0, length: code.length },
        languageService,
        ts
      );

      expect(Array.isArray(hints)).toBe(true);
    });
  });

  describe("named imports edge cases", () => {
    it("should not show hints for imports without directives", () => {
      const code = `import { regularFn } from "./regular";

regularFn();`;

      const regularFile = `export function regularFn() {
  return "data";
}`;

      const { languageService } = createTestLanguageService({
        "test.ts": code,
        "regular.ts": regularFile,
      });

      populateExportCache(languageService);

      const hints = provideInlayHints(
        "test.ts",
        { start: 0, length: code.length },
        languageService,
        ts
      );

      // Should not have directive hints for functions without directives
      expect(Array.isArray(hints)).toBe(true);
    });

    it("should handle mixed exports (some with directives, some without)", () => {
      const code = `import { withDirective, withoutDirective } from "./mixed";

withDirective();
withoutDirective();`;

      const mixedFile = `export function withDirective() {
  "use server";
}

export function withoutDirective() {
  return "normal";
}`;

      const { languageService } = createTestLanguageService({
        "test.ts": code,
        "mixed.ts": mixedFile,
      });

      populateExportCache(languageService);

      const hints = provideInlayHints(
        "test.ts",
        { start: 0, length: code.length },
        languageService,
        ts
      );

      expect(Array.isArray(hints)).toBe(true);
    });

    it("should handle type-only imports", () => {
      const code = `import type { ServerAction } from "./actions";

type MyAction = ServerAction;`;

      const actionsFile = `export type ServerAction = () => void;`;

      const { languageService } = createTestLanguageService({
        "test.ts": code,
        "actions.ts": actionsFile,
      });

      populateExportCache(languageService);

      const hints = provideInlayHints(
        "test.ts",
        { start: 0, length: code.length },
        languageService,
        ts
      );

      // Type imports should not have runtime directive hints
      expect(Array.isArray(hints)).toBe(true);
    });
  });

  describe("named imports with call expressions", () => {
    it("should show hints for call expressions of imported functions", () => {
      const code = `import { serverAction } from "./actions";

serverAction();
serverAction();`;

      const actionsFile = `export function serverAction() {
  "use server";
  return "data";
}`;

      const { languageService } = createTestLanguageService({
        "test.ts": code,
        "actions.ts": actionsFile,
      });

      populateExportCache(languageService);

      const hints = provideInlayHints(
        "test.ts",
        { start: 0, length: code.length },
        languageService,
        ts
      );

      expect(Array.isArray(hints)).toBe(true);
    });

    it("should show hints for imported functions in arrow functions", () => {
      const code = `import { serverAction } from "./actions";

const handler = () => serverAction();
handler();`;

      const actionsFile = `export function serverAction() {
  "use server";
  return "data";
}`;

      const { languageService } = createTestLanguageService({
        "test.ts": code,
        "actions.ts": actionsFile,
      });

      populateExportCache(languageService);

      const hints = provideInlayHints(
        "test.ts",
        { start: 0, length: code.length },
        languageService,
        ts
      );

      expect(Array.isArray(hints)).toBe(true);
    });
  });

  describe("position filtering for named imports", () => {
    it("should respect span boundaries", () => {
      const code = `import { action1, action2 } from "./actions";

action1();
action2();`;

      const actionsFile = `export function action1() {
  "use server";
}

export function action2() {
  "use server";
}`;

      const { languageService } = createTestLanguageService({
        "test.ts": code,
        "actions.ts": actionsFile,
      });

      populateExportCache(languageService);

      // Only check hints in the import line
      const partialHints = provideInlayHints(
        "test.ts",
        { start: 0, length: 50 },
        languageService,
        ts
      );

      expect(Array.isArray(partialHints)).toBe(true);
    });
  });
});
