/**
 * Hover (QuickInfo) implementation for directive annotations
 */

import type ts from "typescript";
import {
  getDirectiveOfNode,
  matchDirective,
  scanFileDirectives,
} from "./ast.js";
import {
  getCachedDirectives,
  getExportDirective,
  setCachedDirectives,
} from "./cache.js";

/**
 * Get enhanced quick info with directive annotations
 */
export function getQuickInfoAtPosition(
  fileName: string,
  position: number,
  languageService: ts.LanguageService,
  ts: typeof import("typescript"),
  prior: (fileName: string, position: number) => ts.QuickInfo | undefined
): ts.QuickInfo | undefined {
  const program = languageService.getProgram();
  if (!program) {
    return prior(fileName, position);
  }

  const sourceFile = program.getSourceFile(fileName);
  if (!sourceFile) {
    return prior(fileName, position);
  }

  // Get the node at position
  const node = getNodeAtPosition(sourceFile, position, ts);
  if (!node) {
    return prior(fileName, position);
  }

  // Check if we're hovering over a directive string itself
  // This needs to be checked BEFORE getting quickInfo because
  // string literals don't always have quickInfo
  const directiveString = getDirectiveString(node, program, ts);
  if (directiveString) {
    return createDirectiveQuickInfo(directiveString, node, program, ts);
  }

  // Get the original quick info
  const quickInfo = prior(fileName, position);

  if (!quickInfo) {
    return undefined;
  }

  // Check if we're hovering over a declaration
  const declarationDirective = getDeclarationDirective(
    sourceFile,
    node,
    program,
    ts
  );
  if (declarationDirective) {
    return enhanceQuickInfo(
      quickInfo,
      declarationDirective.directive,
      declarationDirective.isModuleLevel ? "module" : "inline",
      node,
      ts,
      program
    );
  }

  // Check if we're hovering over a function with an inline directive (not exported)
  const inlineDirective = getInlineFunctionDirective(node, program, ts);
  if (inlineDirective) {
    return enhanceQuickInfo(
      quickInfo,
      inlineDirective,
      "inline",
      node,
      ts,
      program
    );
  }

  // Check if we're hovering over an import
  const importDirective = getImportDirective(node, program, ts);
  if (importDirective) {
    return enhanceQuickInfo(
      quickInfo,
      importDirective.directive,
      importDirective.isModuleLevel ? "module" : "inline",
      node,
      ts,
      program,
      importDirective.symbolName
    );
  }

  // Check if we're hovering over a function reference (e.g., in JSX attributes or call expressions)
  const referenceDirective = getFunctionReferenceDirective(
    node,
    sourceFile,
    program,
    ts
  );
  if (referenceDirective) {
    return enhanceQuickInfo(
      quickInfo,
      referenceDirective.directive,
      referenceDirective.isModuleLevel ? "module" : "inline",
      node,
      ts,
      program
    );
  }

  return quickInfo;
}

/**
 * Get the node at a specific position
 */
function getNodeAtPosition(
  sourceFile: ts.SourceFile,
  position: number,
  ts: typeof import("typescript")
): ts.Node | undefined {
  function find(node: ts.Node): ts.Node | undefined {
    if (position >= node.getStart() && position < node.getEnd()) {
      return ts.forEachChild(node, find) || node;
    }
  }
  return find(sourceFile);
}

/**
 * Check if the node is a directive string literal
 */
function getDirectiveString(
  node: ts.Node,
  program: ts.Program,
  ts: typeof import("typescript")
): string | null {
  // Check if we're on a string literal
  if (!ts.isStringLiteral(node)) {
    return null;
  }

  const text = node.text;

  // Get valid directives from the registry
  const validDirectives = getValidDirectivesFromRegistry(program, ts);

  // Use matchDirective to check if this is a valid directive
  const matchedDirective = matchDirective(text, validDirectives);

  return matchedDirective;
}

/**
 * Create QuickInfo for a directive string
 */
function createDirectiveQuickInfo(
  directive: string,
  node: ts.Node,
  program: ts.Program,
  ts: typeof import("typescript")
): ts.QuickInfo {
  const start = node.getStart();
  const length = node.getWidth();

  // Try to get custom documentation from DirectiveRegistry
  const customDoc = getDirectiveDocumentation(directive, program, ts);

  // Create documentation text
  const docText = customDoc || `The "${directive}" directive.`;

  return {
    kind: ts.ScriptElementKind.string,
    kindModifiers: "",
    textSpan: {
      start,
      length,
    },
    displayParts: [
      { text: `"${directive}"`, kind: "stringLiteral" },
      { text: ";", kind: "punctuation" },
    ],
    documentation: [{ text: docText, kind: "text" }],
  };
}

/**
 * Get directive for an inline (non-exported) function
 */
