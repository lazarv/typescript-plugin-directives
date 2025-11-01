# typescript-plugin-directives

[![CI](https://github.com/lazarv/typescript-plugin-directives/actions/workflows/ci.yml/badge.svg)](https://github.com/lazarv/typescript-plugin-directives/actions/workflows/ci.yml)
[![npm version](https://badge.fury.io/js/typescript-plugin-directives.svg)](https://www.npmjs.com/package/typescript-plugin-directives)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A **TypeScript Language Service Plugin** that provides IDE-level awareness for `"use …"` directives such as `"use server"`, `"use client"`, `"use cache"`, and more.

## Features

- 🎯 **Directive Detection**: Automatically detects directives at module scope and within exported functions
- 💡 **Inline Hints**: Displays small inline annotations like `<use server>` next to declarations and imports
- 📝 **Hover Tooltips**: Provides detailed hover information for directive-marked exports
- ✅ **Validation**: Error checking for invalid directives with helpful error messages
- 🔍 **Import Tracking**: Recognizes when imported functions originate from directive-marked exports
- 🔌 **Extensible**: Third-party packages can add custom directives via declaration merging
- 🎨 **Framework Agnostic**: No runtime dependencies or directive semantics - pure static analysis
- 📦 **Universal Support**: Works with `.js`, `.ts`, `.jsx`, and `.tsx` files

## Supported Directives

While the plugin comes with built-in support for a minimal set of common directives, it can be extended by third-party packages. The built-in supported directives are:

- `"use server"`
- `"use client"`
- `"use no memo"`
- `"use ..."` (with optional provider and options syntax)

## Installation

```bash
npm install typescript-plugin-directives
# or
pnpm add typescript-plugin-directives
```

## Setup

Add the plugin to your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "plugins": [
      {
        "name": "typescript-plugin-directives"
      }
    ]
  }
}
```

**Enable inlay hints in VS Code** (`.vscode/settings.json`):

```json
{
  "editor.inlayHints.enabled": "on",
  "typescript.inlayHints.parameterNames.enabled": "all"
}
```

**Restart the TypeScript server:**

1. Open the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`)
2. Select **"TypeScript: Restart TS Server"**

## Usage Examples

### Module-level Directive

Place a directive at the top of your file - all exports inherit it:

```typescript
"use server";

export async function addTodo(text: string) {
  // This function has "use server" directive
}

export async function deleteTodo(id: string) {
  // This function also has "use server" directive
}
```

**IDE Display:** Both functions show `<use server>` inline hint

### Inline Function Directive

```typescript
export async function addTodo(formData: FormData) {
  "use server";
  // ... server-side logic
}
```

**IDE Display:** `addTodo <use server>`

**Hover Tooltip:**

> `"use server"`  
> `addTodo(formData: FormData): Promise<void>`  
>  
> This export is marked with the "use server" directive.

### Import from Directive-Marked Export

```typescript
import { addTodo } from "./actions";
```

**IDE Display:** `addTodo <use server>`

**Hover Tooltip:**

> Imported symbol "addTodo" originates from a "use server" export.

### Cache Directive with Options

```typescript
export async function getData() {
   "use cache: server; ttl=3600";
  // Cached with server provider, 1 hour TTL
}
```

**IDE Display:** `getData <use cache>`

## Validation

The plugin provides comprehensive validation for directives:

### Directive Recognition

- Type an unknown directive like `"use unknown"` and you'll see a red squiggle
- The error message lists all valid directives from the type system
- Third-party directives are automatically included in validation

### Position Validation

- Directives must be placed at the **beginning** of a module or function body
- Multiple consecutive directives at the start are allowed (e.g., `"use client"` followed by `"use no memo"`)
- If a directive appears after other statements, you'll get an error:
  - Module-level: `Directive "use server" must be at the beginning of the module body`
  - Function-level: `Directive "use server" must be at the beginning of the function body`

**Example of incorrect position:**

```typescript
const x = 1;
"use server"; // ❌ Error: must be at the beginning

export function action() {
  const y = 2;
  "use server"; // ❌ Error: must be at the beginning
}
```

**Example of valid position:**

```typescript
"use client";
"use no memo"; // ✅ Multiple consecutive directives allowed

import { something } from "./other";
```

```ts
export function action() {
  "use server"; // ✅ First statement in function
  const y = 2;
}
```

## Extending with Custom Directives

Third-party packages can extend the plugin by adding custom directives via **declaration merging**:

### 1. Create a type definition file

```typescript
// my-framework/global.d.ts
declare global {
  interface DirectiveRegistry {
    "use my-custom": never;
    "use another-directive": never;
  }
}

export {};
```

### 2. Include in your package

```json
{
  "name": "my-framework",
  "types": "./global.d.ts",
  "files": ["global.d.ts"]
}
```

### 3. Users get automatic IntelliSense

When users install your package, they'll automatically get:

- ✅ Autocomplete for your custom directives
- ✅ Validation (errors for typos)
- ✅ Hover tooltips
- ✅ Inlay hints

## How It Works

The plugin:

1. **Scans your code** for directive strings at the top of files or functions
2. **Tracks directives** across imports/exports
3. **Reads the global `Directive` type** from TypeScript's type system to validate directives
4. **Provides IDE features** through TypeScript Language Service API

The `Directive` type is a union of all registered directives, extended via declaration merging. This means the plugin **automatically picks up any custom directives** added by third-party packages!

## Requirements

- Node.js >= 24
- TypeScript >= 5.0.0

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](../../CONTRIBUTING.md) for details.

### Quick Start for Contributors

```bash
# Clone and install
pnpm install

# Build packages
pnpm build

# Run tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Lint and format code
pnpm lint
pnpm lint:fix

# Add a changeset for your changes
pnpm changeset
```

## License

MIT
