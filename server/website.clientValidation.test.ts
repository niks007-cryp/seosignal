import { describe, expect, it } from "vitest";
import { normalizeWebsite } from "../shared/website";

describe("normalizeWebsite", () => {
  it("adds HTTPS to a common bare-domain entry", () => {
    expect(normalizeWebsite("example.com")).toEqual({ valid: true, value: "https://example.com/" });
  });

  it("preserves an HTTP(S) URL while trimming surrounding whitespace", () => {
    expect(normalizeWebsite("  https://www.example.com/path  ")).toEqual({ valid: true, value: "https://www.example.com/path" });
  });

  it("returns a concise client-safe message for malformed and unsupported URLs", () => {
    expect(normalizeWebsite("https://")).toMatchObject({ valid: false, message: "Enter a complete website URL, such as company.com." });
    expect(normalizeWebsite("ftp://example.com")).toMatchObject({ valid: false, message: "Website must use http or https." });
  });
});
