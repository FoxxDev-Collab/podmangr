/**
 * @jest-environment jsdom
 */

import { describe, it, expect } from "@jest/globals";
import { cn } from "@/lib/utils";

describe("cn utility function", () => {
  it("should merge class names", () => {
    const result = cn("class1", "class2");
    expect(result).toBe("class1 class2");
  });

  it("should handle undefined values", () => {
    const result = cn("class1", undefined, "class2");
    expect(result).toBe("class1 class2");
  });

  it("should handle null values", () => {
    const result = cn("class1", null, "class2");
    expect(result).toBe("class1 class2");
  });

  it("should handle boolean expressions", () => {
    const isActive = true;
    const isDisabled = false;
    const result = cn(
      "base",
      isActive && "active",
      isDisabled && "disabled"
    );
    expect(result).toBe("base active");
  });

  it("should merge tailwind classes correctly", () => {
    // tailwind-merge should merge conflicting classes
    const result = cn("px-2 py-1", "px-4");
    expect(result).toBe("py-1 px-4");
  });

  it("should handle conditional object syntax", () => {
    const result = cn({
      "base-class": true,
      "active-class": true,
      "disabled-class": false,
    });
    expect(result).toBe("base-class active-class");
  });

  it("should handle array of classes", () => {
    const result = cn(["class1", "class2"]);
    expect(result).toBe("class1 class2");
  });

  it("should handle mixed input types", () => {
    const result = cn(
      "base",
      ["array-class"],
      { "object-class": true },
      undefined,
      "final"
    );
    expect(result).toBe("base array-class object-class final");
  });

  it("should return empty string for no input", () => {
    const result = cn();
    expect(result).toBe("");
  });

  it("should return empty string for all falsy inputs", () => {
    const result = cn(undefined, null, false, "");
    expect(result).toBe("");
  });

  it("should handle deeply nested conditionals", () => {
    const condition1 = true;
    const condition2 = false;
    const condition3 = true;

    const result = cn(
      "base",
      condition1 && (condition2 ? "nested-true" : "nested-false"),
      condition3 && "condition3-true"
    );
    expect(result).toBe("base nested-false condition3-true");
  });
});

// Additional utility functions that might be in utils.ts
describe("Additional utility functions", () => {
  // Format bytes helper
  function formatBytes(bytes: number, decimals = 2): string {
    if (bytes === 0) return "0 Bytes";

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB"];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  }

  describe("formatBytes", () => {
    it("should format 0 bytes", () => {
      expect(formatBytes(0)).toBe("0 Bytes");
    });

    it("should format bytes to KB", () => {
      expect(formatBytes(1024)).toBe("1 KB");
    });

    it("should format bytes to MB", () => {
      expect(formatBytes(1048576)).toBe("1 MB");
    });

    it("should format bytes to GB", () => {
      expect(formatBytes(1073741824)).toBe("1 GB");
    });

    it("should format with custom decimals", () => {
      expect(formatBytes(1536, 3)).toBe("1.5 KB");
    });

    it("should handle large numbers", () => {
      expect(formatBytes(1099511627776)).toBe("1 TB");
    });
  });

  // Format percentage helper
  function formatPercentage(value: number, decimals = 1): string {
    return `${value.toFixed(decimals)}%`;
  }

  describe("formatPercentage", () => {
    it("should format percentage", () => {
      expect(formatPercentage(50)).toBe("50.0%");
    });

    it("should format with custom decimals", () => {
      expect(formatPercentage(33.333, 2)).toBe("33.33%");
    });

    it("should handle 0", () => {
      expect(formatPercentage(0)).toBe("0.0%");
    });

    it("should handle 100", () => {
      expect(formatPercentage(100)).toBe("100.0%");
    });
  });

  // Container status color helper
  function getStatusColor(status: string): string {
    switch (status.toLowerCase()) {
      case "running":
        return "text-green-500";
      case "paused":
        return "text-yellow-500";
      case "exited":
      case "stopped":
        return "text-red-500";
      case "created":
        return "text-blue-500";
      default:
        return "text-gray-500";
    }
  }

  describe("getStatusColor", () => {
    it("should return green for running", () => {
      expect(getStatusColor("running")).toBe("text-green-500");
    });

    it("should return yellow for paused", () => {
      expect(getStatusColor("paused")).toBe("text-yellow-500");
    });

    it("should return red for exited", () => {
      expect(getStatusColor("exited")).toBe("text-red-500");
    });

    it("should return red for stopped", () => {
      expect(getStatusColor("stopped")).toBe("text-red-500");
    });

    it("should return blue for created", () => {
      expect(getStatusColor("created")).toBe("text-blue-500");
    });

    it("should return gray for unknown status", () => {
      expect(getStatusColor("unknown")).toBe("text-gray-500");
    });

    it("should be case insensitive", () => {
      expect(getStatusColor("RUNNING")).toBe("text-green-500");
      expect(getStatusColor("Running")).toBe("text-green-500");
    });
  });

  // Truncate string helper
  function truncateString(str: string, maxLength: number): string {
    if (str.length <= maxLength) return str;
    return str.slice(0, maxLength - 3) + "...";
  }

  describe("truncateString", () => {
    it("should not truncate short strings", () => {
      expect(truncateString("short", 10)).toBe("short");
    });

    it("should truncate long strings", () => {
      expect(truncateString("this is a very long string", 10)).toBe("this is...");
    });

    it("should handle exact length", () => {
      expect(truncateString("exact", 5)).toBe("exact");
    });

    it("should handle empty strings", () => {
      expect(truncateString("", 10)).toBe("");
    });
  });

  // Container ID shortener helper
  function shortenId(id: string, length = 12): string {
    if (!id) return "";
    return id.slice(0, length);
  }

  describe("shortenId", () => {
    it("should shorten container ID to 12 characters by default", () => {
      const fullId = "abc123def456ghi789jkl012mno345pqr678";
      expect(shortenId(fullId)).toBe("abc123def456");
    });

    it("should shorten to custom length", () => {
      const fullId = "abc123def456ghi789jkl012mno345pqr678";
      expect(shortenId(fullId, 8)).toBe("abc123de");
    });

    it("should handle short IDs", () => {
      expect(shortenId("abc123")).toBe("abc123");
    });

    it("should handle empty string", () => {
      expect(shortenId("")).toBe("");
    });

    it("should handle undefined/null", () => {
      expect(shortenId(undefined as unknown as string)).toBe("");
      expect(shortenId(null as unknown as string)).toBe("");
    });
  });
});
