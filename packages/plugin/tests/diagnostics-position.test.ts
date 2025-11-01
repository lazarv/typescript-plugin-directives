/**
 * Tests for directive position validation
 */

import ts from "typescript";
import { describe, expect, it } from "vitest";
import { getSemanticDiagnostics } from "../src/diagnostics.js";
import { createTestLanguageService } from "./utils.js";

describe("diagnostics - directive position", () => {
  it("should error when module-level directive is not first statement (after variable)", () => {
    const code = `const x = 1;
"use server";

export function test() {}`;

    const { languageService } = createTestLanguageService({
      "test.ts": code,
    });

    const prior = () => [];
    const diagnostics = getSemanticDiagnostics(
      "test.ts",
      languageService,
      ts,
      prior
    );

    const positionErrors = diagnostics.filter((d) => d.code === 99002);
    expect(positionErrors).toHaveLength(1);
    expect(positionErrors[0].messageText).toContain(
      'Directive "use server" must be at the beginning of the module body'
    );
  });

  it("should error when module-level directive is not first statement (after import)", () => {
    const code = `import { something } from "./other";
"use client";

export function Component() {}`;

    const { languageService } = createTestLanguageService({
      "test.ts": code,
    });

    const prior = () => [];
    const diagnostics = getSemanticDiagnostics(
      "test.ts",
      languageService,
      ts,
      prior
    );

    const positionErrors = diagnostics.filter((d) => d.code === 99002);
    expect(positionErrors).toHaveLength(1);
    expect(positionErrors[0].messageText).toContain(
      'Directive "use client" must be at the beginning of the module body'
    );
  });

  it("should error when function-level directive is not first statement (after variable)", () => {
    const code = `export function action() {
  const x = 1;
  "use server";
  return x;
}`;

    const { languageService } = createTestLanguageService({
      "test.ts": code,
    });

    const prior = () => [];
    const diagnostics = getSemanticDiagnostics(
      "test.ts",
      languageService,
      ts,
      prior
    );

    const positionErrors = diagnostics.filter((d) => d.code === 99002);
    expect(positionErrors).toHaveLength(1);
    expect(positionErrors[0].messageText).toContain(
      'Directive "use server" must be at the beginning of the function body'
    );
  });

  it("should error when function-level directive is not first statement (after expression)", () => {
    const code = `export function action() {
  console.log("start");
  "use client";
  return "done";
}`;

    const { languageService } = createTestLanguageService({
      "test.ts": code,
    });

    const prior = () => [];
    const diagnostics = getSemanticDiagnostics(
      "test.ts",
      languageService,
      ts,
      prior
    );

    const positionErrors = diagnostics.filter((d) => d.code === 99002);
    expect(positionErrors).toHaveLength(1);
    expect(positionErrors[0].messageText).toContain(
      'Directive "use client" must be at the beginning of the function body'
    );
  });

  it("should NOT error when module-level directive is first statement", () => {
    const code = `"use server";

import { something } from "./other";

export function test() {}`;

    const { languageService } = createTestLanguageService({
      "test.ts": code,
    });

    const prior = () => [];
    const diagnostics = getSemanticDiagnostics(
      "test.ts",
      languageService,
      ts,
      prior
    );

    const positionErrors = diagnostics.filter((d) => d.code === 99002);
    expect(positionErrors).toHaveLength(0);
  });

  it("should NOT error when function-level directive is first statement", () => {
    const code = `export function action() {
  "use server";
  const x = 1;
  return x;
}`;

    const { languageService } = createTestLanguageService({
      "test.ts": code,
    });

    const prior = () => [];
    const diagnostics = getSemanticDiagnostics(
      "test.ts",
      languageService,
      ts,
      prior
    );

    const positionErrors = diagnostics.filter((d) => d.code === 99002);
    expect(positionErrors).toHaveLength(0);
  });

  it("should handle multiple misplaced directives", () => {
    const code = `const x = 1;
"use server";

export function action() {
  const y = 2;
  "use client";
  return y;
}`;

    const { languageService } = createTestLanguageService({
      "test.ts": code,
    });

    const prior = () => [];
    const diagnostics = getSemanticDiagnostics(
      "test.ts",
      languageService,
      ts,
      prior
    );

    const positionErrors = diagnostics.filter((d) => d.code === 99002);
    expect(positionErrors).toHaveLength(2);
    expect(positionErrors[0].messageText).toContain("module body");
    expect(positionErrors[1].messageText).toContain("function body");
  });

  it("should handle both position error and unknown directive error", () => {
    const code = `const x = 1;
"use invalid";`;

    const { languageService } = createTestLanguageService({
      "test.ts": code,
    });

    const prior = () => [];
    const diagnostics = getSemanticDiagnostics(
      "test.ts",
      languageService,
      ts,
      prior
    );

    // Should have both position error (99002) and unknown directive error (99001)
    const positionErrors = diagnostics.filter((d) => d.code === 99002);
    const unknownErrors = diagnostics.filter((d) => d.code === 99001);

    expect(positionErrors).toHaveLength(1);
    expect(unknownErrors).toHaveLength(1); // Now validated even when not in first position
  });

  it("should only validate directive syntax when in correct position", () => {
    const code = `"use invalid";

export function test() {}`;

    const { languageService } = createTestLanguageService({
      "test.ts": code,
    });

    const prior = () => [];
    const diagnostics = getSemanticDiagnostics(
      "test.ts",
      languageService,
      ts,
      prior
    );

    // Should have unknown directive error but NOT position error
    const positionErrors = diagnostics.filter((d) => d.code === 99002);
    const unknownErrors = diagnostics.filter((d) => d.code === 99001);

    expect(positionErrors).toHaveLength(0);
    expect(unknownErrors).toHaveLength(1);
  });
});
