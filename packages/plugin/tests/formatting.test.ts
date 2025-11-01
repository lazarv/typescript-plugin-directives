import { describe, expect, it } from "vitest";
import {
  formatDirectiveList,
  formatSuggestionList,
} from "../src/diagnostics.js";

/**
 * Tests for string formatting utilities
 * These test the helper functions used in diagnostics
 */

describe("formatting utilities", () => {
  describe("formatSuggestionList", () => {
    it("should handle empty array", () => {
      const result = formatSuggestionList([]);
      expect(result).toBe("");
    });

    it("should format single suggestion", () => {
      const suggestions = ["use server"];
      const result = formatSuggestionList(suggestions);
      expect(result).toBe("'use server'");
    });

    it("should format two suggestions with or", () => {
      const suggestions = ["use server", "use client"];
      const result = formatSuggestionList(suggestions);
      expect(result).toBe("'use server' or 'use client'");
    });

    it("should format three suggestions with commas and or", () => {
      const suggestions = ["use server", "use client", "use cache"];
      const result = formatSuggestionList(suggestions);
      expect(result).toBe("'use server', 'use client', or 'use cache'");
    });

    it("should format many suggestions", () => {
      const suggestions = [
        "use server",
        "use client",
        "use cache",
        "use strict",
      ];
      const result = formatSuggestionList(suggestions);
      expect(result).toBe(
        "'use server', 'use client', 'use cache', or 'use strict'"
      );
    });

    it("should handle suggestions with special characters", () => {
      const suggestions = ["use server", "use-client", "use:cache"];
      const result = formatSuggestionList(suggestions);
      expect(result).toBe("'use server', 'use-client', or 'use:cache'");
    });
  });

  describe("formatDirectiveList", () => {
    it("should handle empty array", () => {
      const result = formatDirectiveList([]);
      expect(result).toBe("");
    });

    it("should format single directive", () => {
      const directives = ["use server"];
      const result = formatDirectiveList(directives);
      expect(result).toBe("'use server'");
    });

    it("should format two directives with and", () => {
      const directives = ["use server", "use client"];
      const result = formatDirectiveList(directives);
      expect(result).toBe("'use server' and 'use client'");
    });

    it("should format three directives with commas and and", () => {
      const directives = ["use server", "use client", "use cache"];
      const result = formatDirectiveList(directives);
      expect(result).toBe("'use server', 'use client', and 'use cache'");
    });

    it("should format many directives", () => {
      const directives = [
        "use server",
        "use client",
        "use cache",
        "use strict",
      ];
      const result = formatDirectiveList(directives);
      expect(result).toBe(
        "'use server', 'use client', 'use cache', and 'use strict'"
      );
    });

    it("should handle directives with special characters", () => {
      const directives = ["use server", "use-client", "use:cache"];
      const result = formatDirectiveList(directives);
      expect(result).toBe("'use server', 'use-client', and 'use:cache'");
    });
  });
});