function getInlineFunctionDirective(
  node: ts.Node,
  program: ts.Program,
  ts: typeof import("typescript")
): string | null {
  if (!ts.isIdentifier(node)) {
    return null;
  }

  // Get valid directives from type system
  const validDirectives = getValidDirectivesFromRegistry(program, ts);

  // Find the parent function declaration/expression
  const parent = node.parent;

  // Check if this is a function name identifier
  if (ts.isFunctionDeclaration(parent) && parent.name === node) {
    return getDirectiveOfNode(parent, validDirectives, ts);
  }

  // Check if this is a variable declaration with a function expression
  if (
    ts.isVariableDeclaration(parent) &&
    parent.name === node &&
    parent.initializer
  ) {
    return getDirectiveOfNode(parent.initializer, validDirectives, ts);
  }

  return null;
}

/**
 * Get all valid directive strings from DirectiveRegistry keys.
 */
function getValidDirectivesFromRegistry(
  program: ts.Program,
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
    // Return empty array if we can't read the type
  }

  return directives;
}

/**
 * Get JSDoc comment for a directive from DirectiveRegistry
 */
function getDirectiveDocumentation(
  directive: string,
  program: ts.Program,
  ts: typeof import("typescript")
): string | null {
  const typeChecker = program.getTypeChecker();

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
      return null;
    }

    const registryType = typeChecker.getDeclaredTypeOfSymbol(registrySymbol);
    if (!registryType) {
      return null;
    }

    // Get the property for this directive
    const property = typeChecker.getPropertyOfType(registryType, directive);
    if (!property) {
      return null;
    }

    // Get JSDoc comment from the property
    const docComment = property.getDocumentationComment(typeChecker);
    if (docComment && docComment.length > 0) {
      return docComment.map((part) => part.text).join("");
    }
  } catch (_error) {
    // Return null if we can't read the documentation
  }

  return null;
}

/**
 * Get context-specific JSDoc tag from DirectiveRegistry
 * @param directive - The directive name (e.g., "use server")
 * @param tag - The JSDoc tag to retrieve (e.g., "module" or "inline")
 */
function getDirectiveDocumentationTag(
  directive: string,
  tag: "module" | "inline",
  program: ts.Program,
  ts: typeof import("typescript")
): string | null {
  const typeChecker = program.getTypeChecker();

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
      return null;
    }

    const registryType = typeChecker.getDeclaredTypeOfSymbol(registrySymbol);
    if (!registryType) {
      return null;
    }

    // Get the property for this directive
    const property = typeChecker.getPropertyOfType(registryType, directive);
    if (!property) {
      return null;
    }

    // Get JSDoc tags from the property
    const jsdocTags = property.getJsDocTags(typeChecker);
    if (jsdocTags && jsdocTags.length > 0) {
      for (const jsdocTag of jsdocTags) {
        if (jsdocTag.name === tag && jsdocTag.text) {
          return jsdocTag.text.map((part) => part.text).join("");
        }
      }
    }
  } catch (_error) {
    // Return null if we can't read the tag
  }

  return null;
}

/**
 * Get directive for a declaration
 */
function getDeclarationDirective(
  sourceFile: ts.SourceFile,
  node: ts.Node,
  program: ts.Program,
  ts: typeof import("typescript")
): { directive: string; isModuleLevel: boolean } | null {
  if (!ts.isIdentifier(node)) {
    return null;
  }

  // Get or scan file directives
  let cached = getCachedDirectives(sourceFile);
  if (!cached) {
    const scanned = scanFileDirectives(sourceFile, program, ts);
    setCachedDirectives(
      sourceFile,
      scanned.moduleDirectives,
      scanned.exportDirectives
    );
    cached = scanned;
  }

  // First check if this specific export has a directive (inline)
  const exportDirective = cached.exportDirectives.get(node.text);
  if (exportDirective) {
    return { directive: exportDirective, isModuleLevel: false };
  }

  // If there's a module-level directive and this is an export, use that
  if (cached.moduleDirectives.length > 0) {
    // Check if this identifier is actually exported
    const isExported = isNodeExported(node, ts);
    if (isExported) {
      return { directive: cached.moduleDirectives[0], isModuleLevel: true };
    }
  }

  return null;
}

/**
 * Check if a node is exported
 */
function isNodeExported(
  node: ts.Node,
  ts: typeof import("typescript")
): boolean {
  let current = node;

  while (current) {
    // Check for export keyword on declarations
    if (
      ts.isFunctionDeclaration(current) ||
      ts.isVariableStatement(current) ||
      ts.isClassDeclaration(current)
    ) {
      const hasExport = current.modifiers?.some(
        (mod) => mod.kind === ts.SyntaxKind.ExportKeyword
      );
      if (hasExport) return true;
    }

    // Check if parent is a variable declaration in an exported statement
    if (ts.isVariableDeclaration(current)) {
      const statement = current.parent?.parent;
      if (statement && ts.isVariableStatement(statement)) {
        const hasExport = statement.modifiers?.some(
          (mod) => mod.kind === ts.SyntaxKind.ExportKeyword
        );
        if (hasExport) return true;
      }
    }

    current = current.parent;
  }

  return false;
}

