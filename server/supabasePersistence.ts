import type { LeadInput, QualificationReport } from "../shared/qualification";
import type { WebsiteInspection } from "./websiteInspection";

export class SupabasePersistenceError extends Error {}

function storedConfidence(label: QualificationReport["confidence"]["label"]) {
  return ({ High: "HIGH", Moderate: "MEDIUM", Limited: "LOW" } as const)[label];
}

async function request(path: string, init: RequestInit) {
  const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const baseUrl = configuredUrl?.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !serviceRoleKey) throw new SupabasePersistenceError("Supabase credentials are unavailable.");
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...init.headers,
    },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new SupabasePersistenceError(`Supabase persistence failed with ${response.status}.`);
  return response;
}

export async function persistQualification(input: { lead: LeadInput; inspection: WebsiteInspection; report: QualificationReport; model: string }) {
  const leads = await request("/rest/v1/leads", {
    method: "POST",
    body: JSON.stringify({
      company_name: input.lead.company,
      website: input.lead.website,
      service: input.lead.serviceRequired,
      budget_amount: input.lead.budgetAmount,
      budget_currency: input.lead.budgetCurrency,
      goal: input.lead.businessGoal,
      target_market: input.lead.targetMarket || null,
      timeline: input.lead.timeline || null,
      current_situation: input.lead.seoChallenge || null,
      website_inspection_status: input.inspection.status,
    }),
  });
  const savedLeads = await leads.json() as { id: string }[];
  const leadId = savedLeads[0]?.id;
  if (!leadId) throw new SupabasePersistenceError("Supabase did not return a lead id.");

  try {
    await request("/rest/v1/qualifications", {
      method: "POST",
      body: JSON.stringify({
        lead_id: leadId,
        qualification: input.report.qualification,
        score: input.report.score,
        confidence: storedConfidence(input.report.confidence.label),
        reasoning: input.report.rationale,
        factors: input.report.signals,
        missing_information: input.report.missingInfo,
        next_best_action: input.report.recommendation,
        model: input.model,
      }),
    });
  } catch (error) {
    try {
      await request(`/rest/v1/leads?id=eq.${encodeURIComponent(leadId)}`, {
        method: "DELETE",
        headers: { Prefer: "return=minimal" },
      });
    } catch {
      // Preserve the original qualification persistence error; the database's cascade
      // relationship handles linked rows if a later cleanup is needed.
    }
    throw error;
  }
  return { leadId };
}
