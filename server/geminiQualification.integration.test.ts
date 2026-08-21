import { describe, expect, it } from "vitest";
import { analyzeWithGemini } from "./geminiQualification";

const runLiveIntegration = process.env.GEMINI_INTEGRATION_TEST === "true";

describe("Gemini structured qualification integration", () => {
  it.skipIf(!runLiveIntegration)("returns a Zod-validated ten-factor assessment", async () => {
    const result = await analyzeWithGemini(
      {
        company: "Example B2B Platform",
        website: "https://example.com",
        serviceRequired: "Technical SEO",
        budgetAmount: 5000,
        budgetCurrency: "USD",
        businessGoal: "Qualified leads",
        targetMarket: "United States",
        timeline: "30–90 days",
        seoChallenge: "Improve qualified organic demo requests after a site migration.",
      },
      { status: "AVAILABLE", title: "Example Domain", metaDescription: "Illustrative test website", visibleText: "Example content", siteDescription: "Illustrative test website" },
    );

    expect(result.factors).toHaveProperty("service_fit");
    expect(Object.keys(result.factors)).toHaveLength(10);
    expect(result.next_best_action.steps.length).toBeGreaterThan(0);
  }, 30_000);
});
