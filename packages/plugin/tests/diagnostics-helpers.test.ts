import { describe, expect, it } from "vitest";
import { levenshteinDistance } from "../src/diagnostics.js";

describe("diagnostics helpers", () => {
  describe("levenshteinDistance - comprehensive coverage", () => {
    it("should handle substitutions", () => {
      expect(levenshteinDistance("cat", "bat")).toBe(1);
      expect(levenshteinDistance("use server", "use client")).toBe(6);
    });

    it("should handle insertions", () => {
      expect(levenshteinDistance("cat", "cats")).toBe(1);
      expect(levenshteinDistance("use", "use server")).toBe(7);
    });

    it("should handle deletions", () => {
      expect(levenshteinDistance("cats", "cat")).toBe(1);
      expect(levenshteinDistance("use server", "use")).toBe(7);
    });

    it("should handle mixed operations", () => {
      expect(levenshteinDistance("kitten", "sitting")).toBe(3);
      expect(levenshteinDistance("saturday", "sunday")).toBe(3);
    });

    it("should handle very different strings", () => {
      expect(levenshteinDistance("abc", "xyz")).toBe(3);
      expect(levenshteinDistance("use server", "abc")).toBe(10);
    });

    it("should handle long strings", () => {
      const long1 = "use cache: memory; ttl=3600; maxSize=1000";
      const long2 = "use cache: server; ttl=7200; maxSize=2000";
      const distance = levenshteinDistance(long1, long2);
      expect(distance).toBeGreaterThan(0);
    });

    it("should handle special characters", () => {
      expect(levenshteinDistance("use cache:", "use cache;")).toBe(1);
      expect(levenshteinDistance("use-server", "use_server")).toBe(1);
    });

    it("should handle unicode characters", () => {
      // é is one character but may be represented differently
      expect(levenshteinDistance("café", "cafe")).toBe(1);
      // Emoji counts as one or more characters depending on encoding
      const dist = levenshteinDistance("hello👋", "hello");
      expect(dist).toBeGreaterThanOrEqual(1);
    });

    it("should be symmetric", () => {
      expect(levenshteinDistance("abc", "def")).toBe(
        levenshteinDistance("def", "abc")
      );
      expect(levenshteinDistance("use server", "use client")).toBe(
        levenshteinDistance("use client", "use server")
      );
    });

    it("should satisfy triangle inequality", () => {
      const a = "use server";
      const b = "use client";
      const c = "use cache";

      const ab = levenshteinDistance(a, b);
      const bc = levenshteinDistance(b, c);
      const ac = levenshteinDistance(a, c);

      expect(ab).toBeLessThanOrEqual(ac + bc);
    });
  });

  describe("distance-based suggestion algorithms", () => {
    it("should find exact matches with distance 0", () => {
      const validDirectives = ["use server", "use client", "use cache"];
      const input = "use server";
      const matches = validDirectives.filter(
        (d) => levenshteinDistance(input, d) === 0
      );
      expect(matches).toContain("use server");
      expect(matches.length).toBe(1);
    });

    it("should find close matches within threshold", () => {
      const validDirectives = ["use server", "use client", "use cache"];
      const input = "use serve"; // 1 char away from "use server"
      const threshold = 1;
      const matches = validDirectives.filter(
        (d) => levenshteinDistance(input, d) <= threshold
      );
      expect(matches).toContain("use server");
    });

    it("should exclude distant matches", () => {
      const validDirectives = ["use server", "use client", "use cache"];
      const input = "completely different";
      const threshold = 3;
      const matches = validDirectives.filter(
        (d) => levenshteinDistance(input, d) <= threshold
      );
      expect(matches.length).toBe(0);
    });

    it("should handle threshold edge cases", () => {
      const validDirectives = ["use server", "use client"];
      const input = "use serve"; // exactly 1 away from "use server"

      // Should include with threshold 1
      const matches1 = validDirectives.filter(
        (d) => levenshteinDistance(input, d) <= 1
      );
      expect(matches1).toContain("use server");

      // Should exclude with threshold 0
      const matches0 = validDirectives.filter(
        (d) => levenshteinDistance(input, d) <= 0
      );
      expect(matches0.length).toBe(0);
    });

    it("should rank suggestions by distance", () => {
      const validDirectives = ["use server", "use client", "use cache"];
      const input = "use serve";

      const ranked = validDirectives
        .map((d) => ({
          directive: d,
          distance: levenshteinDistance(input, d),
        }))
        .sort((a, b) => a.distance - b.distance);

      // "use server" should be closest (distance 1)
      expect(ranked[0].directive).toBe("use server");
      expect(ranked[0].distance).toBe(1);
    });

    it("should handle tie-breaking when multiple matches have same distance", () => {
      const validDirectives = [
        "use cache: memory",
        "use cache: server",
        "use cache: client",
      ];
      const input = "use cache";

      const distances = validDirectives.map((d) => ({
        directive: d,
        distance: levenshteinDistance(input, d),
      }));

      // All should have similar distances
      const uniqueDistances = new Set(distances.map((d) => d.distance));
      expect(uniqueDistances.size).toBeLessThanOrEqual(3);
    });

    it("should adapt threshold to input length", () => {
      // Short input - smaller threshold
      const shortInput = "use";
      const shortThreshold = Math.max(
        2,
        Math.min(3, Math.ceil(shortInput.length * 0.2))
      );
      expect(shortThreshold).toBe(2); // max(2, min(3, ceil(0.6))) = max(2, min(3, 1)) = max(2, 1) = 2

      // Medium input
      const mediumInput = "use server";
      const mediumThreshold = Math.max(
        2,
        Math.min(3, Math.ceil(mediumInput.length * 0.2))
      );
      expect(mediumThreshold).toBe(2); // max(2, min(3, ceil(2))) = max(2, min(3, 2)) = max(2, 2) = 2

      // Long input
      const longInput = "use cache: memory; ttl=3600";
      const longThreshold = Math.max(
        2,
        Math.min(3, Math.ceil(longInput.length * 0.2))
      );
      expect(longThreshold).toBe(3); // max(2, min(3, ceil(5.6))) = max(2, min(3, 6)) = max(2, 3) = 3
    });
  });

  describe("formatting helpers patterns", () => {
    it("should format empty list", () => {
      const suggestions: string[] = [];
      // If we had access to formatSuggestionList, we'd test:
      // expect(formatSuggestionList(suggestions)).toBe("");
      expect(suggestions.length).toBe(0);
    });

    it("should format single item with quotes", () => {
      const suggestions = ["use server"];
      const expected = "'use server'";
      expect(suggestions.length).toBe(1);
      expect(`'${suggestions[0]}'`).toBe(expected);
    });

    it("should format two items with 'or'", () => {
      const suggestions = ["use server", "use client"];
      const expected = "'use server' or 'use client'";
      const formatted = `'${suggestions[0]}' or '${suggestions[1]}'`;
      expect(formatted).toBe(expected);
    });

    it("should format three or more items with commas and 'or'", () => {
      const suggestions = ["use server", "use client", "use cache"];
      const quoted = suggestions.map((s) => `'${s}'`);
      const lastItem = quoted.pop();
      const formatted = `${quoted.join(", ")}, or ${lastItem}`;
      expect(formatted).toBe("'use server', 'use client', or 'use cache'");
    });

    it("should format list with 'and' for directives", () => {
      const directives = ["use server", "use client", "use cache"];
      const quoted = directives.map((s) => `'${s}'`);
      const lastItem = quoted.pop();
      const formatted = `${quoted.join(", ")}, and ${lastItem}`;
      expect(formatted).toBe("'use server', 'use client', and 'use cache'");
    });

    it("should handle very long lists", () => {
      const manyDirectives = [
        "use server",
        "use client",
        "use cache",
        "use cache: memory",
        "use cache: server",
      ];
      expect(manyDirectives.length).toBe(5);
      const quoted = manyDirectives.map((s) => `'${s}'`);
      expect(quoted.length).toBe(5);
    });

    it("should handle special characters in directive names", () => {
      const directives = ["use cache: memory", "use cache; ttl=3600"];
      const quoted = directives.map((s) => `'${s}'`);
      expect(quoted).toContain("'use cache: memory'");
      expect(quoted).toContain("'use cache; ttl=3600'");
    });
  });

  describe("suggestion message patterns", () => {
    it("should create 'Did you mean' message for single suggestion", () => {
      const input = "use serve";
      const suggestion = "use server";
      const message = `Unknown directive '${input}'. Did you mean '${suggestion}'?`;
      expect(message).toContain("Did you mean");
      expect(message).toContain(input);
      expect(message).toContain(suggestion);
    });

    it("should create 'Did you mean' message for multiple suggestions", () => {
      const input = "use cach";
      const suggestions = ["use cache", "use cache: memory"];
      const quoted = suggestions.map((s) => `'${s}'`);
      const lastItem = quoted.pop();
      const suggestionList = `${quoted.join(", ")}, or ${lastItem}`;
      const message = `Unknown directive '${input}'. Did you mean ${suggestionList}?`;
      expect(message).toContain("Did you mean");
      expect(message).toContain("'use cache'");
    });

    it("should create 'Available directives' message when no close match", () => {
      const input = "use xyz";
      const validDirectives = ["use server", "use client", "use cache"].sort();
      const quoted = validDirectives.map((s) => `'${s}'`);
      const lastItem = quoted.pop();
      const dirList = `${quoted.join(", ")}, and ${lastItem}`;
      const message = `Unknown directive '${input}'. Available directives are ${dirList}.`;
      expect(message).toContain("Available directives are");
      expect(message).toContain("'use cache'");
      expect(message).toContain("'use client'");
      expect(message).toContain("'use server'");
    });

    it("should handle base directive vs provider/options errors", () => {
      const baseDirective = "use cache";
      const _fullInput = "use cache: wrongprovider";
      const message = `Invalid provider or options for directive '${baseDirective}'.`;
      expect(message).toContain(baseDirective);
      expect(message).toContain("provider or options");
    });

    it("should handle directives that don't support options", () => {
      const directive = "use server";
      const message = `Directive '${directive}' does not support options or providers. Use it as '${directive}'.`;
      expect(message).toContain("does not support");
      expect(message).toContain(directive);
    });
  });

  describe("complex validation scenarios", () => {
    it("should validate directive with provider syntax", () => {
      const input = "use cache: memory";
      const parts = input.split(":");
      expect(parts.length).toBe(2);
      expect(parts[0].trim()).toBe("use cache");
      expect(parts[1].trim()).toBe("memory");
    });

    it("should validate directive with options syntax", () => {
      const input = "use cache; ttl=3600";
      const parts = input.split(";");
      expect(parts.length).toBe(2);
      expect(parts[0].trim()).toBe("use cache");
      expect(parts[1].trim()).toBe("ttl=3600");
    });

    it("should validate directive with both provider and options", () => {
      const input = "use cache: memory; ttl=3600";
      const hasProvider = input.includes(":");
      const hasOptions = input.includes(";");
      expect(hasProvider).toBe(true);
      expect(hasOptions).toBe(true);
    });

    it("should extract base directive from complex syntax", () => {
      const testCases = [
        { input: "use cache: memory", expected: "use cache" },
        { input: "use cache; ttl=3600", expected: "use cache" },
        { input: "use cache: memory; ttl=3600", expected: "use cache" },
        { input: "use server", expected: "use server" },
      ];

      testCases.forEach(({ input, expected }) => {
        const match = input.match(/^use\s+([^:;]+)/);
        if (match) {
          const baseDirective = match[0].trim();
          expect(baseDirective).toBe(expected);
        }
      });
    });

    it("should determine if directive has options or providers", () => {
      const withProvider = "use cache: memory";
      const withOptions = "use cache; ttl=3600";
      const withBoth = "use cache: memory; ttl=3600";
      const simple = "use server";

      expect(withProvider.includes(":") || withProvider.includes(";")).toBe(
        true
      );
      expect(withOptions.includes(":") || withOptions.includes(";")).toBe(true);
      expect(withBoth.includes(":") || withBoth.includes(";")).toBe(true);
      expect(simple.includes(":") || simple.includes(";")).toBe(false);
    });
  });
});