/**
 * Get directive for an imported symbol
 */
function getImportDirective(
  node: ts.Node,
  program: ts.Program,
  ts: typeof import("typescript")
): { directive: string; symbolName: string; isModuleLevel: boolean } | null {
  if (!ts.isIdentifier(node)) {
    return null;
  }

  const typeChecker = program.getTypeChecker();
  const symbol = typeChecker.getSymbolAtLocation(node);

  if (!symbol) {
    return null;
  }

  // Check if this is an imported symbol
  const declarations = symbol.declarations;
  if (!declarations || declarations.length === 0) {
    return null;
  }

  for (const declaration of declarations) {
    // Check for import specifier (named imports)
    if (ts.isImportSpecifier(declaration)) {
      const importDecl = declaration.parent.parent.parent;
      if (
        ts.isImportDeclaration(importDecl) &&
        ts.isStringLiteral(importDecl.moduleSpecifier)
      ) {
        const importPath = importDecl.moduleSpecifier.text;
        const sourceFile = declaration.getSourceFile();
        const resolvedModule = resolveModuleName(
          importPath,
          sourceFile.fileName,
          program,
          ts
        );

        if (resolvedModule) {
          const exportedName = (declaration.propertyName || declaration.name)
            .text;

          // Try to get from cache first
          let directive = getExportDirective(resolvedModule, exportedName);

          // If not in cache, scan the file
          if (!directive) {
            const importedSourceFile = program.getSourceFile(resolvedModule);
            if (importedSourceFile) {
              const scanned = scanFileDirectives(
                importedSourceFile,
                program,
                ts
              );
              setCachedDirectives(
                importedSourceFile,
                scanned.moduleDirectives,
                scanned.exportDirectives
              );
              directive = scanned.exportDirectives.get(exportedName) || null;
            }
          }

          if (directive) {
            // Check if the directive is module-level or inline by scanning the imported file
            const importedSourceFile = program.getSourceFile(resolvedModule);
            if (importedSourceFile) {
              const cached = getCachedDirectives(importedSourceFile);
              const scannedDirectives =
                cached || scanFileDirectives(importedSourceFile, program, ts);

              // Check if this specific export has an inline directive
              const hasInlineDirective =
                scannedDirectives.exportDirectives.has(exportedName);

              return {
                directive,
                symbolName: exportedName,
                isModuleLevel: !hasInlineDirective,
              };
            }

            // Fallback: assume inline if we can't determine
            return {
              directive,
              symbolName: exportedName,
              isModuleLevel: false,
            };
          }
        }
      }
    }

    // Check for import clause (default imports)
    // The identifier for a default import has the ImportClause as its declaration
    if (ts.isImportClause(declaration)) {
      // Only handle if this is a default import (has a name)
      if (!declaration.name) {
        continue;
      }

      const importDecl = declaration.parent;
      if (
        ts.isImportDeclaration(importDecl) &&
        ts.isStringLiteral(importDecl.moduleSpecifier)
      ) {
        const importPath = importDecl.moduleSpecifier.text;
        const sourceFile = declaration.getSourceFile();
        const resolvedModule = resolveModuleName(
          importPath,
          sourceFile.fileName,
          program,
          ts
        );

        if (resolvedModule) {
          // Try to get from cache first
          let directive = getExportDirective(resolvedModule, "default");

          // If not in cache, scan the file
          if (!directive) {
            const importedSourceFile = program.getSourceFile(resolvedModule);
            if (importedSourceFile) {
              const scanned = scanFileDirectives(
                importedSourceFile,
                program,
                ts
              );
              setCachedDirectives(
                importedSourceFile,
                scanned.moduleDirectives,
                scanned.exportDirectives
              );
              directive = scanned.exportDirectives.get("default") || null;
            }
          }

          if (directive) {
            // Check if the directive is module-level or inline by scanning the imported file
            const importedSourceFile = program.getSourceFile(resolvedModule);
            if (importedSourceFile) {
              const cached = getCachedDirectives(importedSourceFile);
              const scannedDirectives =
                cached || scanFileDirectives(importedSourceFile, program, ts);

              // Check if this specific export has an inline directive
              const hasInlineDirective =
                scannedDirectives.exportDirectives.has("default");

              return {
                directive,
                symbolName: "default",
                isModuleLevel: !hasInlineDirective,
              };
            }

            // Fallback: assume inline if we can't determine
            return {
              directive,
              symbolName: "default",
              isModuleLevel: false,
            };
          }
        }
      }
    }
  }

  return null;
}

