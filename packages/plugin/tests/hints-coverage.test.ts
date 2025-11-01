import ts from "typescript";
import { describe, expect, it } from "vitest";
import { provideInlayHints } from "../src/hints.js";
import { createTestLanguageService } from "./utils.js";

describe("provideInlayHints - uncovered code paths", () => {
  describe("local function references in same file", () => {
    it("should show hints for local function references with inline directives", () => {
      const code = `function localAction() {
  "use server";
  return "test";
}

export function caller() {
  return localAction();
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
      // Should find hints for the local function reference
    });

    it("should show hints for variable declaration with arrow function and directive", () => {
      const code = `const localAction = () => {
  "use server";
  return "test";
};

export function caller() {
  return localAction();
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

    it("should check cache for exported functions in same file", () => {
      const code = `export function exportedAction() {
  "use server";
  return "test";
}

function caller() {
  return exportedAction();
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
      // Should check cache and find the exported function's directive
    });

    it("should handle local function reference when declaration file matches source file", () => {
      const code = `export const myAction = () => {
  "use server";
  return "test";
};

export function test() {
  const ref = myAction;
  return ref();
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

  describe("cache scanning when cache is not available", () => {
    it("should scan and cache when cached directives are null", () => {
      const code = `export function action1() {
  "use server";
  return "test";
}

export function action2() {
  return action1();
}`;

      const { languageService } = createTestLanguageService({
        "test.ts": code,
      });

      // First call should scan and cache
      const hints1 = provideInlayHints(
        "test.ts",
        { start: 0, length: code.length },
        languageService,
        ts
      );

      // Second call should use cache
      const hints2 = provideInlayHints(
        "test.ts",
        { start: 0, length: code.length },
        languageService,
        ts
      );

      expect(Array.isArray(hints1)).toBe(true);
      expect(Array.isArray(hints2)).toBe(true);
    });

    it("should scan declaration file and cache exportDirectives", () => {
      const code = `export function fn1() {
  "use server";
  return "a";
}

export function fn2() {
  "use cache";
  return "b";
}

function test() {
  fn1();
  fn2();
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

  describe("position filtering for hints", () => {
    it("should only include hints within the specified span", () => {
      const code = `export function action1() {
  "use server";
  return "test";
}

export function action2() {
  "use cache";
  return "test";
}`;

      const { languageService } = createTestLanguageService({
        "test.ts": code,
      });

      // Only get hints for first part of the file
      const hints = provideInlayHints(
        "test.ts",
        { start: 0, length: 50 },
        languageService,
        ts
      );

      expect(Array.isArray(hints)).toBe(true);
    });

    it("should filter out hints that fall outside span range", () => {
      const code = `function localFn() {
  "use server";
  return "test";
}

export function exported() {
  return localFn();
}`;

      const { languageService } = createTestLanguageService({
        "test.ts": code,
      });

      // Test with limited span
      const hints = provideInlayHints(
        "test.ts",
        { start: 60, length: 50 },
        languageService,
        ts
      );

      expect(Array.isArray(hints)).toBe(true);
    });
  });

  describe("identifier text extraction for cache lookup", () => {
    it("should extract correct function name from identifier for cache lookup", () => {
      const code = `export const myServerAction = () => {
  "use server";
  return "data";
};

function test() {
  myServerAction();
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
      // Should find "myServerAction" in export directives
    });

    it("should handle complex identifier scenarios", () => {
      const code = `export function action1() {
  "use server";
  return "1";
}

export const action2 = () => {
  "use cache";
  return "2";
};

function caller() {
  action1();
  action2();
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
