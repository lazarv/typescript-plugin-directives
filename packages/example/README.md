# Example Project

This example demonstrates the TypeScript Directives Plugin in action.

## Setup

1. Install dependencies from the root:

   ```bash
   pnpm install
   ```

2. Build the plugin:

   ```bash
   pnpm --filter typescript-directives-plugin build
   ```

3. Open this folder in VS Code

4. Select the workspace TypeScript version:
   - Open Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`)
   - Select "TypeScript: Select TypeScript Version"
   - Choose "Use Workspace Version"

## What to Try

1. **Open `src/actions.ts`**

   - Hover over the exported function names like `addTodo`, `deleteTodo`
   - You should see `[use server]` tags in the hover tooltip

2. **Open `src/cache.ts`**

   - Hover over functions like `getUserProfile`, `getStaticData`
   - You should see `[use cache]` tags with provider information

3. **Open `src/index.ts`**

   - Hover over the imported functions
   - You should see directive annotations indicating they come from directive-marked exports

4. **Check Inlay Hints**
   - Make sure inlay hints are enabled in VS Code
   - You should see inline `[use server]` and `[use cache]` annotations next to function names

## Files

- `actions.ts` - Server actions with `"use server"` directive
- `client.tsx` - Client components with `"use client"` module directive
- `index.ts` - Imports from directive-marked files
