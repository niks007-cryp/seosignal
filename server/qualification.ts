import { invokeLLM, listLLMModels } from "./_core/llm";
import type { LeadInput, QualificationReport } from "../shared/qualification";

const capabilityProfile = `
SEOSignal evaluates inbound opportunities for a specialist B2B SEO agency. Strong fits are companies seeking strategic, technical, content, enterprise SEO or an SEO audit; have a commercial organic-growth objective; communicate a realistic ongoing budget; can work in a defined market; and show evidence of urgency or provider evaluation. This is decision support, not a prediction of conversion probability. Never invent facts not present in the lead information.
`;

const schema = {
  type: "object",
  properties: {
    qualification: { type: "string", enum: ["HIGH", "MEDIUM", "LOW"] },
    score: { type: "number", minimum: 0, maximum: 100 },
    title: { type: "string" },
    rationale: { type: "string" },
    confidence: {
      type: "object",
      properties: {
        label: { type: "string", enum: ["High", "Moderate", "Limited"] },
        rationale: { type: "string" },
        evaluatedSignals: { type: "number", minimum: 0, maximum: 10 },
      },
      required: ["label", "rationale", "evaluatedSignals"],
      additionalProperties: false,
    },
    executiveSummary: {
      type: "array",
      items: {
        type: "object",
        properties: { title: { type: "string" }, body: { type: "string" } },
        required: ["title", "body"],
        additionalProperties: false,
      },
    },
    signals: {
      type: "array",
      items: {
        type: "object",
        properties: {
          signal: { type: "string" },
          assessment: { type: "string", enum: ["Strong", "Moderate", "Weak", "Unknown"] },
          evidence: { type: "string" },
        },
        required: ["signal", "assessment", "evidence"],
        additionalProperties: false,
      },
    },
    missingInfo: {
      type: "array",
      items: {
        type: "object",
        properties: { title: { type: "string" }, body: { type: "string" } },
        required: ["title", "body"],
        additionalProperties: false,
      },
    },
    recommendation: {
      type: "object",
      properties: {
        title: { type: "string" },
        body: { type: "string" },
        steps: { type: "array", items: { type: "string" } },
      },
      required: ["title", "body", "steps"],
      additionalProperties: false,
    },
    methodology: { type: "string" },
    assumptions: { type: "string" },
  },
  required: ["qualification", "score", "title", "rationale", "confidence", "executiveSummary", "signals", "missingInfo", "recommendation", "methodology", "assumptions"],
  additionalProperties: false,
} as const;

function budgetScore(monthlyBudget: LeadInput["monthlyBudget"]) {
  if (monthlyBudget === "$4,000–$8,000") return 24;
  if (monthlyBudget === "$8,000+") return 25;
  if (monthlyBudget === "$2,000–$4,000") return 17;
  return 7;
}

