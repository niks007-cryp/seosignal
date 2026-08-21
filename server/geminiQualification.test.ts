import { afterEach, describe, expect, it, vi } from "vitest";
import { analyzeWithGemini, GeminiQualificationError, geminiQualificationSchema } from "./geminiQualification";

const validPayload = {
  qualification: "HIGH", score: 85, confidence: "HIGH", reasoning: "Validated response.",
  factors: Object.fromEntries(["service_fit", "icp_fit", "budget_fit", "geographic_fit", "business_objective_fit", "use_case_fit", "timeline_fit", "buying_intent", "goal_clarity", "information_completeness"].map((key) => [key, { rating: "STRONG", reason: "Evidence." }])),
  missing_information: [], next_best_action: { title: "Schedule discovery", body: "Confirm scope.", steps: ["Confirm scope"] },
};

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("Gemini structured-output validation", () => {
  it("rejects malformed provider data before it can reach the interface", () => {
    expect(() => geminiQualificationSchema.parse({ qualification: "HIGH" })).toThrow();
  });

  it("retries a transient provider failure once before validating the recovered response", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("temporary outage", { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(validPayload) }] } }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await analyzeWithGemini({ company: "Northstar", website: "https://northstar.example", serviceRequired: "SEO strategy", budgetAmount: 5000, budgetCurrency: "USD", businessGoal: "Qualified leads" }, { status: "UNAVAILABLE" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.factors.service_fit.rating).toBe("STRONG");
  });

  it("retries a rate-limited provider response before surfacing an explicit rate-limit failure", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    const fetchMock = vi.fn().mockResolvedValue(new Response("busy", { status: 429 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(analyzeWithGemini({ company: "Northstar", website: "https://northstar.example", serviceRequired: "SEO strategy", budgetAmount: 5000, budgetCurrency: "USD", businessGoal: "Qualified leads" }, { status: "UNAVAILABLE" }))
      .rejects.toMatchObject<Partial<GeminiQualificationError>>({ failure: "RATE_LIMITED" });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  }, 5_000);
});
