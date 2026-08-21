export type QualificationLevel = "HIGH" | "MEDIUM" | "LOW";
export type SignalAssessment = "Strong" | "Moderate" | "Weak" | "Unknown";

export const CURRENCIES = [
  { code: "USD", name: "US Dollar", symbol: "$", locale: "en-US" },
  { code: "EUR", name: "Euro", symbol: "€", locale: "de-DE" },
  { code: "GBP", name: "British Pound", symbol: "£", locale: "en-GB" },
  { code: "INR", name: "Indian Rupee", symbol: "₹", locale: "en-IN" },
  { code: "CAD", name: "Canadian Dollar", symbol: "CA$", locale: "en-CA" },
  { code: "AUD", name: "Australian Dollar", symbol: "A$", locale: "en-AU" },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$", locale: "en-SG" },
  { code: "AED", name: "UAE Dirham", symbol: "د.إ", locale: "en-AE" },
  { code: "CHF", name: "Swiss Franc", symbol: "CHF", locale: "de-CH" },
  { code: "JPY", name: "Japanese Yen", symbol: "¥", locale: "ja-JP" },
] as const;

export type CurrencyCode = (typeof CURRENCIES)[number]["code"];

export function formatBudgetAmount(amount: number, currency: CurrencyCode) {
  const definition = CURRENCIES.find((item) => item.code === currency) ?? CURRENCIES[0];
  return new Intl.NumberFormat(definition.locale, {
    style: "currency",
    currency: definition.code,
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: 0,
  }).format(Math.max(0, amount));
}

export type LeadInput = {
  company: string;
  website: string;
  serviceRequired: "SEO strategy" | "Technical SEO" | "Content SEO" | "Enterprise SEO" | "SEO audit";
  budgetAmount: number;
  budgetCurrency: CurrencyCode;
  businessGoal: "Qualified leads" | "Organic revenue" | "Market visibility" | "Technical health";
  targetMarket?: string;
  timeline?: string;
  seoChallenge?: string;
};

export type Finding = { title: string; body: string };
export type QualificationSignal = {
  signal: string;
  assessment: SignalAssessment;
  evidence: string;
};

export type QualificationReport = {
  qualification: QualificationLevel;
  score: number;
  title: string;
  rationale: string;
  confidence: { label: "High" | "Moderate" | "Limited"; rationale: string; evaluatedSignals: number };
  executiveSummary: Finding[];
  signals: QualificationSignal[];
  missingInfo: Finding[];
  recommendation: { title: string; body: string; steps: string[] };
  methodology: string;
  assumptions: string;
};
