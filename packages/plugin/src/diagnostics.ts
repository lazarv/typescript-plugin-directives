/**
 * Diagnostics for invalid directive strings
 */

import type ts from "typescript";
import { matchDirective } from "./ast.js";

/**
 * Calculate Levenshtein distance between two strings
 */
export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Get all valid directive strings by expanding the Directive union type
 */
function getAllDirectiveVariations(
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
          directives.push(memberType.value);
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
    // Silently fail
  }

  return directives;
}

/**
 * Find the closest matching directives
 */
function findClosestDirectives(
  input: string,
  validDirectives: string[],
  maxSuggestions: number = 3
): string[] {
  // Calculate distance for each directive
  const distances = validDirectives.map((directive) => ({
    directive,
    distance: levenshteinDistance(input, directive),
  }));

  // Sort by distance (closest first)
  distances.sort((a, b) => a.distance - b.distance);

  // Only suggest directives that are reasonably close
  // Use a threshold based on the input length:
  // - For short inputs (< 10 chars): max 2 edits
  // - For medium inputs (10-20 chars): max 3 edits
  // - For longer inputs: max 20% of the length
  const maxDistance = Math.max(2, Math.min(3, Math.ceil(input.length * 0.2)));

  // Filter by maximum distance and take top suggestions
  const closeSuggestions = distances
    .filter((d) => d.distance <= maxDistance)
    .slice(0, maxSuggestions)
    .map((d) => d.directive);

  return closeSuggestions;
}

/**
 * Format a list of suggestions with proper grammar (using "or" for the last item)
 */
export function formatSuggestionList(suggestions: string[]): string {
  if (suggestions.length === 0) return "";
  if (suggestions.length === 1) return `'${suggestions[0]}'`;
  if (suggestions.length === 2)
    return `'${suggestions[0]}' or '${suggestions[1]}'`;

  const quoted = suggestions.map((s) => `'${s}'`);
  const lastItem = quoted.pop();
  return `${quoted.join(", ")}, or ${lastItem}`;
}

/**
 * Format a list of directives with proper grammar (using "and" for the last item)
 */
export function formatDirectiveList(directives: string[]): string {
  if (directives.length === 0) return "";
  if (directives.length === 1) return `'${directives[0]}'`;
  if (directives.length === 2)
    return `'${directives[0]}' and '${directives[1]}'`;

  const quoted = directives.map((s) => `'${s}'`);
  const lastItem = quoted.pop();
  return `${quoted.join(", ")}, and ${lastItem}`;
}

/**
 * Get all valid directive strings from DirectiveRegistry keys.
 * NOTE: This only gets the base directive keys (like "use server", "use client", "use cache").
 * For "use cache", additional variations with providers/options would need separate handling.
 */
function getValidDirectives(
  program: ts.Program,
  _sourceFile: ts.SourceFile,
  ts: typeof import("typescript")
): string[] {
  const typeChecker = program.getTypeChecker();
  const directives: string[] = [];

  try {
    // Look for DirectiveRegistry interface in all source files
    let registrySymbol: ts.Symbol | undefined;

    for (const file of program.getSourceFiles()) {
      // Skip node_modules except our own global.d.ts
      if (
        file.fileName.includes("node_modules") &&
        !file.fileName.includes("typescript-plugin-directives")
      ) {
        continue;
      }

      // Try to get the DirectiveRegistry interface from this file
      const symbol = typeChecker.resolveName(
        "DirectiveRegistry",
        file as any,
        ts.SymbolFlags.Interface,
        false
      );

      if (symbol) {
        registrySymbol = symbol;
        break;
      }
    }

    if (!registrySymbol) {
      return directives;
    }

    const registryType = typeChecker.getDeclaredTypeOfSymbol(registrySymbol);
    if (!registryType) {
      return directives;
    }

    // Get all properties (keys) from the interface
    const properties = typeChecker.getPropertiesOfType(registryType);

    for (const prop of properties) {
      const propName = prop.getName();
      directives.push(propName);
    }
  } catch (_error) {
    // Silently fail - diagnostics just won't work
  }

  return directives;
}

/**
 * Get semantic diagnostics for invalid directives
 */
