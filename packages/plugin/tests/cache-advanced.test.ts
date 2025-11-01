import { beforeEach, describe, expect, it } from "vitest";
import {
  clearAllCaches,
  clearCachedDirectives,
  clearExportDirectives,
  getCachedDirectives,
  getExportDirective,
  normalizeFilePath,
  setCachedDirectives,
  setExportDirective,
} from "../src/cache.js";
import { createTestProgram } from "./utils.js";

describe("cache - advanced scenarios", () => {
  beforeEach(() => {
    clearAllCaches();
  });

  describe("getCachedDirectives", () => {
    it("should return null for uncached files", () => {
      const program = createTestProgram({
        "test.ts": "export function test() {}",
      });
      const sourceFile = program.getSourceFile("test.ts");
      expect(sourceFile).toBeDefined();
      if (!sourceFile) return;

      const result = getCachedDirectives(sourceFile);
      expect(result).toBeNull();
    });

    it("should return cached data after setting", () => {
      const program = createTestProgram({
        "test.ts": "export function test() {}",
      });
      const sourceFile = program.getSourceFile("test.ts");
      expect(sourceFile).toBeDefined();
      if (!sourceFile) return;

      const moduleDirectives = ["use server"];
      const exportDirectives = new Map([["test", "use server"]]);

      setCachedDirectives(sourceFile, moduleDirectives, exportDirectives);

      const result = getCachedDirectives(sourceFile);
      expect(result).not.toBeNull();
      expect(result?.moduleDirectives).toEqual(moduleDirectives);
      expect(result?.exportDirectives).toEqual(exportDirectives);
    });

    it("should handle multiple files independently", () => {
      const program = createTestProgram({
        "file1.ts": "export function fn1() {}",
        "file2.ts": "export function fn2() {}",
      });

      const file1 = program.getSourceFile("file1.ts");
      const file2 = program.getSourceFile("file2.ts");
      expect(file1).toBeDefined();
      expect(file2).toBeDefined();
      if (!file1 || !file2) return;

      setCachedDirectives(
        file1,
        ["use server"],
        new Map([["fn1", "use server"]])
      );
      setCachedDirectives(
        file2,
        ["use client"],
        new Map([["fn2", "use client"]])
      );

      const result1 = getCachedDirectives(file1);
      const result2 = getCachedDirectives(file2);

      expect(result1?.moduleDirectives).toEqual(["use server"]);
      expect(result2?.moduleDirectives).toEqual(["use client"]);
    });

    it("should handle empty directives", () => {
      const program = createTestProgram({
        "test.ts": "export function test() {}",
      });
      const sourceFile = program.getSourceFile("test.ts");
      expect(sourceFile).toBeDefined();
      if (!sourceFile) return;

      setCachedDirectives(sourceFile, [], new Map());

      const result = getCachedDirectives(sourceFile);
      expect(result).not.toBeNull();
      expect(result?.moduleDirectives).toEqual([]);
      expect(result?.exportDirectives.size).toBe(0);
    });

    it("should handle overwriting cached data", () => {
      const program = createTestProgram({
        "test.ts": "export function test() {}",
      });
      const sourceFile = program.getSourceFile("test.ts");
      expect(sourceFile).toBeDefined();
      if (!sourceFile) return;

      // Set initial cache
      setCachedDirectives(
        sourceFile,
        ["use server"],
        new Map([["test", "use server"]])
      );

      // Overwrite with new data
      setCachedDirectives(
        sourceFile,
        ["use client"],
        new Map([["test", "use client"]])
      );

      const result = getCachedDirectives(sourceFile);
      expect(result?.moduleDirectives).toEqual(["use client"]);
      expect(result?.exportDirectives.get("test")).toBe("use client");
    });
  });

  describe("getExportDirective", () => {
    it("should return directive for cached export", () => {
      setExportDirective("test.ts", "myAction", "use server");

      const result = getExportDirective("test.ts", "myAction");
      expect(result).toBe("use server");
    });

    it("should return null for non-existent export", () => {
      setExportDirective("test.ts", "myAction", "use server");

      const result = getExportDirective("test.ts", "nonExistent");
      expect(result).toBeNull();
    });

    it("should return null for uncached file", () => {
      const result = getExportDirective("uncached.ts", "someExport");
      expect(result).toBeNull();
    });

    it("should handle default exports", () => {
      setExportDirective("test.ts", "default", "use server");

      const result = getExportDirective("test.ts", "default");
      expect(result).toBe("use server");
    });

    it("should handle multiple exports", () => {
      setExportDirective("test.ts", "fn1", "use server");
      setExportDirective("test.ts", "fn2", "use server");

      expect(getExportDirective("test.ts", "fn1")).toBe("use server");
      expect(getExportDirective("test.ts", "fn2")).toBe("use server");
    });

    it("should handle mixed directives", () => {
      setExportDirective("test.ts", "fn1", "use server");
      setExportDirective("test.ts", "fn2", "use client");

      expect(getExportDirective("test.ts", "fn1")).toBe("use server");
      expect(getExportDirective("test.ts", "fn2")).toBe("use client");
    });
  });

  describe("clearAllCaches", () => {
    it("should clear export directive cache", () => {
      setExportDirective("file1.ts", "test1", "use server");
      setExportDirective("file2.ts", "test2", "use client");

      // Verify cache is set
      expect(getExportDirective("file1.ts", "test1")).toBe("use server");
      expect(getExportDirective("file2.ts", "test2")).toBe("use client");

      // Clear cache
      clearAllCaches();

      // Verify export cache is cleared
      expect(getExportDirective("file1.ts", "test1")).toBeNull();
      expect(getExportDirective("file2.ts", "test2")).toBeNull();
    });

    it("should allow re-caching after clear", () => {
      setExportDirective("test.ts", "fn", "use server");
      expect(getExportDirective("test.ts", "fn")).toBe("use server");

      // Clear cache
      clearAllCaches();
      expect(getExportDirective("test.ts", "fn")).toBeNull();

      // Re-cache
      setExportDirective("test.ts", "fn", "use client");
      expect(getExportDirective("test.ts", "fn")).toBe("use client");
    });

    it("should clear export directives but not WeakMap file cache", () => {
      // WeakMap (fileCache) is not cleared by clearAllCaches
      const program = createTestProgram({
        "test.ts": "export function test() {}",
      });
      const sourceFile = program.getSourceFile("test.ts");
      expect(sourceFile).toBeDefined();
      if (!sourceFile) return;

      setCachedDirectives(sourceFile, ["use server"], new Map());
      setExportDirective("test.ts", "fn", "use server");

      // Clear caches
      clearAllCaches();

      // WeakMap cache might still have data (it's not explicitly cleared)
      // Only exportMap is cleared
      expect(getExportDirective("test.ts", "fn")).toBeNull();
    });
  });

  describe("clearCachedDirectives", () => {
    it("should clear specific file cache", () => {
      const program = createTestProgram({
        "file1.ts": "export function test1() {}",
        "file2.ts": "export function test2() {}",
      });

      const file1 = program.getSourceFile("file1.ts");
      const file2 = program.getSourceFile("file2.ts");
      expect(file1).toBeDefined();
      expect(file2).toBeDefined();
      if (!file1 || !file2) return;

      setCachedDirectives(file1, ["use server"], new Map());
      setCachedDirectives(file2, ["use client"], new Map());

      // Clear only file1
      clearCachedDirectives(file1);

      // Verify file1 is cleared but file2 is not
      expect(getCachedDirectives(file1)).toBeNull();
      expect(getCachedDirectives(file2)).not.toBeNull();
    });
  });

  describe("clearExportDirectives", () => {
    it("should clear export directives for specific file", () => {
      const program = createTestProgram({
        "test.ts": "export function test() {}",
      });
      const _sourceFile = program.getSourceFile("test.ts");
      expect(_sourceFile).toBeDefined();
      if (!_sourceFile) return;

      setExportDirective("test.ts", "fn1", "use server");
      setExportDirective("test.ts", "fn2", "use client");

      expect(getExportDirective("test.ts", "fn1")).toBe("use server");

      clearExportDirectives("test.ts");

      expect(getExportDirective("test.ts", "fn1")).toBeNull();
      expect(getExportDirective("test.ts", "fn2")).toBeNull();
    });
  });

  describe("normalizeFilePath", () => {
    it("should normalize Windows paths to Unix format", () => {
      const windowsPath = "C:\\Users\\test\\file.ts";
      const normalized = normalizeFilePath(windowsPath);
      expect(normalized).toBe("C:/Users/test/file.ts");
    });

    it("should keep Unix paths unchanged", () => {
      const unixPath = "/Users/test/file.ts";
      const normalized = normalizeFilePath(unixPath);
      expect(normalized).toBe(unixPath);
    });

    it("should handle mixed separators", () => {
      const mixedPath = "C:\\Users/test\\file.ts";
      const normalized = normalizeFilePath(mixedPath);
      expect(normalized).toBe("C:/Users/test/file.ts");
    });

    it("should handle relative paths", () => {
      const relativePath = "./test/file.ts";
      const normalized = normalizeFilePath(relativePath);
      expect(normalized).toBe("./test/file.ts");
    });
  });

  describe("setExportDirective and getExportDirective", () => {
    it("should set and get export directives", () => {
      setExportDirective("test.ts", "myFunction", "use server");
      const result = getExportDirective("test.ts", "myFunction");
      expect(result).toBe("use server");
    });

    it("should handle multiple exports for same file", () => {
      setExportDirective("test.ts", "fn1", "use server");
      setExportDirective("test.ts", "fn2", "use client");

      expect(getExportDirective("test.ts", "fn1")).toBe("use server");
      expect(getExportDirective("test.ts", "fn2")).toBe("use client");
    });

    it("should overwrite existing export directive", () => {
      setExportDirective("test.ts", "myFunction", "use server");
      expect(getExportDirective("test.ts", "myFunction")).toBe("use server");

      setExportDirective("test.ts", "myFunction", "use client");
      expect(getExportDirective("test.ts", "myFunction")).toBe("use client");
    });

    it("should normalize file paths when setting/getting", () => {
      const windowsPath = "C:\\test\\file.ts";
      const unixPath = "C:/test/file.ts";

      setExportDirective(windowsPath, "fn", "use server");
      const result = getExportDirective(unixPath, "fn");
      expect(result).toBe("use server");
    });
  });

  describe("cache performance scenarios", () => {
    it("should handle many exports efficiently", () => {
      for (let i = 0; i < 100; i++) {
        setExportDirective("test.ts", `fn${i}`, "use server");
      }

      expect(getExportDirective("test.ts", "fn50")).toBe("use server");
      expect(getExportDirective("test.ts", "fn99")).toBe("use server");
    });

    it("should handle long file paths", () => {
      const longPath =
        "/very/long/path/to/some/deeply/nested/directory/file.ts";
      const program = createTestProgram({
        [longPath]: "export function test() {}",
      });
      const sourceFile = program.getSourceFile(longPath);
      expect(sourceFile).toBeDefined();
      if (!sourceFile) return;

      setCachedDirectives(sourceFile, ["use server"], new Map());

      expect(getCachedDirectives(sourceFile)).not.toBeNull();
    });

    it("should handle special characters in export names", () => {
      setExportDirective("test.ts", "$special", "use server");
      setExportDirective("test.ts", "_private", "use client");
      setExportDirective("test.ts", "123numeric", "use cache");

      expect(getExportDirective("test.ts", "$special")).toBe("use server");
      expect(getExportDirective("test.ts", "_private")).toBe("use client");
      expect(getExportDirective("test.ts", "123numeric")).toBe("use cache");
    });
  });
});
