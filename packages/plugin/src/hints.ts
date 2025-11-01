/**
 * Inlay hints implementation for directive annotations
 */

import type ts from "typescript";
import { getDirectiveOfNode, scanFileDirectives } from "./ast.js";
import {
  getCachedDirectives,
  getExportDirective,
  setCachedDirectives,
} from "./cache.js";

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
 * Provide inlay hints for directives
 */
export function provideInlayHints(
  fileName: string,
  span: ts.TextSpan,
  languageService: ts.LanguageService,
  ts: typeof import("typescript")
): ts.InlayHint[] {
  const program = languageService.getProgram();
  if (!program) {
    return [];
  }

  const sourceFile = program.getSourceFile(fileName);
  if (!sourceFile) {
    return [];
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

  const hints: ts.InlayHint[] = [];

  // Add hints for exported declarations with directives (including module-level)
  addDeclarationHints(sourceFile, cached, span, hints, ts);

  // Add hints for inline function directives
  addInlineFunctionHints(sourceFile, program, span, hints, ts);

  // Add hints for imports
  addImportHints(sourceFile, program, span, hints, ts);

  // Add hints for call expressions
  addCallExpressionHints(sourceFile, program, span, hints, ts);

  // Add hints for JSX elements
  addJsxElementHints(sourceFile, program, span, hints, ts);

  // Add hints for JSX attributes (e.g., action={serverFunction})
  addJsxAttributeHints(sourceFile, program, span, hints, ts);

  return hints;
}

/**
 * Add inlay hints for declarations
 */
function addDeclarationHints(
  sourceFile: ts.SourceFile,
  cached: { moduleDirectives: string[]; exportDirectives: Map<string, string> },
  span: ts.TextSpan,
  hints: ts.InlayHint[],
  ts: typeof import("typescript")
): void {
  const hasModuleDirective = cached.moduleDirectives.length > 0;
  const moduleDirective = hasModuleDirective
    ? cached.moduleDirectives[0]
    : null;

  function visit(node: ts.Node): void {
    // Check function declarations
    if (ts.isFunctionDeclaration(node) && node.name) {
      // First check for explicit export directive
      let directive = cached.exportDirectives.get(node.name.text);

      // If no explicit directive but module has directive and function is exported
      if (!directive && moduleDirective) {
        const isExported = node.modifiers?.some(
          (mod) => mod.kind === ts.SyntaxKind.ExportKeyword
        );
        if (isExported) {
          directive = moduleDirective;
        }
      }

      if (directive) {
        const position = node.name.getEnd();
        if (position >= span.start && position <= span.start + span.length) {
          hints.push(createInlayHint(position, directive, ts));
        }
      }
    }

    // Check variable declarations (for arrow functions)
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      // First check for explicit export directive
      let directive = cached.exportDirectives.get(node.name.text);

      // If no explicit directive but module has directive and variable is exported
      if (!directive && moduleDirective) {
        const statement = node.parent?.parent;
        if (statement && ts.isVariableStatement(statement)) {
          const isExported = statement.modifiers?.some(
            (mod) => mod.kind === ts.SyntaxKind.ExportKeyword
          );
          if (isExported) {
            directive = moduleDirective;
          }
        }
      }

      if (directive) {
        const position = node.name.getEnd();
        if (position >= span.start && position <= span.start + span.length) {
          hints.push(createInlayHint(position, directive, ts));
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

/**
 * Add inlay hints for inline function directives
 */
function addInlineFunctionHints(
  sourceFile: ts.SourceFile,
  program: ts.Program,
  span: ts.TextSpan,
  hints: ts.InlayHint[],
  ts: typeof import("typescript")
): void {
  // Get valid directives from type system
  const validDirectives = getValidDirectivesFromRegistry(program, ts);

  function visit(node: ts.Node): void {
    // Check function declarations (non-exported)
    if (ts.isFunctionDeclaration(node) && node.name) {
      const isExported = node.modifiers?.some(
        (mod) => mod.kind === ts.SyntaxKind.ExportKeyword
      );

      // Only add hints for non-exported functions with inline directives
      if (!isExported) {
        const directive = getDirectiveOfNode(node, validDirectives, ts);
        if (directive) {
          const position = node.name.getEnd();
          if (position >= span.start && position <= span.start + span.length) {
            hints.push(createInlayHint(position, directive, ts));
          }
        }
      }
    }

    // Check variable declarations with function expressions
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer
    ) {
      const statement = node.parent?.parent;
      const isExported =
        statement &&
        ts.isVariableStatement(statement) &&
        statement.modifiers?.some(
          (mod) => mod.kind === ts.SyntaxKind.ExportKeyword
        );

      // Only add hints for non-exported functions with inline directives
      if (!isExported) {
        const directive = getDirectiveOfNode(
          node.initializer,
          validDirectives,
          ts
        );
        if (directive) {
          const position = node.name.getEnd();
          if (position >= span.start && position <= span.start + span.length) {
            hints.push(createInlayHint(position, directive, ts));
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

/**
 * Add inlay hints for imports
 *
 * Note: This function is difficult to unit test because it uses ts.resolveModuleName(),
 * which bypasses the LanguageServiceHost and directly accesses the filesystem via ts.sys.
 * Virtual test files don't exist on disk, so module resolution always fails in unit tests.
 * The import hint generation logic (lines 299-327) requires integration tests with real
 * files or complex ts.sys mocking to achieve full coverage.
 */
function addImportHints(
  sourceFile: ts.SourceFile,
  program: ts.Program,
  span: ts.TextSpan,
  hints: ts.InlayHint[],
  ts: typeof import("typescript")
): void {
  function visit(node: ts.Node): void {
    if (ts.isImportDeclaration(node) && node.importClause) {
      const moduleSpecifier = node.moduleSpecifier;
      if (!ts.isStringLiteral(moduleSpecifier)) {
        return;
      }

      const importPath = moduleSpecifier.text;

      const resolvedModule = resolveModuleName(
        importPath,
        sourceFile.fileName,
        program,
        ts
      );

      if (!resolvedModule) {
        return;
      }

      // Handle named imports
      if (
        node.importClause.namedBindings &&
        ts.isNamedImports(node.importClause.namedBindings)
      ) {
        for (const element of node.importClause.namedBindings.elements) {
          const exportedName = (element.propertyName || element.name).text;
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
            const position = element.name.getEnd();
            if (
              position >= span.start &&
              position <= span.start + span.length
            ) {
              hints.push(createInlayHint(position, directive, ts));
            }
          }
        }
      }

      // Handle default imports
      if (node.importClause.name) {
        let directive = getExportDirective(resolvedModule, "default");

        // If not in cache, scan the file
        if (!directive) {
          const importedSourceFile = program.getSourceFile(resolvedModule);
          if (importedSourceFile) {
            const scanned = scanFileDirectives(importedSourceFile, program, ts);
            setCachedDirectives(
              importedSourceFile,
              scanned.moduleDirectives,
              scanned.exportDirectives
            );
            directive = scanned.exportDirectives.get("default") || null;
          }
        }

        if (directive) {
          const position = node.importClause.name.getEnd();
          if (position >= span.start && position <= span.start + span.length) {
            hints.push(createInlayHint(position, directive, ts));
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
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
 * Add inlay hints for call expressions
 */
function addCallExpressionHints(
  sourceFile: ts.SourceFile,
  program: ts.Program,
  span: ts.TextSpan,
  hints: ts.InlayHint[],
  ts: typeof import("typescript")
): void {
  const typeChecker = program.getTypeChecker();

  function visit(node: ts.Node): void {
    // Check for call expressions (function calls)
    if (ts.isCallExpression(node)) {
      const expression = node.expression;

      // Get the symbol of the called function
      const symbol = typeChecker.getSymbolAtLocation(expression);
      if (!symbol) {
        ts.forEachChild(node, visit);
        return;
      }

      // Get the declarations of the symbol
      const declarations = symbol.declarations;
      if (!declarations || declarations.length === 0) {
        ts.forEachChild(node, visit);
        return;
      }

      // Check if it's an imported function
      for (const declaration of declarations) {
        if (ts.isImportSpecifier(declaration)) {
          // This is a named import
          const importDecl = declaration.parent.parent.parent;
          if (
            ts.isImportDeclaration(importDecl) &&
            ts.isStringLiteral(importDecl.moduleSpecifier)
          ) {
            const importPath = importDecl.moduleSpecifier.text;
            const resolvedModule = resolveModuleName(
              importPath,
              sourceFile.fileName,
              program,
              ts
            );

            if (resolvedModule) {
              const exportedName = (
                declaration.propertyName || declaration.name
              ).text;

              // Try to get from cache first
              let directive = getExportDirective(resolvedModule, exportedName);

              // If not in cache, scan the file
              if (!directive) {
                const importedSourceFile =
                  program.getSourceFile(resolvedModule);
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
                  directive =
                    scanned.exportDirectives.get(exportedName) || null;
                }
              }

              if (directive && ts.isIdentifier(expression)) {
                const position = expression.getEnd();
                if (
                  position >= span.start &&
                  position <= span.start + span.length
                ) {
                  hints.push(createInlayHint(position, directive, ts));
                }
              }
            }
          }
        } else if (ts.isImportClause(declaration)) {
          // This is a default import
          if (!declaration.name) {
            continue;
          }

          const importDecl = declaration.parent;
          if (
            ts.isImportDeclaration(importDecl) &&
            ts.isStringLiteral(importDecl.moduleSpecifier)
          ) {
            const importPath = importDecl.moduleSpecifier.text;
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
                const importedSourceFile =
                  program.getSourceFile(resolvedModule);
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

              if (directive && ts.isIdentifier(expression)) {
                const position = expression.getEnd();
                if (
                  position >= span.start &&
                  position <= span.start + span.length
                ) {
                  hints.push(createInlayHint(position, directive, ts));
                }
              }
            }
          }
        } else if (
          ts.isFunctionDeclaration(declaration) ||
          ts.isVariableDeclaration(declaration)
        ) {
          // This is a local function in the same file
          const declarationFile = declaration.getSourceFile();

          // Only add hints for functions from the same file
          if (declarationFile.fileName === sourceFile.fileName) {
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

            // Get the function name
            let functionName: string | undefined;
            if (
              ts.isFunctionDeclaration(declaration) &&
              declaration.name &&
              ts.isIdentifier(declaration.name)
            ) {
              functionName = declaration.name.text;
            } else if (
              ts.isVariableDeclaration(declaration) &&
              ts.isIdentifier(declaration.name)
            ) {
              functionName = declaration.name.text;
            }

            if (functionName) {
              const directive = cached.exportDirectives.get(functionName);
              if (directive && ts.isIdentifier(expression)) {
                const position = expression.getEnd();
                if (
                  position >= span.start &&
                  position <= span.start + span.length
                ) {
                  hints.push(createInlayHint(position, directive, ts));
                }
              }
            }
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

/**
 * Add inlay hints for JSX elements (React components)
 */
function addJsxElementHints(
  sourceFile: ts.SourceFile,
  program: ts.Program,
  span: ts.TextSpan,
  hints: ts.InlayHint[],
  ts: typeof import("typescript")
): void {
  const typeChecker = program.getTypeChecker();

  function visit(node: ts.Node): void {
    // Check for JSX opening elements or self-closing elements
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tagName = node.tagName;

      // Only process identifier tags (component names, not HTML elements)
      // React components start with uppercase letter
      if (ts.isIdentifier(tagName)) {
        const componentName = tagName.text;

        // Check if it starts with uppercase (React component convention)
        if (componentName[0] === componentName[0].toUpperCase()) {
          // Get the symbol of the component
          const symbol = typeChecker.getSymbolAtLocation(tagName);
          if (!symbol) {
            ts.forEachChild(node, visit);
            return;
          }

          // Get the declarations of the symbol
          const declarations = symbol.declarations;
          if (!declarations || declarations.length === 0) {
            ts.forEachChild(node, visit);
            return;
          }

          // Check if it's an imported component
          for (const declaration of declarations) {
            if (ts.isImportSpecifier(declaration)) {
              // This is a named import
              const importDecl = declaration.parent.parent.parent;
              if (
                ts.isImportDeclaration(importDecl) &&
                ts.isStringLiteral(importDecl.moduleSpecifier)
              ) {
                const importPath = importDecl.moduleSpecifier.text;
                const resolvedModule = resolveModuleName(
                  importPath,
                  sourceFile.fileName,
                  program,
                  ts
                );

                if (resolvedModule) {
                  const exportedName = (
                    declaration.propertyName || declaration.name
                  ).text;

                  // Try to get from cache first
                  let directive = getExportDirective(
                    resolvedModule,
                    exportedName
                  );

                  // If not in cache, scan the file
                  if (!directive) {
                    const importedSourceFile =
                      program.getSourceFile(resolvedModule);
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
                      directive =
                        scanned.exportDirectives.get(exportedName) || null;
                    }
                  }

                  if (directive) {
                    const position = tagName.getEnd();
                    if (
                      position >= span.start &&
                      position <= span.start + span.length
                    ) {
                      hints.push(createInlayHint(position, directive, ts));
                    }
                  }
                }
              }
            } else if (ts.isImportClause(declaration)) {
              // This is a default import
              if (!declaration.name) {
                continue;
              }

              const importDecl = declaration.parent;
              if (
                ts.isImportDeclaration(importDecl) &&
                ts.isStringLiteral(importDecl.moduleSpecifier)
              ) {
                const importPath = importDecl.moduleSpecifier.text;
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
                    const importedSourceFile =
                      program.getSourceFile(resolvedModule);
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
                      directive =
                        scanned.exportDirectives.get("default") || null;
                    }
                  }

                  if (directive) {
                    const position = tagName.getEnd();
                    if (
                      position >= span.start &&
                      position <= span.start + span.length
                    ) {
                      hints.push(createInlayHint(position, directive, ts));
                    }
                  }
                }
              }
            } else if (
              ts.isFunctionDeclaration(declaration) ||
              ts.isVariableDeclaration(declaration)
            ) {
              // This is a local component in the same file
              const declarationFile = declaration.getSourceFile();

              // Only add hints for components from the same file
              if (declarationFile.fileName === sourceFile.fileName) {
                let cached = getCachedDirectives(declarationFile);
                if (!cached) {
                  const scanned = scanFileDirectives(
                    declarationFile,
                    program,
                    ts
                  );
                  setCachedDirectives(
                    declarationFile,
                    scanned.moduleDirectives,
                    scanned.exportDirectives
                  );
                  cached = scanned;
                }

                const directive = cached.exportDirectives.get(componentName);
                if (directive) {
                  const position = tagName.getEnd();
                  if (
                    position >= span.start &&
                    position <= span.start + span.length
                  ) {
                    hints.push(createInlayHint(position, directive, ts));
                  }
                }
              }
            }
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

/**
 * Add inlay hints for JSX attribute values (e.g., action={serverFunction})
 */
function addJsxAttributeHints(
  sourceFile: ts.SourceFile,
  program: ts.Program,
  span: ts.TextSpan,
  hints: ts.InlayHint[],
  ts: typeof import("typescript")
): void {
  const typeChecker = program.getTypeChecker();
  const validDirectives = getValidDirectivesFromRegistry(program, ts);

  function visit(node: ts.Node): void {
    // Check for JSX attributes
    if (ts.isJsxAttribute(node)) {
      const initializer = node.initializer;

      // Check if the attribute value is an expression (e.g., {functionName})
      if (
        initializer &&
        ts.isJsxExpression(initializer) &&
        initializer.expression
      ) {
        const expression = initializer.expression;

        // Handle various types of expressions
        let identifier: ts.Identifier | undefined;

        if (ts.isIdentifier(expression)) {
          // Direct reference: action={myFunction}
          identifier = expression;
        } else if (
          ts.isAsExpression(expression) &&
          ts.isIdentifier(expression.expression)
        ) {
          // Type assertion: action={myFunction as any}
          identifier = expression.expression;
        }

        if (identifier) {
          // Get the symbol of the referenced function
          const symbol = typeChecker.getSymbolAtLocation(identifier);
          if (!symbol) {
            ts.forEachChild(node, visit);
            return;
          }

          // Get the declarations of the symbol
          const declarations = symbol.declarations;
          if (!declarations || declarations.length === 0) {
            ts.forEachChild(node, visit);
            return;
          }

          // Check each declaration
          for (const declaration of declarations) {
            if (ts.isImportSpecifier(declaration)) {
              // This is a named import
              const importDecl = declaration.parent.parent.parent;
              if (
                ts.isImportDeclaration(importDecl) &&
                ts.isStringLiteral(importDecl.moduleSpecifier)
              ) {
                const importPath = importDecl.moduleSpecifier.text;
                const resolvedModule = resolveModuleName(
                  importPath,
                  sourceFile.fileName,
                  program,
                  ts
                );

                if (resolvedModule) {
                  const exportedName = (
                    declaration.propertyName || declaration.name
                  ).text;

                  // Try to get from cache first
                  let directive = getExportDirective(
                    resolvedModule,
                    exportedName
                  );

                  // If not in cache, scan the file
                  if (!directive) {
                    const importedSourceFile =
                      program.getSourceFile(resolvedModule);
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
                      directive =
                        scanned.exportDirectives.get(exportedName) || null;
                    }
                  }

                  if (directive) {
                    const position = identifier.getEnd();
                    if (
                      position >= span.start &&
                      position <= span.start + span.length
                    ) {
                      hints.push(createInlayHint(position, directive, ts));
                    }
                  }
                }
              }
            } else if (ts.isImportClause(declaration)) {
              // This is a default import
              if (!declaration.name) {
                continue;
              }

              const importDecl = declaration.parent;
              if (
                ts.isImportDeclaration(importDecl) &&
                ts.isStringLiteral(importDecl.moduleSpecifier)
              ) {
                const importPath = importDecl.moduleSpecifier.text;
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
                    const importedSourceFile =
                      program.getSourceFile(resolvedModule);
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
                      directive =
                        scanned.exportDirectives.get("default") || null;
                    }
                  }

                  if (directive) {
                    const position = identifier.getEnd();
                    if (
                      position >= span.start &&
                      position <= span.start + span.length
                    ) {
                      hints.push(createInlayHint(position, directive, ts));
                    }
                  }
                }
              }
            } else if (
              ts.isFunctionDeclaration(declaration) ||
              ts.isVariableDeclaration(declaration)
            ) {
              // This is a local function in the same file
              const declarationFile = declaration.getSourceFile();

              // Check for inline directive in the function
              const inlineDirective = getDirectiveOfNode(
                declaration,
                validDirectives,
                ts
              );

              if (inlineDirective) {
                const position = identifier.getEnd();
                if (
                  position >= span.start &&
                  position <= span.start + span.length
                ) {
                  hints.push(createInlayHint(position, inlineDirective, ts));
                }
              } else if (declarationFile.fileName === sourceFile.fileName) {
                // Check cache for exported functions
                let cached = getCachedDirectives(declarationFile);
                if (!cached) {
                  const scanned = scanFileDirectives(
                    declarationFile,
                    program,
                    ts
                  );
                  setCachedDirectives(
                    declarationFile,
                    scanned.moduleDirectives,
                    scanned.exportDirectives
                  );
                  cached = scanned;
                }

                const functionName = identifier.text;
                const directive = cached.exportDirectives.get(functionName);
                if (directive) {
                  const position = identifier.getEnd();
                  if (
                    position >= span.start &&
                    position <= span.start + span.length
                  ) {
                    hints.push(createInlayHint(position, directive, ts));
                  }
                }
              }
            }
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

/**
 * Create an inlay hint for a directive
 */
function createInlayHint(
  position: number,
  directive: string,
  ts: typeof import("typescript")
): ts.InlayHint {
  return {
    text: `<${directive}>`,
    position,
    kind: ts.InlayHintKind.Type,
    whitespaceBefore: true,
  };
}
