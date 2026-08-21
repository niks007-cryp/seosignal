export type QualificationLevel = "HIGH" | "MEDIUM" | "LOW";
export type SignalAssessment = "Strong" | "Moderate" | "Weak" | "Unknown";

export type LeadInput = {
  company: string;
  website: string;
  serviceRequired: "SEO strategy" | "Technical SEO" | "Content SEO" | "Enterprise SEO" | "SEO audit";
  monthlyBudget: "Under $2,000" | "$2,000–$4,000" | "$4,000–$8,000" | "$8,000+";
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
