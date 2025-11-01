/**
 * TypeScript Directives Plugin
 *
 * A TypeScript Language Service Plugin that provides IDE-level awareness
 * for "use …" directives such as "use server", "use client", "use cache", etc.
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type ts from "typescript";
import { scanFileDirectives } from "./ast.js";
import {
  clearExportDirectives,
  setCachedDirectives,
  setExportDirective,
} from "./cache.js";
import {
  getCompletionEntryDetails,
  getCompletionsAtPosition,
} from "./completions.js";
import { getSemanticDiagnostics } from "./diagnostics.js";
import { provideInlayHints } from "./hints.js";
import { getQuickInfoAtPosition } from "./hover.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface PluginModule {
  typescript: typeof ts;
}

interface PluginCreateInfo {
  languageService: ts.LanguageService;
  languageServiceHost: ts.LanguageServiceHost;
  project: ts.server.Project;
  config: unknown;
}

function init(modules: PluginModule): {
  create: (info: PluginCreateInfo) => ts.LanguageService;
} {
  const ts = modules.typescript;

  function create(info: PluginCreateInfo): ts.LanguageService {
    // Get the original language service first
    const languageService = info.languageService;
    const languageServiceHost = info.languageServiceHost;

    // Add global.d.ts to the program by modifying the host
    let globalDtsPath: string | null = null;
    let globalDtsContent: string | null = null;
    let _globalTypesAdded = false;
    try {
      // The built plugin is in dist/index.js, and global.d.ts should be in dist/global.d.ts
      let candidatePath = resolve(__dirname, "global.d.ts");

      // Check if file exists
      const fs = require("node:fs");
      if (!fs.existsSync(candidatePath)) {
        console.error(`[Plugin] global.d.ts not found at: ${candidatePath}`);
        // Try alternative path (for development/monorepo setups)
        const altPath = resolve(__dirname, "../types/global.d.ts");
        if (fs.existsSync(altPath)) {
          candidatePath = altPath;
        } else {
          console.error(
            `[Plugin] global.d.ts not found at alternative path either`
          );
          console.error(
            `[Plugin] Global types will not be available. Please add "types": ["typescript-plugin-directives/global"] to your tsconfig.json`
          );
        }
      }

      if (fs.existsSync(candidatePath)) {
        globalDtsPath = candidatePath;
        globalDtsContent = fs.readFileSync(globalDtsPath, "utf-8");

        // Normalize path to use forward slashes (TypeScript convention)
        const normalizedPath = globalDtsPath.replace(/\\/g, "/");

        // Wrap getScriptFileNames to include global.d.ts
        const originalGetScriptFileNames =
          languageServiceHost.getScriptFileNames.bind(languageServiceHost);
        languageServiceHost.getScriptFileNames = () => {
          const fileNames = originalGetScriptFileNames();
          if (!fileNames.includes(normalizedPath)) {
            return [...fileNames, normalizedPath];
          }
          return fileNames;
        };

        // Wrap getScriptSnapshot to provide content for global.d.ts
        const originalGetScriptSnapshot =
          languageServiceHost.getScriptSnapshot.bind(languageServiceHost);
        languageServiceHost.getScriptSnapshot = (fileName: string) => {
          if (
            fileName.replace(/\\/g, "/") === normalizedPath &&
            globalDtsContent
          ) {
            return ts.ScriptSnapshot.fromString(globalDtsContent);
          }
          return originalGetScriptSnapshot(fileName);
        };

        // Wrap fileExists to report that global.d.ts exists
        const originalFileExists =
          languageServiceHost.fileExists?.bind(languageServiceHost);
        if (originalFileExists) {
          languageServiceHost.fileExists = (fileName: string) => {
            if (fileName.replace(/\\/g, "/") === normalizedPath) {
              return true;
            }
            return originalFileExists(fileName);
          };
        }

        // Wrap readFile to provide content for global.d.ts
        const originalReadFile =
          languageServiceHost.readFile?.bind(languageServiceHost);
        if (originalReadFile) {
          languageServiceHost.readFile = (fileName: string) => {
            if (
              fileName.replace(/\\/g, "/") === normalizedPath &&
              globalDtsContent
            ) {
              return globalDtsContent;
            }
            return originalReadFile(fileName);
          };
        }

        _globalTypesAdded = true;
      }
    } catch (error) {
      console.error("[Plugin] Failed to add global.d.ts:", error);
    }

    const originalGetQuickInfoAtPosition =
      languageService.getQuickInfoAtPosition.bind(languageService);
    const originalProvideInlayHints =
      languageService.provideInlayHints?.bind(languageService);

    // Keep track of scanned files
    const scannedFiles = new Set<string>();

    /**
     * Scan a file and update export map
     */
    function ensureFileScanned(fileName: string): void {
      const program = languageService.getProgram();
      if (!program) return;

      const sourceFile = program.getSourceFile(fileName);
      if (!sourceFile) return;

      // Create a cache key based on file name and version
      const version = (sourceFile as any).version;
      const cacheKey = `${fileName}::${version}`;

      if (scannedFiles.has(cacheKey)) {
        return;
      }

      // Clear old export directives for this file
      clearExportDirectives(fileName);

      // Scan file for directives
      const { moduleDirectives, exportDirectives } = scanFileDirectives(
        sourceFile,
        program,
        ts
      );

      // Update cache
      setCachedDirectives(sourceFile, moduleDirectives, exportDirectives);

      // Update global export map
      for (const [exportName, directive] of exportDirectives.entries()) {
        setExportDirective(fileName, exportName, directive);
      }

      // Mark as scanned
      scannedFiles.add(cacheKey);
    }

    /**
     * Scan all files in the program
     */
    function ensureAllFilesScanned(): void {
      const program = languageService.getProgram();
      if (!program) return;

      const sourceFiles = program.getSourceFiles();
      for (const sourceFile of sourceFiles) {
        // Skip declaration files and node_modules
        if (
          sourceFile.isDeclarationFile ||
          sourceFile.fileName.includes("node_modules")
        ) {
          continue;
        }

        ensureFileScanned(sourceFile.fileName);
      }
    }

    // Create the proxy
    const proxy = Object.create(null) as ts.LanguageService;

    for (const k of Object.keys(languageService) as Array<
      keyof ts.LanguageService
    >) {
      const x = languageService[k];
      // @ts-expect-error - We're dynamically creating the proxy
      proxy[k] = (...args: unknown[]) => x.apply(languageService, args);
    }

    // Override getQuickInfoAtPosition
    proxy.getQuickInfoAtPosition = (fileName: string, position: number) => {
      ensureAllFilesScanned();
      return getQuickInfoAtPosition(
        fileName,
        position,
        languageService,
        ts,
        originalGetQuickInfoAtPosition
      );
    };

    // Override provideInlayHints
    if (typeof originalProvideInlayHints === "function") {
      proxy.provideInlayHints = (
        fileName: string,
        span: ts.TextSpan,
        _preferences: ts.UserPreferences | undefined
      ) => {
        ensureAllFilesScanned();
        return provideInlayHints(fileName, span, languageService, ts);
      };
    }

    // Override getCompletionsAtPosition for directive autocomplete
    const originalGetCompletionsAtPosition =
      languageService.getCompletionsAtPosition?.bind(languageService);
    if (originalGetCompletionsAtPosition) {
      proxy.getCompletionsAtPosition = (
        fileName: string,
        position: number,
        _options: ts.GetCompletionsAtPositionOptions | undefined
      ) => {
        return getCompletionsAtPosition(
          fileName,
          position,
          languageService,
          ts,
          (fn, pos, opts) => originalGetCompletionsAtPosition(fn, pos, opts)
        );
      };
    }

    // Override getCompletionEntryDetails
    const originalGetCompletionEntryDetails =
      languageService.getCompletionEntryDetails?.bind(languageService);
    if (originalGetCompletionEntryDetails) {
      proxy.getCompletionEntryDetails = (
        fileName: string,
        position: number,
        entryName: string,
        _formatOptions:
          | ts.FormatCodeOptions
          | ts.FormatCodeSettings
          | undefined,
        _source: string | undefined,
        _preferences: ts.UserPreferences | undefined,
        _data: ts.CompletionEntryData | undefined
      ) => {
        return getCompletionEntryDetails(
          fileName,
          position,
          entryName,
          ts,
          originalGetCompletionEntryDetails
        );
      };
    }

    // Override getSemanticDiagnostics for directive validation
    const originalGetSemanticDiagnostics =
      languageService.getSemanticDiagnostics.bind(languageService);
    proxy.getSemanticDiagnostics = (fileName: string) => {
      ensureAllFilesScanned();
      return getSemanticDiagnostics(
        fileName,
        languageService,
        ts,
        originalGetSemanticDiagnostics
      );
    };

    return proxy;
  }

  return { create };
}

export default init;
