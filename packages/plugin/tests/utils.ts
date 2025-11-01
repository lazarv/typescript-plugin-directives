import ts from "typescript";

// Global type definitions for testing
const GLOBAL_TYPES = `declare global {
  type DirectiveProvider<T extends string = string> = T;

  type DirectiveOptions = Record<string, string | number | boolean>;

  type DirectiveWithOptions<
    T extends string,
    O extends DirectiveOptions | undefined = undefined
  > = O extends DirectiveOptions ? \`\${T}; \${string}\` : T;

  type DirectiveWithProvider<
    T extends string,
    P extends string | undefined = undefined,
    O extends DirectiveOptions | undefined = undefined
  > = P extends string
    ? DirectiveWithOptions<\`\${T}: \${P}\`, O>
    : DirectiveWithOptions<T, O>;

  interface DirectiveRegistry {
    "use server": never;
    "use client": never;
    "use cache": DirectiveWithProvider<
      "use cache",
      DirectiveProvider<"memory" | "redis" | "default">,
      DirectiveOptions
    >;
  }

  type Directive = DirectiveRegistry[keyof DirectiveRegistry] extends never
    ? keyof DirectiveRegistry
    : DirectiveRegistry[keyof DirectiveRegistry] | keyof DirectiveRegistry;
}

export {};
`;

/**
 * Create a TypeScript program for testing
 */
export function createTestProgram(files: Record<string, string>) {
  // Add global.d.ts to the files
  const filesWithGlobals: Record<string, string> = {
    "global.d.ts": GLOBAL_TYPES,
    ...files,
  };

  const compilerOptions: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    strict: true,
    types: [], // Don't load external types
  };

  const fileNames = Object.keys(filesWithGlobals);

  const host: ts.CompilerHost = {
    getSourceFile: (fileName) => {
      const content = filesWithGlobals[fileName];
      if (content !== undefined) {
        return ts.createSourceFile(fileName, content, ts.ScriptTarget.ES2022);
      }
      // Fall back to real file system for lib files
      const realContent = ts.sys.readFile(fileName);
      if (realContent) {
        return ts.createSourceFile(
          fileName,
          realContent,
          ts.ScriptTarget.ES2022
        );
      }
      return undefined;
    },
    getDefaultLibFileName: () => ts.getDefaultLibFilePath(compilerOptions),
    writeFile: () => {},
    getCurrentDirectory: () => process.cwd(),
    getCanonicalFileName: (fileName) =>
      ts.sys.useCaseSensitiveFileNames ? fileName : fileName.toLowerCase(),
    useCaseSensitiveFileNames: () => ts.sys.useCaseSensitiveFileNames,
    getNewLine: () => "\n",
    fileExists: (fileName) =>
      filesWithGlobals[fileName] !== undefined || ts.sys.fileExists(fileName),
    readFile: (fileName) =>
      filesWithGlobals[fileName] || ts.sys.readFile(fileName),
  };

  return ts.createProgram(fileNames, compilerOptions, host);
}

/**
 * Create a language service for testing
 */
export function createTestLanguageService(files: Record<string, string>) {
  // Add global.d.ts to the files
  const filesWithGlobals: Record<string, string> = {
    "global.d.ts": GLOBAL_TYPES,
    ...files,
  };

  const compilerOptions: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    strict: true,
    types: [], // Don't load external types
  };

  const currentFiles: Record<string, string> = { ...filesWithGlobals };

  const host: ts.LanguageServiceHost = {
    getScriptFileNames: () => Object.keys(currentFiles),
    getScriptVersion: () => "1",
    getScriptSnapshot: (fileName) => {
      const content = currentFiles[fileName];
      if (content !== undefined) {
        return ts.ScriptSnapshot.fromString(content);
      }
      return undefined;
    },
    getCurrentDirectory: () => process.cwd(),
    getCompilationSettings: () => compilerOptions,
    getDefaultLibFileName: () => ts.getDefaultLibFilePath(compilerOptions),
    useCaseSensitiveFileNames: () => ts.sys.useCaseSensitiveFileNames,
    getNewLine: () => "\n",
    fileExists: (fileName) =>
      currentFiles[fileName] !== undefined || ts.sys.fileExists(fileName),
    readFile: (fileName) => currentFiles[fileName] || ts.sys.readFile(fileName),
    resolveModuleNames: (moduleNames, _containingFile) => {
      return moduleNames.map((moduleName) => {
        // Handle relative imports
        if (moduleName.startsWith("./") || moduleName.startsWith("../")) {
          // Remove the ./ or ../ and add .ts extension if needed
          let resolvedName = moduleName.replace(/^\.\//, "");
          if (!resolvedName.endsWith(".ts") && !resolvedName.endsWith(".tsx")) {
            resolvedName += ".ts";
          }

          // Check if this file exists in our virtual file system
          if (currentFiles[resolvedName]) {
            return {
              resolvedFileName: resolvedName,
              isExternalLibraryImport: false,
            };
          }
        }

        // Fallback to undefined for non-resolvable modules
        return undefined;
      });
    },
  };

  const languageService = ts.createLanguageService(
    host,
    ts.createDocumentRegistry()
  );

  return {
    languageService,
    updateFile: (fileName: string, content: string) => {
      currentFiles[fileName] = content;
    },
  };
}
