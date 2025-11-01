# Testing

This project uses [Vitest](https://vitest.dev/) for testing the TypeScript plugin.

## Running Tests

```bash
# Run tests once
pnpm test

# Run tests in watch mode (for development)
pnpm test:watch

# Run tests with UI
pnpm test:ui

# Run tests with coverage report
pnpm test:coverage
```

## Test Structure

Tests are organized in the `tests/` directory:

- **`ast.test.ts`** - Tests for AST parsing and directive detection

  - Tests `matchDirective` function for pattern matching
  - Tests `scanFileDirectives` for finding directives in code

- **`diagnostics.test.ts`** - Tests for diagnostic error messages

  - Tests Levenshtein distance algorithm for smart suggestions
  - Tests suggestion filtering and formatting

- **`cache.test.ts`** - Tests for caching functionality

  - Tests module directive caching
  - Tests export directive storage and retrieval

- **`formatting.test.ts`** - Tests for string formatting utilities

  - Tests suggestion list formatting ("or" conjunction)
  - Tests directive list formatting ("and" conjunction)

- **`utils.ts`** - Test utilities
  - `createTestProgram` - Creates a TypeScript program for testing
  - `createTestLanguageService` - Creates a language service for testing

## Coverage

The project has comprehensive test coverage with **447 tests** across **30 test files**.

Current test coverage:

- ✅ **78.84%** branch coverage overall
- ✅ Core directive matching logic (`ast.ts`)
- ✅ Caching mechanisms (`cache.ts`)
- ✅ Diagnostic error messages (`diagnostics.ts`)
- ✅ Hover information (`hover.ts`)
- ✅ Inlay hints (`hints.ts`)
- ✅ Completions (`completions.ts`)
- ✅ Plugin initialization (`index.ts`)
- ✅ Import tracking and cross-file analysis
- ✅ Edge cases and error handling

### Test Organization

Tests are organized by feature:

- **AST & Directive Detection**: `ast.test.ts`, `ast-directives.test.ts`
- **Caching**: `cache.test.ts`, `cache-advanced.test.ts`, `cache-cross-file.test.ts`
- **Diagnostics**: `diagnostics.test.ts`, `diagnostics-*.test.ts`
- **Hints**: `hints.test.ts`, `hints-*.test.ts`
- **Hover**: `hover.test.ts`, `hover-*.test.ts`
- **Completions**: `completions.test.ts`, `completions-*.test.ts`
- **Integration**: `integration.test.ts`
- **Coverage**: `index-coverage.test.ts`, `branch-coverage.test.ts`

## Writing Tests

### Example: Testing directive matching

\`\`\`typescript
import { describe, it, expect } from "vitest";
import { matchDirective } from "../src/ast.js";

describe("matchDirective", () => {
const validDirectives = ["use server", "use client", "use cache"];

it("should match simple directives", () => {
expect(matchDirective("use server", validDirectives)).toBe("use server");
});
});
\`\`\`

### Example: Testing with TypeScript program

```typescript
import { createTestProgram } from "./utils.js";
import { scanFileDirectives } from "../src/ast.js";

const code = `
  "use server";
  export function myAction() {}
`;

const program = createTestProgram({ "test.ts": code });
const sourceFile = program.getSourceFile("test.ts");
expect(sourceFile).toBeDefined();
if (!sourceFile) return;

const { moduleDirectives } = scanFileDirectives(sourceFile, program, ts);
expect(moduleDirectives).toContain("use server");
```

## Best Practices

1. **Isolated tests** - Each test should be independent
2. **Clear descriptions** - Use descriptive test names
3. **Edge cases** - Test error conditions and edge cases
4. **Real scenarios** - Use realistic code examples
5. **Mock carefully** - Use minimal mocking for TypeScript objects

## CI/CD Integration

Tests can be integrated into CI/CD pipelines:

```yaml
# GitHub Actions example
- name: Run tests
  run: pnpm test

- name: Check coverage
  run: pnpm test:coverage
```
