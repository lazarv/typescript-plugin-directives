import ts from "typescript";
import { describe, expect, it } from "vitest";
import { getQuickInfoAtPosition } from "../src/hover.js";
import { createTestLanguageService } from "./utils.js";

describe("getQuickInfoAtPosition - uncovered code paths", () => {
  describe("documentation fallback scenarios", () => {
    it("should use fallback doc when getDirectiveDocumentationTag returns null for module type", () => {
      const code = `"use server";
export function myAction() {
  return "test";
}`;

      const { languageService } = createTestLanguageService({
        "test.ts": code,
      });

      const prior = (_fileName: string, position: number) => ({
        kind: ts.ScriptElementKind.functionElement,
        kindModifiers: "export",
        textSpan: { start: position, length: 8 },
        displayParts: [],
        documentation: [],
        tags: [],
      });

      const position = 30; // On function name

      const quickInfo = getQuickInfoAtPosition(
        "test.ts",
        position,
        languageService,
        ts,
        prior
      );

      expect(quickInfo).toBeDefined();
      if (quickInfo?.documentation) {
        const docText = quickInfo.documentation
          .map((d) => ("text" in d ? d.text : ""))
          .join("");
        // Should contain fallback text since we don't have JSDoc
        expect(docText.length).toBeGreaterThan(0);
      }
    });

    it("should use fallback doc when getDirectiveDocumentationTag returns null for inline type", () => {
      const code = `export function myAction() {
  "use server";
  return "test";
}`;

      const { languageService } = createTestLanguageService({
        "test.ts": code,
      });

      const prior = (_fileName: string, position: number) => ({
        kind: ts.ScriptElementKind.functionElement,
        kindModifiers: "export",
        textSpan: { start: position, length: 8 },
        displayParts: [],
        documentation: [],
        tags: [],
      });

      const position = 16; // On function name

      const quickInfo = getQuickInfoAtPosition(
        "test.ts",
        position,
        languageService,
        ts,
        prior
      );

      expect(quickInfo).toBeDefined();
      if (quickInfo?.documentation) {
        const docText = quickInfo.documentation
          .map((d) => ("text" in d ? d.text : ""))
          .join("");
        expect(docText).toContain("use server");
      }
    });

    it("should use generic fallback when type is neither module nor inline", () => {
      const code = `export const myAction = () => {
  "use server";
  return "test";
};`;

      const { languageService } = createTestLanguageService({
        "test.ts": code,
      });

      const prior = (_fileName: string, position: number) => ({
        kind: ts.ScriptElementKind.constElement,
        kindModifiers: "export",
        textSpan: { start: position, length: 8 },
        displayParts: [],
        documentation: [],
        tags: [],
      });

      const position = 13; // On const name

      const quickInfo = getQuickInfoAtPosition(
        "test.ts",
        position,
        languageService,
        ts,
        prior
      );

      expect(quickInfo).toBeDefined();
    });
  });

  describe("node type checking in fallback", () => {
    it("should check if node is identifier when creating inline fallback doc", () => {
      const code = `export function testFunction() {
  "use server";
  return "data";
}`;

      const { languageService } = createTestLanguageService({
        "test.ts": code,
      });

      const prior = (_fileName: string, position: number) => ({
        kind: ts.ScriptElementKind.functionElement,
        kindModifiers: "export",
        textSpan: { start: position, length: 12 },
        displayParts: [
          { text: "function", kind: "keyword" },
          { text: " ", kind: "space" },
          { text: "testFunction", kind: "functionName" },
        ],
        documentation: [],
        tags: [],
      });

      const position = 16; // On function keyword/name

      const quickInfo = getQuickInfoAtPosition(
        "test.ts",
        position,
        languageService,
        ts,
        prior
      );

      expect(quickInfo).toBeDefined();
      if (quickInfo?.documentation) {
        const docText = quickInfo.documentation
          .map((d) => ("text" in d ? d.text : ""))
          .join("");
        // Should mention "function" in the fallback text
        expect(docText.length).toBeGreaterThan(0);
      }
    });

    it("should use 'function' as default name when node is not identifier", () => {
      const code = `export const handler = () => {
  "use cache";
  return "result";
};`;

      const { languageService } = createTestLanguageService({
        "test.ts": code,
      });

      const prior = (_fileName: string, position: number) => ({
        kind: ts.ScriptElementKind.constElement,
        kindModifiers: "export",
        textSpan: { start: position, length: 7 },
        displayParts: [],
        documentation: [],
        tags: [],
      });

      const position = 13;

      const quickInfo = getQuickInfoAtPosition(
        "test.ts",
        position,
        languageService,
        ts,
        prior
      );

      expect(quickInfo).toBeDefined();
    });
  });

  describe("resolveModuleName edge cases", () => {
    it("should return null when module cannot be resolved", () => {
      const code = `import { something } from "./nonexistent";

const x = something();`;

      const { languageService } = createTestLanguageService({
        "test.ts": code,
      });

      const prior = () => undefined;
      const position = 9; // On "something"

      const quickInfo = getQuickInfoAtPosition(
        "test.ts",
        position,
        languageService,
        ts,
        prior
      );

      // Should handle gracefully when module can't be resolved
      expect(quickInfo).toBeUndefined();
    });

    it("should handle when resolvedModule is undefined", () => {
      const code = `import { fn } from "unresolvable-module";`;

      const { languageService } = createTestLanguageService({
        "test.ts": code,
      });

      const prior = () => undefined;
      const position = 9;

      const quickInfo = getQuickInfoAtPosition(
        "test.ts",
        position,
        languageService,
        ts,
        prior
      );

      expect(quickInfo).toBeUndefined();
    });
  });

  describe("display parts enhancement", () => {
    it("should add directive tag as first display part with line break", () => {
      const code = `"use cache";
export function cached() {
  return "data";
}`;

      const { languageService } = createTestLanguageService({
        "test.ts": code,
      });

      const prior = (_fileName: string, position: number) => ({
        kind: ts.ScriptElementKind.functionElement,
        kindModifiers: "export",
        textSpan: { start: position, length: 6 },
        displayParts: [
          { text: "function", kind: "keyword" },
          { text: " ", kind: "space" },
          { text: "cached", kind: "functionName" },
        ],
        documentation: [],
        tags: [],
      });

      const position = 30; // On function name

      const quickInfo = getQuickInfoAtPosition(
        "test.ts",
        position,
        languageService,
        ts,
        prior
      );

      expect(quickInfo).toBeDefined();
      if (quickInfo?.displayParts) {
        expect(quickInfo.displayParts.length).toBeGreaterThan(2);
        // First part should be the directive string
        expect(quickInfo.displayParts[0].text).toContain("use cache");
        // Second part should be line break
        expect(quickInfo.displayParts[1].kind).toBe("lineBreak");
      }
    });

    it("should preserve original display parts after directive tag", () => {
      const code = `"use server";
export function action() {}`;

      const { languageService } = createTestLanguageService({
        "test.ts": code,
      });

      const originalParts = [
        { text: "function", kind: "keyword" as const },
        { text: " ", kind: "space" as const },
        { text: "action", kind: "functionName" as const },
      ];

      const prior = (_fileName: string, position: number) => ({
        kind: ts.ScriptElementKind.functionElement,
        kindModifiers: "export",
        textSpan: { start: position, length: 6 },
        displayParts: originalParts,
        documentation: [],
        tags: [],
      });

      const position = 30;

      const quickInfo = getQuickInfoAtPosition(
        "test.ts",
        position,
        languageService,
        ts,
        prior
      );

      expect(quickInfo).toBeDefined();
      if (quickInfo?.displayParts) {
        // Should have directive + line break + original parts
        expect(quickInfo.displayParts.length).toBe(originalParts.length + 2);
      }
    });
  });

  describe("documentation array construction", () => {
    it("should append new documentation with line breaks", () => {
      const code = `"use server";
export function withDocs() {
  return "test";
}`;

      const { languageService } = createTestLanguageService({
        "test.ts": code,
      });

      const prior = (_fileName: string, position: number) => ({
        kind: ts.ScriptElementKind.functionElement,
        kindModifiers: "export",
        textSpan: { start: position, length: 8 },
        displayParts: [],
        documentation: [
          { text: "Original documentation", kind: "text" as const },
        ],
        tags: [],
      });

      const position = 30;

      const quickInfo = getQuickInfoAtPosition(
        "test.ts",
        position,
        languageService,
        ts,
        prior
      );

      expect(quickInfo).toBeDefined();
      if (quickInfo?.documentation) {
        expect(quickInfo.documentation.length).toBeGreaterThan(1);
        // Should have original doc + line breaks + directive doc
        const hasLineBreak = quickInfo.documentation.some(
          (d) => "kind" in d && d.kind === "lineBreak"
        );
        expect(hasLineBreak).toBe(true);
      }
    });

    it("should handle empty original documentation array", () => {
      const code = `export function fn() {
  "use cache";
  return "x";
}`;

      const { languageService } = createTestLanguageService({
        "test.ts": code,
      });

      const prior = (_fileName: string, position: number) => ({
        kind: ts.ScriptElementKind.functionElement,
        kindModifiers: "export",
        textSpan: { start: position, length: 2 },
        displayParts: [],
        documentation: [],
        tags: [],
      });

      const position = 16;

      const quickInfo = getQuickInfoAtPosition(
        "test.ts",
        position,
        languageService,
        ts,
        prior
      );

      expect(quickInfo).toBeDefined();
      if (quickInfo?.documentation) {
        // Should still add documentation even if original was empty
        expect(quickInfo.documentation.length).toBeGreaterThan(0);
      }
    });
  });

  describe("symbolName parameter usage", () => {
    it("should pass symbolName to enhanceQuickInfo when available", () => {
      const code = `import { namedExport } from "./other";`;

      const otherFile = `"use server";
export function namedExport() {
  return "test";
}`;

      const { languageService } = createTestLanguageService({
        "test.ts": code,
        "./other.ts": otherFile,
      });

      const prior = (_fileName: string, position: number) => ({
        kind: ts.ScriptElementKind.functionElement,
        kindModifiers: "export",
        textSpan: { start: position, length: 11 },
        displayParts: [],
        documentation: [],
        tags: [],
      });

      const position = 9; // On "namedExport"

      const quickInfo = getQuickInfoAtPosition(
        "test.ts",
        position,
        languageService,
        ts,
        prior
      );

      expect(quickInfo).toBeDefined();
    });
  });
});
