import { describe, expect, it } from "vitest";
import { formatBudgetAmount } from "../shared/qualification";
import { applyConfiguredIcpAssessment, calculateQualificationScore, qualificationFromScore } from "./qualification";
import type { GroqQualification } from "./groqQualification";
import { QUALIFICATION_CONFIG } from "./qualification-config";

function factors(overrides: Partial<GroqQualification["factors"]> = {}): GroqQualification["factors"] {
  const strong = { rating: "STRONG" as const, reason: "Test evidence" };
  return {
    service_fit: strong,
    icp_fit: strong,
    budget_fit: strong,
    geographic_fit: strong,
    business_objective_fit: strong,
    use_case_fit: strong,
    timeline_fit: strong,
    buying_intent: strong,
    goal_clarity: strong,
    information_completeness: strong,
    ...overrides,
  };
}

describe("SEOSignal qualification framework", () => {
  it("calculates a transparent high-fit score from the defined weighted factors", () => {
    const score = calculateQualificationScore(factors(), []);
    expect(score).toBe(100);
    expect(qualificationFromScore(score)).toBe("HIGH");
  });

  it("uses the published threshold boundaries", () => {
    expect(qualificationFromScore(75)).toBe("HIGH");
    expect(qualificationFromScore(50)).toBe("MEDIUM");
    expect(qualificationFromScore(49)).toBe("LOW");
  });

  it("caps fundamentally unsuitable opportunities despite otherwise strong factor ratings", () => {
    const score = calculateQualificationScore(factors(), ["The requested timeline expects meaningful SEO results in less than 30 days."]);
    expect(score).toBeLessThan(50);
    expect(qualificationFromScore(score)).toBe("LOW");
  });

  it("caps a fundamental ICP mismatch even when other factors are strong", () => {
    const score = calculateQualificationScore(
      factors({ icp_fit: { rating: "WEAK", reason: "Not a B2B SEO buyer." } }),
      [QUALIFICATION_CONFIG.hardDisqualifiers.fundamentalIcpMismatch],
    );
    expect(score).toBeLessThan(50);
    expect(qualificationFromScore(score)).toBe("LOW");
  });

  it("uses configured non-prospect evidence to override an AI ICP rating before scoring", () => {
    const assessed = applyConfiguredIcpAssessment(
      { company: "Internal Validation", website: "https://example.com", serviceRequired: "SEO strategy", budgetAmount: 5000, budgetCurrency: "USD", businessGoal: "Qualified leads" },
      { status: "AVAILABLE", title: "Example Domain" },
      factors({ icp_fit: { rating: "STRONG", reason: "AI signal" } }),
    );
    expect(assessed.icp_fit.rating).toBe("WEAK");
    expect(assessed.icp_fit.reason).toContain("Configured ICP screening");
  });

  it("downgrades the full qualification outcome when configured non-prospect evidence is present", () => {
    const assessed = applyConfiguredIcpAssessment(
      { company: "Internal Validation", website: "https://example.com", serviceRequired: "SEO strategy", budgetAmount: 5000, budgetCurrency: "USD", businessGoal: "Qualified leads" },
      { status: "AVAILABLE", title: "Example Domain" },
      factors(),
    );
    const score = calculateQualificationScore(assessed, [QUALIFICATION_CONFIG.hardDisqualifiers.fundamentalIcpMismatch]);
    expect(score).toBeLessThan(50);
    expect(qualificationFromScore(score)).toBe("LOW");
  });

  it("raises an unknown ICP factor when configured target-profile evidence is available", () => {
    const original = factors({ icp_fit: { rating: "UNKNOWN", reason: "No direct company evidence." } });
    const assessed = applyConfiguredIcpAssessment(
      { company: "Northstar B2B Software", website: "https://northstar.example", serviceRequired: "SEO strategy", budgetAmount: 5000, budgetCurrency: "USD", businessGoal: "Qualified leads" },
      { status: "AVAILABLE", title: "Enterprise SaaS platform" },
      original,
    );
    expect(assessed.icp_fit.rating).toBe("MODERATE");
    expect(calculateQualificationScore(assessed, [])).toBeGreaterThan(calculateQualificationScore(original, []));
  });

  it("formats monthly budgets with the selected locale and currency rather than converting them", () => {
    expect(formatBudgetAmount(5000, "USD")).toContain("5,000");
    expect(formatBudgetAmount(250000, "INR")).toContain("2,50,000");
    expect(formatBudgetAmount(4500, "EUR")).toContain("4.500");
  });
});
