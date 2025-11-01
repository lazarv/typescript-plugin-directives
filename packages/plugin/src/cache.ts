/**
 * Caching utilities for directive metadata
 */

import type ts from "typescript";

// Increment this whenever the directive scanning logic changes
// to invalidate old cached data
const CACHE_SCHEMA_VERSION = 2;

interface CachedDirectiveData {
  moduleDirectives: string[];
  exportDirectives: Map<string, string>;
  version: number;
  schemaVersion: number;
}

/**
 * WeakMap-based cache for per-file directive metadata
 * Key: SourceFile, Value: { moduleDirectives, exportDirectives, version }
 */
const fileCache = new WeakMap<ts.SourceFile, CachedDirectiveData>();

/**
 * Global map for export directives
 * Key: "normalizedFilePath::exportName", Value: directive string
 */
const exportMap = new Map<string, string>();

/**
 * Get cached directives for a source file
 */
export function getCachedDirectives(sourceFile: ts.SourceFile): {
  moduleDirectives: string[];
  exportDirectives: Map<string, string>;
} | null {
  const cached = fileCache.get(sourceFile);
  if (!cached) return null;

  // Check schema version
  if (cached.schemaVersion !== CACHE_SCHEMA_VERSION) {
    return null;
  }

  // Check if version matches (file hasn't changed)
  const currentVersion = (sourceFile as any).version;
  if (cached.version !== currentVersion) {
    return null;
  }

  return {
    moduleDirectives: cached.moduleDirectives,
    exportDirectives: cached.exportDirectives,
  };
}

/**
 * Set cached directives for a source file
 */
export function setCachedDirectives(
  sourceFile: ts.SourceFile,
  moduleDirectives: string[],
  exportDirectives: Map<string, string>
): void {
  const currentVersion = (sourceFile as any).version;
  fileCache.set(sourceFile, {
    moduleDirectives,
    exportDirectives,
    version: currentVersion,
    schemaVersion: CACHE_SCHEMA_VERSION,
  });
}

/**
 * Normalize a file path for use as a key
 */
export function normalizeFilePath(fileName: string): string {
  return fileName.replace(/\\/g, "/");
}

/**
 * Set export directive in the global map
 */
export function setExportDirective(
  fileName: string,
  exportName: string,
  directive: string
): void {
  const key = `${normalizeFilePath(fileName)}::${exportName}`;
  exportMap.set(key, directive);
}

/**
 * Get export directive from the global map
 */
export function getExportDirective(
  fileName: string,
  exportName: string
): string | null {
  const key = `${normalizeFilePath(fileName)}::${exportName}`;
  return exportMap.get(key) || null;
}

/**
 * Clear all caches (for debugging/testing)
 */
export function clearAllCaches(): void {
  exportMap.clear();
  // Note: WeakMap doesn't have a clear method, but it will garbage collect automatically
}

/**
 * Clear cached directives for a specific source file
 */
export function clearCachedDirectives(sourceFile: ts.SourceFile): void {
  fileCache.delete(sourceFile);
}

/**
 * Clear export directives for a file
 */
export function clearExportDirectives(fileName: string): void {
  const normalizedPath = normalizeFilePath(fileName);
  const keysToDelete: string[] = [];

  for (const key of exportMap.keys()) {
    if (key.startsWith(`${normalizedPath}::`)) {
      keysToDelete.push(key);
    }
  }

  for (const key of keysToDelete) {
    exportMap.delete(key);
  }
}
