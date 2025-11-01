import { beforeEach, describe, expect, it } from "vitest";
import {
  clearExportDirectives,
  getCachedDirectives,
  getExportDirective,
  setCachedDirectives,
  setExportDirective,
} from "../src/cache.js";

describe("cache", () => {
  beforeEach(() => {
    // Note: In a real scenario, you might want to clear all caches
    // but the current implementation doesn't expose that functionality
  });

  describe("directive caching", () => {
    it("should cache and retrieve module directives", () => {
      const mockSourceFile = {
        fileName: "test.ts",
        getFullText: () => '"use server"; export function test() {}',
      } as any;

      setCachedDirectives(
        mockSourceFile,
        ["use server"],
        new Map([["test", "use server"]])
      );

      const cached = getCachedDirectives(mockSourceFile);
      expect(cached).toBeDefined();
      expect(cached?.moduleDirectives).toContain("use server");
      expect(cached?.exportDirectives.get("test")).toBe("use server");
    });

    it("should return undefined for uncached files", () => {
      const mockSourceFile = {
        fileName: "uncached.ts",
        getFullText: () => "",
      } as any;

      const cached = getCachedDirectives(mockSourceFile);
      expect(cached).toBeNull();
    });

    it("should handle files with no directives", () => {
      const mockSourceFile = {
        fileName: "empty.ts",
        getFullText: () => "export function test() {}",
      } as any;

      setCachedDirectives(mockSourceFile, [], new Map());

      const cached = getCachedDirectives(mockSourceFile);
      expect(cached).toBeDefined();
      expect(cached?.moduleDirectives).toHaveLength(0);
      expect(cached?.exportDirectives.size).toBe(0);
    });
  });

  describe("export directives", () => {
    it("should store and retrieve export directives", () => {
      setExportDirective("file.ts", "myFunction", "use server");

      const directive = getExportDirective("file.ts", "myFunction");
      expect(directive).toBe("use server");
    });

    it("should return null for non-existent exports", () => {
      const directive = getExportDirective("nonexistent.ts", "someFunction");
      expect(directive).toBeNull();
    });

    it("should handle multiple exports from same file", () => {
      setExportDirective("multi.ts", "func1", "use server");
      setExportDirective("multi.ts", "func2", "use client");
      setExportDirective("multi.ts", "func3", "use cache");

      expect(getExportDirective("multi.ts", "func1")).toBe("use server");
      expect(getExportDirective("multi.ts", "func2")).toBe("use client");
      expect(getExportDirective("multi.ts", "func3")).toBe("use cache");
    });

    it("should clear export directives for a file", () => {
      setExportDirective("clear-test.ts", "func1", "use server");
      setExportDirective("clear-test.ts", "func2", "use client");

      clearExportDirectives("clear-test.ts");

      expect(getExportDirective("clear-test.ts", "func1")).toBeNull();
      expect(getExportDirective("clear-test.ts", "func2")).toBeNull();
    });

    it("should not affect other files when clearing", () => {
      setExportDirective("file1.ts", "func", "use server");
      setExportDirective("file2.ts", "func", "use client");

      clearExportDirectives("file1.ts");

      expect(getExportDirective("file1.ts", "func")).toBeNull();
      expect(getExportDirective("file2.ts", "func")).toBe("use client");
    });
  });
});
