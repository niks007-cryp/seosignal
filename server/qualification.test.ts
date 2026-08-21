import { describe, expect, it } from "vitest";
import { evaluateLeadLocally } from "./qualification";

describe("SEOSignal qualification framework", () => {
  it("recognizes a well-contextualized commercial SEO opportunity", () => {
    const report = evaluateLeadLocally({
      company: "Northstar Analytics",
      website: "https://northstar.example",
      serviceRequired: "Enterprise SEO",
      monthlyBudget: "$8,000+",
      businessGoal: "Qualified leads",
      targetMarket: "United States",
      timeline: "Within 90 days",
      seoChallenge: "Replacing a provider and improving demo conversion from organic traffic.",
    });

    expect(report.qualification).toBe("HIGH");
    expect(report.score).toBeGreaterThanOrEqual(76);
    expect(report.confidence.label).toBe("High");
    expect(report.missingInfo).toHaveLength(0);
  });

  it("keeps unavailable information explicitly unknown rather than inventing it", () => {
    const report = evaluateLeadLocally({
      company: "Early Stage Co",
      website: "https://early.example",
      serviceRequired: "SEO audit",
      monthlyBudget: "Under $2,000",
      businessGoal: "Market visibility",
    });

    expect(report.signals.find((signal) => signal.signal === "Market")?.assessment).toBe("Unknown");
    expect(report.missingInfo.map((item) => item.title)).toContain("Target market");
    expect(report.confidence.label).toBe("Moderate");
  });
});
