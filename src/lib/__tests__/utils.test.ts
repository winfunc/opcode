import { describe, it, expect } from "vitest";
import { cn } from "../utils";

/**
 * Test suite for utility functions
 *
 * Tests general utility functions including class name merging,
 * conditional class handling, and Tailwind CSS integration.
 */
describe("Utils", () => {
  describe("cn function", () => {
    it("merges class names correctly", () => {
      expect(cn("class1", "class2")).toBe("class1 class2");
    });

    it("handles conditional classes", () => {
      const showConditional = true;
      const showHidden = false;
      expect(cn("base", showConditional && "conditional", showHidden && "hidden")).toBe(
        "base conditional"
      );
    });

    it("handles undefined and null values", () => {
      expect(cn("base", undefined, null, "end")).toBe("base end");
    });

    it("merges tailwind classes correctly", () => {
      expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
    });
  });
});
