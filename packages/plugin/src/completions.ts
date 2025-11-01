/**
 * Completions (IntelliSense) for directive strings
 */

import type ts from "typescript";

/**
 * Get all valid directive strings by expanding the Directive union type
 */
function getValidDirectives(
  program: ts.Program,
  _sourceFile: ts.SourceFile,
  ts: typeof import("typescript")
): string[] {
  const typeChecker = program.getTypeChecker();
  const directives: string[] = [];

  try {
    // Look for the Directive type alias
    let directiveSymbol: ts.Symbol | undefined;

    for (const file of program.getSourceFiles()) {
      // Skip node_modules except our own global.d.ts
      if (
        file.fileName.includes("node_modules") &&
        !file.fileName.includes("typescript-plugin-directives")
      ) {
        continue;
      }

      // Try to get the Directive type from this file
      const symbol = typeChecker.resolveName(
        "Directive",
        file as any,
        ts.SymbolFlags.Type,
        false
      );

      if (symbol) {
        directiveSymbol = symbol;
        break;
      }
    }

    if (!directiveSymbol) {
      return directives;
    }

    const directiveType = typeChecker.getDeclaredTypeOfSymbol(directiveSymbol);
    if (!directiveType) {
      return directives;
    }

    // If it's a union type, expand all members
    if (directiveType.isUnion()) {
      for (const memberType of directiveType.types) {
        // Get string literal types
        if (memberType.isStringLiteral()) {
          const value = memberType.value;
          directives.push(value);
        }
        // Handle nested unions
        else if (memberType.isUnion()) {
          for (const nestedType of memberType.types) {
            if (nestedType.isStringLiteral()) {
              directives.push(nestedType.value);
            }
          }
        }
      }
    }
    // If it's a single string literal
    else if (directiveType.isStringLiteral()) {
      directives.push(directiveType.value);
    }
  } catch (_error) {
    // Silent fail - return empty array
  }

  return directives;
}

/**
 * Check if position is inside a directive string literal
 */
function isInDirectivePosition(
  sourceFile: ts.SourceFile,
  position: number,
  ts: typeof import("typescript")
): ts.StringLiteral | null {
  function findNode(node: ts.Node): ts.StringLiteral | null {
    if (position >= node.getStart() && position <= node.getEnd()) {
      // Check if this is a string literal that could be a directive
      if (ts.isStringLiteral(node)) {
        const parent = node.parent;

        // Check if it's the first statement in a block or source file
        if (ts.isExpressionStatement(parent)) {
          const grandParent = parent.parent;

          // Module-level directive
          if (ts.isSourceFile(grandParent)) {
            const firstStatement = grandParent.statements[0];
            if (firstStatement === parent) {
              return node;
            }
          }

          // Function-level directive
          if (ts.isBlock(grandParent)) {
            const firstStatement = grandParent.statements[0];
            if (firstStatement === parent) {
              return node;
            }
          }
        }
      }

      return ts.forEachChild(node, findNode) || null;
    }
    return null;
  }

  return findNode(sourceFile);
}

/**
 * Provide completions for directive strings
 */
export function getCompletionsAtPosition(
  fileName: string,
  position: number,
  languageService: ts.LanguageService,
  ts: typeof import("typescript"),
  prior: (
    fileName: string,
    position: number,
    options: ts.GetCompletionsAtPositionOptions | undefined
  ) => ts.WithMetadata<ts.CompletionInfo> | undefined
): ts.WithMetadata<ts.CompletionInfo> | undefined {
  const program = languageService.getProgram();
  if (!program) {
    console.log("[Completions] No program");
    return prior(fileName, position, undefined);
  }

  const sourceFile = program.getSourceFile(fileName);
  if (!sourceFile) {
    console.log("[Completions] No source file");
    return prior(fileName, position, undefined);
  }

  // Check if we're in a directive string
  const directiveString = isInDirectivePosition(sourceFile, position, ts);
  console.log(
    "[Completions] isInDirectivePosition:",
    !!directiveString,
    "at position",
    position
  );
  if (!directiveString) {
    return prior(fileName, position, undefined);
  }

  const text = directiveString.text;
  const cursorOffset = position - directiveString.getStart() - 1; // -1 for opening quote
  const textBeforeCursor = text.substring(0, cursorOffset);
  console.log("[Completions] Text before cursor:", textBeforeCursor);

  // Get valid directives from the type system
  const validDirectives = getValidDirectives(program, sourceFile, ts);
  console.log("[Completions] Valid directives:", validDirectives);

  if (validDirectives.length === 0) {
    console.log("[Completions] No valid directives found");
    // Fallback if we can't read the type
    return prior(fileName, position, undefined);
  }

  const entries: ts.CompletionEntry[] = [];

  // Calculate the replacement span - we want to replace the entire string content
  // (everything between the quotes)
  const stringStart = directiveString.getStart() + 1; // +1 to skip opening quote
  const stringEnd = directiveString.getEnd() - 1; // -1 to skip closing quote
  const replacementSpan: ts.TextSpan = {
    start: stringStart,
    length: stringEnd - stringStart,
  };

  console.log(
    "[Completions] Replacement span:",
    replacementSpan,
    "for text:",
    text
  );

  // Filter directives that match what the user is typing
  for (const directive of validDirectives) {
    if (directive.startsWith(textBeforeCursor) || textBeforeCursor === "") {
      entries.push({
        name: directive,
        kind: ts.ScriptElementKind.string,
        kindModifiers: "",
        sortText: "0",
        replacementSpan, // This tells TS to replace the entire string content
      });
    }
  }

  console.log("[Completions] Entries:", entries.length);

  if (entries.length > 0) {
    return {
      entries,
      isGlobalCompletion: false,
      isMemberCompletion: false,
      isNewIdentifierLocation: false,
    };
  }

  return prior(fileName, position, undefined);
}

/**
 * Get completion entry details
 */
export function getCompletionEntryDetails(
  fileName: string,
  position: number,
  entryName: string,
  ts: typeof import("typescript"),
  prior: (
    fileName: string,
    position: number,
    entryName: string,
    formatOptions: ts.FormatCodeOptions | ts.FormatCodeSettings | undefined,
    source: string | undefined,
    preferences: ts.UserPreferences | undefined,
    data: ts.CompletionEntryData | undefined
  ) => ts.CompletionEntryDetails | undefined
): ts.CompletionEntryDetails | undefined {
  // Check if this is a directive completion (starts with "use ")
  if (entryName.startsWith("use ")) {
    return {
      name: entryName,
      kind: ts.ScriptElementKind.string,
      kindModifiers: "",
      displayParts: [
        { text: '"', kind: "punctuation" },
        { text: entryName, kind: "text" },
        { text: '"', kind: "punctuation" },
      ],
      documentation: [{ text: `Directive: ${entryName}`, kind: "text" }],
    };
  }

  return prior(
    fileName,
    position,
    entryName,
    undefined,
    undefined,
    undefined,
    undefined
  );
}