export function evaluateLeadLocally(lead: LeadInput): QualificationReport {
  const hasContext = Boolean(lead.targetMarket) && Boolean(lead.timeline) && Boolean(lead.seoChallenge);
  const highIntent = /provider|agency|growth|pipeline|lead|revenue|audit|fix/i.test(`${lead.businessGoal} ${lead.seoChallenge ?? ""}`);
  const score = Math.max(25, Math.min(94, 33 + budgetScore(lead.monthlyBudget) + (hasContext ? 17 : 4) + (highIntent ? 14 : 7)));
  const qualification = score >= 76 ? "HIGH" : score >= 52 ? "MEDIUM" : "LOW";
  const contextText = hasContext ? "The brief includes market, timeline and current SEO context." : "Several commercial and operational details remain unconfirmed.";
  const missingInfo = [
    !lead.seoChallenge && { title: "Current organic performance", body: "We do not yet know monthly organic traffic, conversion quality or existing channel contribution." },
    !lead.targetMarket && { title: "Target market", body: "The target geography or priority customer market has not been provided." },
    !lead.timeline && { title: "Decision timeline", body: "The expected start date and decision horizon have not been established." },
  ].filter(Boolean) as { title: string; body: string }[];

  return {
    qualification,
    score,
    title: qualification === "HIGH" ? "High-fit opportunity" : qualification === "MEDIUM" ? "Potentially viable opportunity" : "Low-fit opportunity",
    rationale: `${lead.serviceRequired} aligns with the defined SEO capability profile. ${contextText}`,
    confidence: { label: hasContext ? "High" : "Moderate", rationale: hasContext ? "Based on the supplied commercial, market and delivery context." : "Based on the essential lead details; deeper discovery would improve the assessment.", evaluatedSignals: hasContext ? 8 : 5 },
    executiveSummary: [
      { title: "Service alignment", body: `The requested ${lead.serviceRequired.toLowerCase()} engagement maps to the defined service profile.` },
      { title: "Commercial context", body: `The stated budget band is ${lead.monthlyBudget}.` },
      { title: "Business objective", body: `The lead is focused on ${lead.businessGoal.toLowerCase()}.` },
      { title: "Information quality", body: contextText },
    ],
    signals: [
      { signal: "Service Fit", assessment: "Strong", evidence: lead.serviceRequired },
      { signal: "Commercial Scope", assessment: lead.monthlyBudget === "Under $2,000" ? "Weak" : "Strong", evidence: lead.monthlyBudget },
      { signal: "Business Goal", assessment: "Strong", evidence: lead.businessGoal },
      { signal: "Market", assessment: lead.targetMarket ? "Strong" : "Unknown", evidence: lead.targetMarket || "Not provided" },
      { signal: "Timeline", assessment: lead.timeline ? "Moderate" : "Unknown", evidence: lead.timeline || "Not provided" },
      { signal: "SEO Context", assessment: lead.seoChallenge ? "Moderate" : "Unknown", evidence: lead.seoChallenge || "Not provided" },
      { signal: "Intent", assessment: highIntent ? "Strong" : "Moderate", evidence: highIntent ? "Goal and context indicate active evaluation." : "Intent is implied by the requested engagement." },
    ],
    missingInfo,
    recommendation: {
      title: qualification === "LOW" ? "Clarify fit before advancing" : "Schedule a discovery call",
      body: "Use the next conversation to establish current organic performance, confirm decision-making ownership and validate the commercial scope.",
      steps: ["Validate current SEO performance", "Confirm decision-maker", "Establish commercial scope"],
    },
    methodology: "The assessment compares stated lead requirements against a predefined SEO capability and ideal-customer profile, considering service alignment, commercial scope, market, business goal, timing, intent and information completeness.",
    assumptions: "This prototype assesses the information supplied in the form. It does not claim to predict conversion probability or infer data that has not been provided.",
  };
}

export async function qualifyLead(lead: LeadInput): Promise<QualificationReport> {
  const fallback = evaluateLeadLocally(lead);
  try {
    const catalog = await listLLMModels();
    const model = catalog.data.find((entry) => entry.id === "gpt-5-mini")?.id;
    const response = await invokeLLM({
      model,
      messages: [
        { role: "system", content: `You are a precise B2B SEO qualification analyst. ${capabilityProfile} Respond only with the required JSON. Use concise, professional analyst language. Any missing input must remain unknown; do not guess.` },
        { role: "user", content: `Evaluate this lead:\n${JSON.stringify(lead, null, 2)}` },
      ],
      response_format: { type: "json_schema", json_schema: { name: "seo_lead_qualification", strict: true, schema } },
    });
    const content = response.choices[0]?.message?.content;
    if (typeof content !== "string") return fallback;
    const report = JSON.parse(content) as QualificationReport;
    return { ...fallback, ...report, score: Math.max(0, Math.min(100, Math.round(report.score))) };
  } catch (error) {
    console.warn("[SEOSignal] AI qualification unavailable; using the defined assessment framework.", error);
    return fallback;
  }
}
