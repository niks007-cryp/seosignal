import { describe, expect, it } from "vitest";
import { evaluateLeadLocally } from "./qualification";
import { formatBudgetAmount } from "../shared/qualification";

describe("SEOSignal qualification framework", () => {
  it("recognizes a well-contextualized commercial SEO opportunity", () => {
    const report = evaluateLeadLocally({
      company: "Northstar Analytics",
      website: "https://northstar.example",
      serviceRequired: "Enterprise SEO",
      budgetAmount: 8000,
      budgetCurrency: "USD",
      businessGoal: "Qualified leads",
      targetMarket: "United States",
      timeline: "Within 90 days",
      seoChallenge: "Replacing a provider and improving demo conversion from organic traffic.",
    });

    expect(report.qualification).toBe("HIGH");
    expect(report.score).toBeGreaterThanOrEqual(76);
    expect(report.confidence.label).toBe("High");
    expect(report.signals).toHaveLength(10);
    expect(report.signals.find((signal) => signal.signal === "Commercial Scope")?.evidence).toContain("$8,000");
    expect(report.missingInfo).toHaveLength(0);
  });

  it("keeps unavailable information explicitly unknown rather than inventing it", () => {
    const report = evaluateLeadLocally({
      company: "Early Stage Co",
      website: "https://early.example",
      serviceRequired: "SEO audit",
      budgetAmount: 150000,
      budgetCurrency: "INR",
      businessGoal: "Market visibility",
    });

    expect(report.signals.find((signal) => signal.signal === "Market")?.assessment).toBe("Unknown");
    expect(report.signals.find((signal) => signal.signal === "Commercial Scope")?.evidence).toContain("₹1,50,000");
    expect(report.missingInfo.map((item) => item.title)).toContain("Target market");
    expect(report.confidence.label).toBe("Moderate");
  });

  it("formats monthly budgets with the selected locale and currency rather than converting them", () => {
    expect(formatBudgetAmount(5000, "USD")).toContain("5,000");
    expect(formatBudgetAmount(250000, "INR")).toContain("2,50,000");
    expect(formatBudgetAmount(4500, "EUR")).toContain("4.500");
  });
});
