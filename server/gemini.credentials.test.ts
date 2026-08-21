import { describe, expect, it } from "vitest";

const geminiApiKey = process.env.GEMINI_API_KEY;

describe("Gemini credential", () => {
  it.skipIf(!geminiApiKey)("authenticates against the model-list endpoint", async () => {
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models", {
      headers: { "x-goog-api-key": geminiApiKey! },
      signal: AbortSignal.timeout(12_000),
    });

    expect(response.ok).toBe(true);
    const payload = (await response.json()) as { models?: unknown[] };
    expect(Array.isArray(payload.models)).toBe(true);
  });
});
