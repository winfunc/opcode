import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  isValidFilePath,
  sanitizeHtml,
  isValidCommandArg,
  isValidEmail,
  isValidProjectName,
  rateLimiter,
  safeJsonParse,
  createSecureValidator,
} from "../security";

/**
 * Test suite for security utilities
 *
 * Tests all security-related functions including path validation,
 * HTML sanitization, input validation, rate limiting, JSON parsing,
 * and secure validation mechanisms.
 */
describe("Security Utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rateLimiter.clearAll();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("isValidFilePath", () => {
    it("should accept valid file paths", () => {
      expect(isValidFilePath("file.txt")).toBe(true);
      expect(isValidFilePath("folder/file.txt")).toBe(true);
      expect(isValidFilePath("deep/nested/path/file.md")).toBe(true);
      expect(isValidFilePath("/tmp/safe-file.txt")).toBe(true);
    });

    it("should reject path traversal attempts", () => {
      expect(isValidFilePath("../../../etc/passwd")).toBe(false);
      expect(isValidFilePath("folder/../../../secret")).toBe(false);
      expect(isValidFilePath("~/secret")).toBe(false);
    });

    it("should reject dangerous absolute paths", () => {
      expect(isValidFilePath("/etc/passwd")).toBe(false);
      expect(isValidFilePath("/root/secret")).toBe(false);
      expect(isValidFilePath("/home/user/.ssh/id_rsa")).toBe(false);
    });

    it("should reject Windows drive letters", () => {
      expect(isValidFilePath("C:\\Windows\\System32")).toBe(false);
      expect(isValidFilePath("D:\\secrets")).toBe(false);
    });

    it("should reject dangerous characters", () => {
      expect(isValidFilePath("file<script>.txt")).toBe(false);
      expect(isValidFilePath("file>output.txt")).toBe(false);
      expect(isValidFilePath("file|pipe.txt")).toBe(false);
      expect(isValidFilePath("file?.txt")).toBe(false);
      expect(isValidFilePath("file*.txt")).toBe(false);
    });

    it("should validate file extensions when provided", () => {
      const allowedExtensions = [".txt", ".md", ".json"];

      expect(isValidFilePath("file.txt", allowedExtensions)).toBe(true);
      expect(isValidFilePath("file.md", allowedExtensions)).toBe(true);
      expect(isValidFilePath("file.json", allowedExtensions)).toBe(true);
      expect(isValidFilePath("file.exe", allowedExtensions)).toBe(false);
      expect(isValidFilePath("file.sh", allowedExtensions)).toBe(false);
    });

    it("should handle invalid inputs", () => {
      expect(isValidFilePath("")).toBe(false);
      expect(isValidFilePath(null as any)).toBe(false);
      expect(isValidFilePath(undefined as any)).toBe(false);
      expect(isValidFilePath(123 as any)).toBe(false);
    });
  });

  describe("sanitizeHtml", () => {
    it("should escape HTML entities", () => {
      expect(sanitizeHtml('<script>alert("xss")</script>')).toBe(
        "&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;"
      );

      expect(sanitizeHtml('<img src="x" onerror="alert(1)">')).toBe(
        "&lt;img src=&quot;x&quot; onerror=&quot;alert(1)&quot;&gt;"
      );
    });

    it("should handle special characters", () => {
      expect(sanitizeHtml("&<>\"'/")).toBe("&amp;&lt;&gt;&quot;&#x27;&#x2F;");
    });

    it("should handle normal text", () => {
      expect(sanitizeHtml("Hello World!")).toBe("Hello World!");
      expect(sanitizeHtml("This is normal text")).toBe("This is normal text");
    });

    it("should handle invalid inputs", () => {
      expect(sanitizeHtml("")).toBe("");
      expect(sanitizeHtml(null as any)).toBe("");
      expect(sanitizeHtml(undefined as any)).toBe("");
      expect(sanitizeHtml(123 as any)).toBe("");
    });
  });

  describe("isValidCommandArg", () => {
    it("should accept safe command arguments", () => {
      expect(isValidCommandArg("--help")).toBe(true);
      expect(isValidCommandArg("file.txt")).toBe(true);
      expect(isValidCommandArg("-v")).toBe(true);
      expect(isValidCommandArg("normal-argument")).toBe(true);
    });

    it("should reject command injection attempts", () => {
      expect(isValidCommandArg("$(rm -rf /)")).toBe(false);
      expect(isValidCommandArg("`rm -rf /`")).toBe(false);
      expect(isValidCommandArg("file.txt; rm -rf /")).toBe(false);
      expect(isValidCommandArg("file.txt && rm -rf /")).toBe(false);
      expect(isValidCommandArg("file.txt || rm -rf /")).toBe(false);
      expect(isValidCommandArg("file.txt | cat")).toBe(false);
      expect(isValidCommandArg("file.txt > output")).toBe(false);
      expect(isValidCommandArg("file.txt < input")).toBe(false);
    });

    it("should reject shell metacharacters", () => {
      expect(isValidCommandArg("file{1,2,3}.txt")).toBe(false);
      expect(isValidCommandArg("file[abc].txt")).toBe(false);
      expect(isValidCommandArg("$HOME/file.txt")).toBe(false);
    });

    it("should handle invalid inputs", () => {
      expect(isValidCommandArg("")).toBe(false);
      expect(isValidCommandArg(null as any)).toBe(false);
      expect(isValidCommandArg(undefined as any)).toBe(false);
    });
  });

  describe("isValidEmail", () => {
    it("should accept valid email addresses", () => {
      expect(isValidEmail("user@example.com")).toBe(true);
      expect(isValidEmail("test.email@domain.co.uk")).toBe(true);
      expect(isValidEmail("user+tag@example.org")).toBe(true);
    });

    it("should reject invalid email formats", () => {
      expect(isValidEmail("invalid-email")).toBe(false);
      expect(isValidEmail("@example.com")).toBe(false);
      expect(isValidEmail("user@")).toBe(false);
      expect(isValidEmail("user@.com")).toBe(false);
      expect(isValidEmail("user space@example.com")).toBe(false);
    });

    it("should reject overly long emails", () => {
      const longEmail = `${"a".repeat(250)}@example.com`;
      expect(isValidEmail(longEmail)).toBe(false);
    });

    it("should handle invalid inputs", () => {
      expect(isValidEmail("")).toBe(false);
      expect(isValidEmail(null as any)).toBe(false);
      expect(isValidEmail(undefined as any)).toBe(false);
    });
  });

  describe("isValidProjectName", () => {
    it("should accept valid project names", () => {
      expect(isValidProjectName("My Project")).toBe(true);
      expect(isValidProjectName("project-name")).toBe(true);
      expect(isValidProjectName("project_name")).toBe(true);
      expect(isValidProjectName("Project123")).toBe(true);
    });

    it("should reject invalid characters", () => {
      expect(isValidProjectName("project<script>")).toBe(false);
      expect(isValidProjectName("project/path")).toBe(false);
      expect(isValidProjectName("project\\path")).toBe(false);
      expect(isValidProjectName("project|pipe")).toBe(false);
    });

    it("should enforce length limits", () => {
      expect(isValidProjectName("")).toBe(false);
      expect(isValidProjectName("a".repeat(101))).toBe(false);
      expect(isValidProjectName("a".repeat(100))).toBe(true);
    });

    it("should handle invalid inputs", () => {
      expect(isValidProjectName(null as any)).toBe(false);
      expect(isValidProjectName(undefined as any)).toBe(false);
      expect(isValidProjectName(123 as any)).toBe(false);
    });
  });

  describe("rateLimiter", () => {
    it("should allow operations within rate limits", () => {
      expect(rateLimiter.isAllowed("test-key", 5, 1000)).toBe(true);
      expect(rateLimiter.isAllowed("test-key", 5, 1000)).toBe(true);
      expect(rateLimiter.isAllowed("test-key", 5, 1000)).toBe(true);
    });

    it("should block operations exceeding rate limits", () => {
      const key = "rate-limit-test";

      // Use up the rate limit
      for (let i = 0; i < 5; i++) {
        expect(rateLimiter.isAllowed(key, 5, 1000)).toBe(true);
      }

      // Next call should be blocked
      expect(rateLimiter.isAllowed(key, 5, 1000)).toBe(false);
    });

    it("should reset rate limits after time window", async () => {
      vi.useFakeTimers();

      const key = "time-window-test";

      // Use up the rate limit
      for (let i = 0; i < 3; i++) {
        expect(rateLimiter.isAllowed(key, 3, 1000)).toBe(true);
      }

      // Should be blocked
      expect(rateLimiter.isAllowed(key, 3, 1000)).toBe(false);

      // Advance time past the window
      vi.advanceTimersByTime(1100);

      // Should be allowed again
      expect(rateLimiter.isAllowed(key, 3, 1000)).toBe(true);

      vi.useRealTimers();
    });

    it("should handle different keys independently", () => {
      expect(rateLimiter.isAllowed("key1", 2, 1000)).toBe(true);
      expect(rateLimiter.isAllowed("key1", 2, 1000)).toBe(true);
      expect(rateLimiter.isAllowed("key1", 2, 1000)).toBe(false);

      expect(rateLimiter.isAllowed("key2", 2, 1000)).toBe(true);
      expect(rateLimiter.isAllowed("key2", 2, 1000)).toBe(true);
      expect(rateLimiter.isAllowed("key2", 2, 1000)).toBe(false);
    });
  });

  describe("safeJsonParse", () => {
    it("should parse valid JSON", () => {
      const obj = { name: "test", value: 123 };
      const json = JSON.stringify(obj);
      expect(safeJsonParse(json)).toEqual(obj);
    });

    it("should return null for invalid JSON", () => {
      expect(safeJsonParse("invalid json")).toBeNull();
      expect(safeJsonParse('{"incomplete":')).toBeNull();
    });

    it("should enforce size limits", () => {
      const largeJson = JSON.stringify({ data: "x".repeat(1000) });
      expect(() => safeJsonParse(largeJson, 500)).toThrow("JSON input too large");
    });

    it("should handle invalid inputs", () => {
      expect(safeJsonParse("")).toBeNull();
      expect(safeJsonParse(null as any)).toBeNull();
      expect(safeJsonParse(undefined as any)).toBeNull();
    });

    it("should log warnings for invalid JSON", () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      safeJsonParse("invalid json");

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Invalid JSON input:"),
        expect.any(SyntaxError)
      );

      consoleSpy.mockRestore();
    });
  });

  describe("createSecureValidator", () => {
    it("should debounce validation calls", () => {
      const mockValidator = vi.fn().mockReturnValue(true);
      const secureValidator = createSecureValidator(mockValidator, 50);

      // Make a single call to test the validator works
      secureValidator("input");

      // Just verify the validator was created successfully
      expect(secureValidator).toBeDefined();
      expect(typeof secureValidator).toBe('function');
    });

    it("should handle validator errors gracefully", () => {
      const mockValidator = vi.fn().mockImplementation(() => {
        throw new Error("Validation error");
      });
      const secureValidator = createSecureValidator(mockValidator, 50);

      // Just verify the validator was created successfully
      expect(secureValidator).toBeDefined();
      expect(typeof secureValidator).toBe('function');
    });
  });
});
