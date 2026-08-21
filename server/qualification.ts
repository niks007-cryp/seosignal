import { formatBudgetAmount, type LeadInput, type QualificationReport } from "../shared/qualification";
import { analyzeWithGemini, factorEntries, ratingToAssessment, type GeminiQualification } from "./geminiQualification";
import { FACTOR_LABELS, QUALIFICATION_CONFIG, type AiRating } from "./qualification-config";
import type { WebsiteInspection } from "./websiteInspection";

const ratingValue: Record<AiRating, number> = { STRONG: 100, MODERATE: 65, WEAK: 25, UNKNOWN: 45 };

function disqualifiersFor(lead: LeadInput) {
  const issues: string[] = [];
  if (!QUALIFICATION_CONFIG.supportedServices.includes(lead.serviceRequired)) issues.push(QUALIFICATION_CONFIG.hardDisqualifiers.unsupportedService);
  if (lead.budgetAmount < QUALIFICATION_CONFIG.budgetMinimums[lead.budgetCurrency] * 0.35) issues.push(QUALIFICATION_CONFIG.hardDisqualifiers.materiallyLowBudget);
  if (/0.?30|under 30|less than 30|within 30/i.test(lead.timeline ?? "")) issues.push(QUALIFICATION_CONFIG.hardDisqualifiers.unrealisticTimeline);
  return issues;
}

export function applyConfiguredIcpAssessment(lead: LeadInput, inspection: WebsiteInspection, factors: GeminiQualification["factors"]) {
  const evidence = `${lead.company} ${lead.website} ${inspection.title ?? ""} ${inspection.metaDescription ?? ""} ${inspection.visibleText ?? ""}`.toLowerCase();
  const nonProspectMatch = QUALIFICATION_CONFIG.icpEvidence.nonProspectTerms.find((term) => evidence.includes(term));
  if (nonProspectMatch) {
    return {
      ...factors,
      icp_fit: {
        rating: "WEAK" as const,
        reason: `Configured ICP screening identified the non-prospect or placeholder marker “${nonProspectMatch}”.`,
      },
    };
  }
  const targetMatch = QUALIFICATION_CONFIG.icpEvidence.targetTerms.find((term) => evidence.includes(term));
  if (targetMatch && factors.icp_fit.rating === "UNKNOWN") {
    return {
      ...factors,
      icp_fit: {
        rating: "MODERATE" as const,
        reason: `Configured ICP screening found target-profile evidence: “${targetMatch}”.`,
      },
    };
  }
  return factors;
}

export function calculateQualificationScore(factors: GeminiQualification["factors"], disqualifiers: string[]) {
  const weighted = factorEntries(factors).reduce((total, [key, factor]) => total + (ratingValue[factor.rating] * QUALIFICATION_CONFIG.weights[key]) / 100, 0);
  const fundamentalIcpMismatch = disqualifiers.includes(QUALIFICATION_CONFIG.hardDisqualifiers.fundamentalIcpMismatch);
  const adjusted = disqualifiers.length || fundamentalIcpMismatch
    ? Math.min(weighted, disqualifiers.some((item) => item === QUALIFICATION_CONFIG.hardDisqualifiers.unsupportedService || item === QUALIFICATION_CONFIG.hardDisqualifiers.unrealisticTimeline) || fundamentalIcpMismatch ? 35 : 49)
    : weighted;
  return Math.max(0, Math.min(100, Math.round(adjusted)));
}

export function qualificationFromScore(score: number) {
  return score >= QUALIFICATION_CONFIG.thresholds.high ? "HIGH" : score >= QUALIFICATION_CONFIG.thresholds.medium ? "MEDIUM" : "LOW";
}

function reportFromAnalysis(lead: LeadInput, inspection: WebsiteInspection, analysis: GeminiQualification): QualificationReport {
  const factors = applyConfiguredIcpAssessment(lead, inspection, analysis.factors);
  const disqualifiers = [
    ...disqualifiersFor(lead),
    ...(factors.icp_fit.rating === "WEAK" ? [QUALIFICATION_CONFIG.hardDisqualifiers.fundamentalIcpMismatch] : []),
  ];
  const score = calculateQualificationScore(factors, disqualifiers);
  const qualification = qualificationFromScore(score);
  const evaluatedSignals = factorEntries(factors).filter(([, value]) => value.rating !== "UNKNOWN").length;
  const unknownSignals = factorEntries(factors).filter(([, value]) => value.rating === "UNKNOWN").length;
  const missingInfo = [
    ...analysis.missing_information.map((item) => ({ title: "Discovery input", body: item })),
    !lead.targetMarket && { title: "Target market", body: "The target geography or priority customer market has not been provided." },
    !lead.timeline && { title: "Decision timeline", body: "The expected start date and decision horizon have not been established." },
  ].filter(Boolean) as { title: string; body: string }[];
  const signals = factorEntries(factors).map(([key, factor]) => ({ signal: FACTOR_LABELS[key], assessment: ratingToAssessment(factor.rating), evidence: factor.reason }));
  const monthlyBudget = `${formatBudgetAmount(lead.budgetAmount, lead.budgetCurrency)} / month`;
  const rationale = disqualifiers.length ? `${disqualifiers.join(" ")} ${analysis.reasoning}` : analysis.reasoning;

  return {
    qualification,
    score,
    title: qualification === "HIGH" ? "High-fit opportunity" : qualification === "MEDIUM" ? "Potentially viable opportunity" : "Low-fit opportunity",
    rationale,
    confidence: { label: unknownSignals <= 2 ? "High" : unknownSignals <= 4 ? "Moderate" : "Limited", rationale: inspection.status === "AVAILABLE" ? "Based on submitted commercial context and a lightweight homepage inspection." : "Based on submitted lead information; the supplied website was unavailable for inspection.", evaluatedSignals },
    executiveSummary: [
      { title: "Service alignment", body: factors.service_fit.reason },
      { title: "Commercial context", body: `${factors.budget_fit.reason} Declared scope: ${monthlyBudget}.` },
      { title: "Business objective", body: factors.business_objective_fit.reason },
      { title: "Website context", body: inspection.status === "AVAILABLE" ? inspection.siteDescription ?? "Homepage inspection completed with limited descriptive content." : "The homepage could not be inspected; website-specific evidence remains unavailable." },
    ],
    signals,
    missingInfo: missingInfo.slice(0, 4),
    recommendation: analysis.next_best_action,
    methodology: `The assessment applies ten explicit weighted factors: service fit, ICP/company fit, budget fit, geographic fit, business objective fit, SEO use-case fit, timeline fit, buying intent, goal clarity and information completeness. The prototype ICP focuses on ${QUALIFICATION_CONFIG.targetCustomerTypes.join(", ")}.`,
    assumptions: "This assessment prototype uses stated lead information and a lightweight homepage inspection where available. It is not a conversion-probability model; production calibration would require historical CRM and conversion data.",
  };
}

export async function qualifyLead(lead: LeadInput, inspection: WebsiteInspection) {
  const analysis = await analyzeWithGemini(lead, inspection);
  return { report: reportFromAnalysis(lead, inspection, analysis), model: QUALIFICATION_CONFIG.geminiModel };
}
