import type { CurrencyCode } from "../shared/qualification";

export const QUALIFICATION_CONFIG = {
  groqModel: "openai/gpt-oss-20b",
  supportedServices: ["SEO strategy", "Technical SEO", "Content SEO", "Enterprise SEO", "SEO audit"] as const,
  supportedObjectives: ["Qualified leads", "Organic revenue", "Market visibility", "Technical health"] as const,
  targetCustomerTypes: [
    "B2B SaaS and technology companies",
    "Professional service businesses with a considered buying journey",
    "Established B2B companies investing in sustainable organic acquisition",
  ],
  icpEvidence: {
    targetTerms: ["b2b", "saas", "software", "technology", "platform", "enterprise", "professional services", "consulting"],
    nonProspectTerms: ["internal validation", "test submission", "placeholder", "example.com"],
  },
  preferredMarkets: ["United States", "United Kingdom", "Canada", "Australia", "India", "Europe", "Global"],
  weights: {
    service_fit: 20,
    icp_fit: 15,
    budget_fit: 15,
    geographic_fit: 10,
    business_objective_fit: 10,
    use_case_fit: 10,
    timeline_fit: 5,
    buying_intent: 5,
    goal_clarity: 5,
    information_completeness: 5,
  },
  thresholds: { high: 75, medium: 50 },
  budgetMinimums: {
    USD: 1000,
    EUR: 1000,
    GBP: 900,
    INR: 80000,
    CAD: 1300,
    AUD: 1500,
    SGD: 1350,
    AED: 3700,
    CHF: 900,
    JPY: 150000,
  } satisfies Record<CurrencyCode, number>,
  hardDisqualifiers: {
    unsupportedService: "The requested requirement is outside the defined SEO service capability.",
    materiallyLowBudget: "The stated ongoing budget is materially below the prototype commercial assumption for the selected currency.",
    unrealisticTimeline: "The requested timeline expects meaningful SEO results in less than 30 days.",
    fundamentalIcpMismatch: "The submitted company and website evidence indicate a fundamental mismatch with the prototype B2B SEO customer profile.",
  },
} as const;

export type FactorKey = keyof typeof QUALIFICATION_CONFIG.weights;
export type AiRating = "STRONG" | "MODERATE" | "WEAK" | "UNKNOWN";

export const FACTOR_LABELS: Record<FactorKey, string> = {
  service_fit: "Service Fit",
  icp_fit: "ICP / Company",
  budget_fit: "Commercial Scope",
  geographic_fit: "Market",
  business_objective_fit: "Business Goal",
  use_case_fit: "SEO Use Case",
  timeline_fit: "Timeline",
  buying_intent: "Intent",
  goal_clarity: "Goal Clarity",
  information_completeness: "Information Completeness",
};