export function getSemanticDiagnostics(
  fileName: string,
  languageService: ts.LanguageService,
  ts: typeof import("typescript"),
  prior: (fileName: string) => ts.Diagnostic[]
): ts.Diagnostic[] {
  const originalDiagnostics = prior(fileName);

  const program = languageService.getProgram();
  if (!program) {
    return originalDiagnostics;
  }

  const sourceFile = program.getSourceFile(fileName);
  if (!sourceFile) {
    return originalDiagnostics;
  }

  // Get valid directives from the type system
  const validDirectives = getValidDirectives(program, sourceFile, ts);

  if (validDirectives.length === 0) {
    // Can't validate if we can't read the type
    return originalDiagnostics;
  }

  const diagnostics: ts.Diagnostic[] = [...originalDiagnostics];
  const typeChecker = program.getTypeChecker();

  // Get all directive variations for suggestions
  const allDirectiveVariations = getAllDirectiveVariations(
    program,
    sourceFile,
    ts
  );

  // Try to get the Directive type once for all validations
  let directiveType: ts.Type | undefined;
  try {
    const directiveSymbol = typeChecker.resolveName(
      "Directive",
      sourceFile as any,
      ts.SymbolFlags.Type,
      false
    );

    if (directiveSymbol) {
      directiveType = typeChecker.getDeclaredTypeOfSymbol(directiveSymbol);
    }
  } catch (_error) {
    // If we can't get the Directive type, fall back to basic validation
  }

  /**
   * Check if the base directive type is valid
   * Extracts the directive type from formats:
   * - "use <type>"
   * - "use <type>: <provider>"
   * - "use <type>: <provider>; <options>"
   * - "use <type>; <options>"
   */
  function isValidDirectiveType(text: string): boolean {
    // Extract the base directive type (everything before ":" or ";" or end of string)
    const match = text.match(/^use\s+([^:;]+)/);
    if (!match) return false;

    const baseDirective = match[0].trim(); // e.g., "use cache", "use server"

    // Check if this base directive exists in validDirectives
    const isValid = validDirectives.includes(baseDirective);
    return isValid;
  }

  /**
   * Check if a directive supports options/providers by looking at DirectiveRegistry
   * Returns true if the directive type in the registry is NOT 'never'
   */
  function directiveSupportsOptions(baseDirective: string): boolean {
    if (!program) return false;

    try {
      // Look for DirectiveRegistry interface
      let registrySymbol: ts.Symbol | undefined;

      for (const file of program.getSourceFiles()) {
        if (
          file.fileName.includes("node_modules") &&
          !file.fileName.includes("typescript-plugin-directives")
        ) {
          continue;
        }

        const symbol = typeChecker.resolveName(
          "DirectiveRegistry",
          file as any,
          ts.SymbolFlags.Interface,
          false
        );

        if (symbol) {
          registrySymbol = symbol;
          break;
        }
      }

      if (!registrySymbol) return false;

      const registryType = typeChecker.getDeclaredTypeOfSymbol(registrySymbol);
      if (!registryType) return false;

      // Get the property for this directive
      const property = registryType.getProperty(baseDirective);
      if (!property) return false;

      // Get the type of the property
      if (!sourceFile) return false;
      const propertyType = typeChecker.getTypeOfSymbolAtLocation(
        property,
        sourceFile
      );

      // Check if it's the 'never' type
      const isNever = (propertyType.flags & ts.TypeFlags.Never) !== 0;

      return !isNever;
    } catch (_error) {
      return false;
    }
  }

  /**
   * Check if a directive is in the correct position (first statement or consecutive with other directives)
   */
  function checkDirectivePosition(
    node: ts.StringLiteral,
    parentStatement: ts.ExpressionStatement
  ): void {
    const text = node.text;

    // Only check strings that start with "use "
    if (!text.startsWith("use ")) {
      return;
    }

    const parent = parentStatement.parent;

    // Check if this is a module-level or function-level directive
    if (ts.isSourceFile(parent) || ts.isBlock(parent)) {
      const statements = parent.statements;
      const statementIndex = statements.indexOf(parentStatement);

      // Allow consecutive directives at the start
      // Check if all statements before this one are also directives
      let allPreviousAreDirectives = true;
      for (let i = 0; i < statementIndex; i++) {
        const stmt = statements[i];
        if (
          !ts.isExpressionStatement(stmt) ||
          !ts.isStringLiteral(stmt.expression) ||
          !stmt.expression.text.startsWith("use ")
        ) {
          allPreviousAreDirectives = false;
          break;
        }
      }

      if (!allPreviousAreDirectives) {
        // For module-level directives (in source file)
        if (ts.isSourceFile(parent)) {
          diagnostics.push({
            file: sourceFile,
            start: node.getStart() + 1, // +1 to skip opening quote
            length: node.text.length,
            messageText: `Directive "${text}" must be at the beginning of the module body`,
            category: ts.DiagnosticCategory.Error,
            code: 99002, // TS-DIRECTIVE-002
          });
        }
        // For function-level directives (in block)
        else if (ts.isBlock(parent)) {
          diagnostics.push({
            file: sourceFile,
            start: node.getStart() + 1, // +1 to skip opening quote
            length: node.text.length,
            messageText: `Directive "${text}" must be at the beginning of the function body`,
            category: ts.DiagnosticCategory.Error,
            code: 99002, // TS-DIRECTIVE-002
          });
        }
      }
    }
  }

  /**
   * Check for invalid directives by validating against the Directive type
   */
  function checkDirective(node: ts.StringLiteral): void {
    const text = node.text;

    // Only check strings that start with "use "
    if (!text.startsWith("use ")) {
      return;
    }

    if (directiveType) {
      // Get the type of the string literal
      const literalType = typeChecker.getTypeAtLocation(node);

      // Check if the literal type is assignable to the Directive type
      const isAssignable = typeChecker.isTypeAssignableTo(
        literalType,
        directiveType
      );

      if (!isAssignable) {
        // Check if the base directive type is valid
        const hasValidType = isValidDirectiveType(text);

        let diagnosticMessage: string;

        if (!hasValidType) {
          // The directive type itself is unknown - suggest base directive types
          // Extract just the base part for better suggestions
          const match = text.match(/^use\s+([^:;]+)/);
          const baseText = match ? match[0].trim() : text;

          const suggestions = findClosestDirectives(baseText, validDirectives);

          if (suggestions.length > 0) {
            diagnosticMessage = `Unknown directive '${text}'. Did you mean ${formatSuggestionList(
              suggestions
            )}?`;
          } else if (validDirectives.length > 0) {
            const sortedDirectives = validDirectives.sort();
            const formattedList = formatDirectiveList(sortedDirectives);
            diagnosticMessage = `Unknown directive '${text}'. Available directives are ${formattedList}.`;
          } else {
            diagnosticMessage = `Unknown directive '${text}'.`;
          }
        } else {
          // The directive type is valid but the provider/options are incorrect
          // Check if the directive has options/providers or if it's being used incorrectly
          const match = text.match(/^use\s+([^:;]+)/);
          const baseDirective = match ? match[0].trim() : "";
          const hasOptionsOrProvider = text.includes(":") || text.includes(";");

          if (hasOptionsOrProvider && baseDirective) {
            const supportsOptions = directiveSupportsOptions(baseDirective);

            if (!supportsOptions) {
              // Directive doesn't support options/providers
              diagnosticMessage = `Directive '${baseDirective}' does not support options or providers. Use it as '${baseDirective}'.`;
            } else {
              // Directive supports options but the provided ones are invalid
              const suggestions =
                allDirectiveVariations.length > 0
                  ? findClosestDirectives(text, allDirectiveVariations)
                  : [];

              if (suggestions.length > 0) {
                diagnosticMessage = `Invalid provider or options for directive '${baseDirective}'. Did you mean ${formatSuggestionList(
                  suggestions
                )}?`;
              } else {
                diagnosticMessage = `Invalid provider or options for directive '${baseDirective}'.`;
              }
            }
          } else {
            // No options/providers provided but still invalid - shouldn't happen
            const suggestions =
              allDirectiveVariations.length > 0
                ? findClosestDirectives(text, allDirectiveVariations)
                : [];

            if (suggestions.length > 0) {
              diagnosticMessage = `Type '${text}' is not assignable to type 'Directive'. Did you mean ${formatSuggestionList(
                suggestions
              )}?`;
            } else {
              diagnosticMessage = `Type '${text}' is not assignable to type 'Directive'.`;
            }
          }
        }

        diagnostics.push({
          file: sourceFile,
          start: node.getStart() + 1, // +1 to skip opening quote
          length: node.text.length,
          messageText: diagnosticMessage,
          category: ts.DiagnosticCategory.Error,
          code: 99001,
        });
      }
    } else {
      // Fallback: basic validation using matchDirective
      const matchedDirective = matchDirective(text, validDirectives);
      if (!matchedDirective) {
        // Find closest matching directives
        const suggestions = findClosestDirectives(text, validDirectives);

        let diagnosticMessage: string;

        if (suggestions.length > 0) {
          if (suggestions.length === 1) {
            diagnosticMessage = `Unknown directive '${text}'. Did you mean ${formatSuggestionList(
              suggestions
            )}?`;
          } else {
            diagnosticMessage = `Unknown directive '${text}'. Did you mean ${formatSuggestionList(
              suggestions
            )}?`;
          }
        } else {
          const sortedDirectives = validDirectives.sort();
          const formattedList = formatDirectiveList(sortedDirectives);
          diagnosticMessage = `Unknown directive '${text}'. Available directives are ${formattedList}.`;
        }

        diagnostics.push({
          file: sourceFile,
          start: node.getStart() + 1, // +1 to skip opening quote
          length: node.text.length,
          messageText: diagnosticMessage,
          category: ts.DiagnosticCategory.Error,
          code: 99001,
        });
      }
    }
  }

  /**
   * Visit nodes to find directive candidates
   */
  function visit(node: ts.Node): void {
    // Check expression statements with string literals
    if (ts.isExpressionStatement(node) && ts.isStringLiteral(node.expression)) {
      const parent = node.parent;

      // Module-level or function-level directive
      if (ts.isSourceFile(parent) || ts.isBlock(parent)) {
        // Check if directive is in correct position
        checkDirectivePosition(node.expression, node);

        // Validate the directive content
        checkDirective(node.expression);
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return diagnostics;
}
