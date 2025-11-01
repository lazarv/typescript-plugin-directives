/**
 * AST traversal and directive detection logic
 */

import type ts from "typescript";

/**
 * Get all valid directive strings from DirectiveRegistry keys.
 */
function getValidDirectives(
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
 * Check if a directive matches known patterns including options
 */
export function matchDirective(
  text: string,
  validDirectives: string[]
): string | null {
  // Direct match
  if (validDirectives.includes(text)) {
    return text;
  }

  // Match directives with options like "use cache: server" or "use cache; ttl=60"
  for (const directive of validDirectives) {
    if (text.startsWith(directive)) {
      const rest = text.slice(directive.length);
      // Check for valid patterns: "; options" or ": provider" or ": provider; options"
      if (rest === "" || rest.match(/^[\s]*[;:][\s]*.+/)) {
        return directive;
      }
    }
  }

  return null;
}

/**
 * Get the first directive from a block of statements
 */
function getFirstDirective(
  statements: ts.NodeArray<ts.Statement>,
  validDirectives: string[],
  ts: typeof import("typescript")
): string | null {
  if (!statements || statements.length === 0) {
    return null;
  }

  const firstStmt = statements[0];

  if (
    ts.isExpressionStatement(firstStmt) &&
    ts.isStringLiteral(firstStmt.expression)
  ) {
    const text = firstStmt.expression.text;
    return matchDirective(text, validDirectives);
  }

  return null;
}

/**
 * Get top-level directives from a source file
 */
export function getTopLevelDirectives(
  sourceFile: ts.SourceFile,
  program: ts.Program,
  ts: typeof import("typescript")
): string[] {
  const validDirectives = getValidDirectives(program, ts);
  const directives: string[] = [];
  const directive = getFirstDirective(
    sourceFile.statements,
    validDirectives,
    ts
  );

  if (directive) {
    directives.push(directive);
  }

  return directives;
}

/**
 * Get directive from a function or arrow function node
 */
export function getDirectiveOfNode(
  node: ts.Node,
  validDirectives: string[],
  ts: typeof import("typescript")
): string | null {
  // Handle function declarations and expressions
  if (
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isMethodDeclaration(node)
  ) {
    if (node.body && ts.isBlock(node.body)) {
      return getFirstDirective(node.body.statements, validDirectives, ts);
    }
  }

  // Handle arrow functions with block bodies
  if (ts.isArrowFunction(node) && node.body && ts.isBlock(node.body)) {
    return getFirstDirective(node.body.statements, validDirectives, ts);
  }

  return null;
}

/**
 * Scan a source file for all directives
 */
export function scanFileDirectives(
  sourceFile: ts.SourceFile,
  program: ts.Program,
  ts: typeof import("typescript")
): { moduleDirectives: string[]; exportDirectives: Map<string, string> } {
  const validDirectives = getValidDirectives(program, ts);
  const moduleDirectives = getTopLevelDirectives(sourceFile, program, ts);
  const exportDirectives = new Map<string, string>();
  const moduleDirective =
    moduleDirectives.length > 0 ? moduleDirectives[0] : null;

  // First pass: collect directives from all declarations
  const declarationDirectives = new Map<string, string>();

  function collectDeclarationDirectives(node: ts.Node): void {
    // Collect directives from function declarations
    if (ts.isFunctionDeclaration(node) && node.name) {
      const inlineDirective = getDirectiveOfNode(node, validDirectives, ts);
      if (inlineDirective) {
        declarationDirectives.set(node.name.text, inlineDirective);
      } else if (moduleDirective) {
        declarationDirectives.set(node.name.text, moduleDirective);
      }
    }

    // Collect directives from variable declarations
    if (ts.isVariableStatement(node) && node.declarationList) {
      for (const decl of node.declarationList.declarations) {
        if (decl.name && ts.isIdentifier(decl.name) && decl.initializer) {
          const inlineDirective = getDirectiveOfNode(
            decl.initializer,
            validDirectives,
            ts
          );
          if (inlineDirective) {
            declarationDirectives.set(decl.name.text, inlineDirective);
          } else if (moduleDirective) {
            declarationDirectives.set(decl.name.text, moduleDirective);
          }
        }
      }
    }

    ts.forEachChild(node, collectDeclarationDirectives);
  }

  collectDeclarationDirectives(sourceFile);

  /**
   * Second pass: Visit each node to find exported functions with directives
   */
  function visit(node: ts.Node): void {
    // Check for exported function declarations
    if (ts.isFunctionDeclaration(node) && node.name) {
      const isExported = node.modifiers?.some(
        (mod) => mod.kind === ts.SyntaxKind.ExportKeyword
      );
      const isDefault = node.modifiers?.some(
        (mod) => mod.kind === ts.SyntaxKind.DefaultKeyword
      );

      if (isExported) {
        const directive = declarationDirectives.get(node.name.text);
        if (directive) {
          exportDirectives.set(node.name.text, directive);
          // If this is also a default export, store under "default" key
          if (isDefault) {
            exportDirectives.set("default", directive);
          }
        }
      }
    }

    // Check for variable declarations that might be exported arrow functions
    if (ts.isVariableStatement(node)) {
      const isExported = node.modifiers?.some(
        (mod) => mod.kind === ts.SyntaxKind.ExportKeyword
      );

      if (isExported && node.declarationList) {
        for (const decl of node.declarationList.declarations) {
          if (decl.name && ts.isIdentifier(decl.name)) {
            const directive = declarationDirectives.get(decl.name.text);
            if (directive) {
              exportDirectives.set(decl.name.text, directive);
            }
          }
        }
      }
    }

    // Check for export assignments (export default expression)
    if (ts.isExportAssignment(node) && !node.isExportEquals) {
      // This is an "export default" statement
      const exportedNode = node.expression;

      // Check for inline directive in the exported expression
      const inlineDirective = getDirectiveOfNode(
        exportedNode,
        validDirectives,
        ts
      );
      if (inlineDirective) {
        exportDirectives.set("default", inlineDirective);
      } else if (moduleDirective) {
        // Use module-level directive if no inline directive
        exportDirectives.set("default", moduleDirective);
      }
    }

    // Check for named exports (export { Button as default })
    if (ts.isExportDeclaration(node) && node.exportClause) {
      if (ts.isNamedExports(node.exportClause)) {
        for (const element of node.exportClause.elements) {
          const exportedName = element.name.text;
          const localName = element.propertyName
            ? element.propertyName.text
            : element.name.text;

          // Look up the directive from our collected declarations
          const directive = declarationDirectives.get(localName);

          if (directive) {
            exportDirectives.set(exportedName, directive);
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return { moduleDirectives, exportDirectives };
}
