import { z } from "zod";
import type { LeadInput } from "../shared/qualification";
import { QUALIFICATION_CONFIG, type AiRating, type FactorKey } from "./qualification-config";
import type { WebsiteInspection } from "./websiteInspection";

const ratingSchema = z.enum(["STRONG", "MODERATE", "WEAK", "UNKNOWN"]);
const factorSchema = z.object({ rating: ratingSchema, reason: z.string().min(1).max(420) });

export const groqQualificationSchema = z.object({
  qualification: z.enum(["HIGH", "MEDIUM", "LOW"]),
  score: z.number().min(0).max(100),
  confidence: z.enum(["HIGH", "MEDIUM", "LOW"]),
  reasoning: z.string().min(1).max(900),
  factors: z.object({
    service_fit: factorSchema,
    icp_fit: factorSchema,
    budget_fit: factorSchema,
    geographic_fit: factorSchema,
    business_objective_fit: factorSchema,
    use_case_fit: factorSchema,
    timeline_fit: factorSchema,
    buying_intent: factorSchema,
    goal_clarity: factorSchema,
    information_completeness: factorSchema,
  }),
  missing_information: z.array(z.string().min(1).max(300)).max(6),
  next_best_action: z.object({ title: z.string().min(1).max(120), body: z.string().min(1).max(420), steps: z.array(z.string().min(1).max(180)).min(1).max(4) }),
});

export type GroqQualification = z.infer<typeof groqQualificationSchema>;

const responseJsonSchema = {
  type: "object",
  properties: {
    qualification: { type: "string", enum: ["HIGH", "MEDIUM", "LOW"] },
    score: { type: "number" },
    confidence: { type: "string", enum: ["HIGH", "MEDIUM", "LOW"] },
    reasoning: { type: "string" },
    factors: {
      type: "object",
      properties: Object.fromEntries(
        Object.keys(QUALIFICATION_CONFIG.weights).map((key) => [key, {
          type: "object",
          properties: { rating: { type: "string", enum: ["STRONG", "MODERATE", "WEAK", "UNKNOWN"] }, reason: { type: "string" } },
          required: ["rating", "reason"],
          additionalProperties: false,
        }]),
      ),
      required: Object.keys(QUALIFICATION_CONFIG.weights),
      additionalProperties: false,
    },
    missing_information: { type: "array", items: { type: "string" } },
    next_best_action: {
      type: "object",
      properties: { title: { type: "string" }, body: { type: "string" }, steps: { type: "array", items: { type: "string" } } },
      required: ["title", "body", "steps"],
      additionalProperties: false,
    },
  },
  required: ["qualification", "score", "confidence", "reasoning", "factors", "missing_information", "next_best_action"],
  additionalProperties: false,
} as const;

export type GroqQualificationFailure = "CREDENTIALS" | "RATE_LIMITED" | "REQUEST" | "RESPONSE";

export class GroqQualificationError extends Error {
  constructor(message: string, public readonly failure: GroqQualificationFailure = "REQUEST") {
    super(message);
    this.name = "GroqQualificationError";
  }
}

function delay(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

function buildMessages(lead: LeadInput, inspection: WebsiteInspection) {
  const system = "You are an evidence-led B2B SEO lead analyst. Assess only the supplied lead and homepage inspection. Never invent facts, exchange rates, or client outcomes. Use UNKNOWN for unsupported conclusions. Your factor names and ratings must exactly match the output schema. The server independently calculates the final score from factor ratings, explicit weights, thresholds, and hard disqualifiers.";
  const user = `Qualification framework: service fit 20%, ICP/company fit 15%, budget fit 15%, geographic/market fit 10%, business-objective fit 10%, SEO use-case fit 10%, timeline fit 5%, buying intent 5%, goal clarity 5%, information completeness 5%. HIGH is 75-100, MEDIUM 50-74, LOW 0-49. A request for meaningful SEO results in less than 30 days must be WEAK for timeline. Do not calculate or convert between currencies.

Lead input:
${JSON.stringify(lead)}

Homepage inspection status: ${inspection.status}
Homepage title: ${inspection.title ?? "Unavailable"}
Homepage meta description: ${inspection.metaDescription ?? "Unavailable"}
Homepage visible text excerpt: ${inspection.visibleText ?? "Unavailable"}`;
  return [{ role: "system", content: system }, { role: "user", content: user }] as const;
}

export async function analyzeWithGroq(lead: LeadInput, inspection: WebsiteInspection): Promise<GroqQualification> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new GroqQualificationError("Groq credentials are unavailable.", "CREDENTIALS");

  let response: Response | undefined;
  const maximumAttempts = 3;
  for (let attempt = 0; attempt < maximumAttempts; attempt += 1) {
    try {
      response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: QUALIFICATION_CONFIG.groqModel,
          messages: buildMessages(lead, inspection),
          temperature: 0.15,
          reasoning_effort: "low",
          response_format: {
            type: "json_schema",
            json_schema: { name: "seo_lead_qualification", strict: true, schema: responseJsonSchema },
          },
        }),
        signal: AbortSignal.timeout(22_000),
      });
    } catch {
      if (attempt < maximumAttempts - 1) { await delay(400 * (attempt + 1)); continue; }
      throw new GroqQualificationError("Groq request failed.", "REQUEST");
    }
    if (response.ok) break;
    const transient = response.status === 429 || response.status >= 500;
    if (transient && attempt < maximumAttempts - 1) {
      const retryAfterSeconds = Number(response.headers.get("retry-after"));
      const retryDelay = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
        ? Math.min(retryAfterSeconds * 1_000, 3_000)
        : 400 * (attempt + 1);
      await delay(retryDelay);
      continue;
    }
    throw new GroqQualificationError(`Groq returned ${response.status}.`, response.status === 429 ? "RATE_LIMITED" : "RESPONSE");
  }
  if (!response?.ok) throw new GroqQualificationError("Groq request failed.", "REQUEST");

  const payload = await response.json() as { choices?: { message?: { content?: string | null } }[] };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new GroqQualificationError("Groq returned no structured content.", "RESPONSE");
  try {
    return groqQualificationSchema.parse(JSON.parse(content));
  } catch (error) {
    const detail = error instanceof z.ZodError
      ? error.issues.map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`).join("; ")
      : "invalid JSON";
    console.warn("[SEOSignal] Groq structured output rejected:", detail);
    throw new GroqQualificationError("Groq returned malformed structured content.", "RESPONSE");
  }
}

export function ratingToAssessment(rating: AiRating) {
  return ({ STRONG: "Strong", MODERATE: "Moderate", WEAK: "Weak", UNKNOWN: "Unknown" } as const)[rating];
}

export function factorEntries(factors: GroqQualification["factors"]) {
  return Object.entries(factors) as [FactorKey, { rating: AiRating; reason: string }][];
}