/**
 * Get directive for a function reference (e.g., in JSX attributes or other contexts)
 */
function getFunctionReferenceDirective(
  node: ts.Node,
  _sourceFile: ts.SourceFile,
  program: ts.Program,
  ts: typeof import("typescript")
): { directive: string; isModuleLevel: boolean } | null {
  if (!ts.isIdentifier(node)) {
    return null;
  }

  const typeChecker = program.getTypeChecker();
  const validDirectives = getValidDirectivesFromRegistry(program, ts);

  // Get the symbol of the referenced identifier
  const symbol = typeChecker.getSymbolAtLocation(node);
  if (!symbol) {
    return null;
  }

  // Get the declarations of the symbol
  const declarations = symbol.declarations;
  if (!declarations || declarations.length === 0) {
    return null;
  }

  // Check each declaration
  for (const declaration of declarations) {
    // Skip if it's an import (already handled by getImportDirective)
    if (ts.isImportSpecifier(declaration) || ts.isImportClause(declaration)) {
      continue;
    }

    // Check for inline directives in function declarations
    if (ts.isFunctionDeclaration(declaration)) {
      const directive = getDirectiveOfNode(declaration, validDirectives, ts);
      if (directive) {
        return { directive, isModuleLevel: false };
      }
    }

    // Check for inline directives in variable declarations (arrow functions)
    if (ts.isVariableDeclaration(declaration) && declaration.initializer) {
      const directive = getDirectiveOfNode(
        declaration.initializer,
        validDirectives,
        ts
      );
      if (directive) {
        return { directive, isModuleLevel: false };
      }
    }

    // Check cache for exported functions
    const declarationFile = declaration.getSourceFile();
    let cached = getCachedDirectives(declarationFile);
    if (!cached) {
      const scanned = scanFileDirectives(declarationFile, program, ts);
      setCachedDirectives(
        declarationFile,
        scanned.moduleDirectives,
        scanned.exportDirectives
      );
      cached = scanned;
    }

    const functionName = node.text;
    const exportDirective = cached.exportDirectives.get(functionName);
    if (exportDirective) {
      // It's in exportDirectives, so it's inline
      return { directive: exportDirective, isModuleLevel: false };
    }

    // Check if there's a module-level directive and this is exported
    if (cached.moduleDirectives.length > 0) {
      // Verify this function is actually exported
      if (isNodeExported(declaration, ts)) {
        return { directive: cached.moduleDirectives[0], isModuleLevel: true };
      }
    }
  }

  return null;
}

/**
 * Resolve module name to file path
 */
function resolveModuleName(
  moduleName: string,
  containingFile: string,
  program: ts.Program,
  ts: typeof import("typescript")
): string | null {
  const resolvedModule = ts.resolveModuleName(
    moduleName,
    containingFile,
    program.getCompilerOptions(),
    ts.sys
  );

  if (resolvedModule.resolvedModule) {
    return resolvedModule.resolvedModule.resolvedFileName;
  }

  return null;
}

/**
 * Enhance quick info with directive annotation
 */
function enhanceQuickInfo(
  quickInfo: ts.QuickInfo,
  directive: string,
  type: "module" | "inline",
  node: ts.Node,
  ts: typeof import("typescript"),
  program: ts.Program,
  _symbolName?: string
): ts.QuickInfo {
  const directiveTag = `"${directive}";`;

  // Add directive tag as the first line in display parts
  const displayParts = [
    { text: directiveTag, kind: "stringLiteral" as const },
    { text: "\n", kind: "lineBreak" as const },
    ...(quickInfo.displayParts || []),
  ];

  // Try to get context-specific documentation from DirectiveRegistry JSDoc tags
  let docText: string | null = null;

  if (type === "module") {
    // For module-level directives, try to get @module tag
    docText = getDirectiveDocumentationTag(directive, "module", program, ts);
  } else if (type === "inline") {
    // For inline directives, try to get @inline tag
    docText = getDirectiveDocumentationTag(directive, "inline", program, ts);
  }

  // If no context-specific doc found, try to get the main documentation
  if (!docText) {
    docText = getDirectiveDocumentation(directive, program, ts);
  }

  // If still no documentation, use fallback
  if (!docText) {
    if (type === "module") {
      docText = `This export is marked with the "${directive}" directive.`;
    } else if (type === "inline") {
      const _name = ts.isIdentifier(node) ? node.text : "function";
      docText = `This function is marked with the "${directive}" directive.`;
    } else {
      docText = `This is marked with the "${directive}" directive.`;
    }
  }

  const documentation = [
    ...(quickInfo.documentation || []),
    { text: "\n\n", kind: "lineBreak" as const },
    { text: docText, kind: "text" as const },
  ];

  return {
    ...quickInfo,
    displayParts,
    documentation,
  };
}
