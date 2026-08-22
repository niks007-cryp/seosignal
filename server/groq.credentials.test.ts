import { describe, expect, it } from "vitest";

describe("GROQ_API_KEY", () => {
  it("authenticates against the Groq models endpoint without exposing the credential", async () => {
    const key = process.env.GROQ_API_KEY;
    expect(key).toBeTruthy();

    const response = await fetch("https://api.groq.com/openai/v1/models", {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(10_000),
    });

    expect(response.ok, `Groq credential check returned HTTP ${response.status}`).toBe(true);
  }, 15_000);
});
