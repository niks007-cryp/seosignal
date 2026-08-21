import { z } from "zod";
import type { LeadInput } from "../shared/qualification";
import { QUALIFICATION_CONFIG, type AiRating, type FactorKey } from "./qualification-config";
import type { WebsiteInspection } from "./websiteInspection";

const ratingSchema = z.enum(["STRONG", "MODERATE", "WEAK", "UNKNOWN"]);
const factorSchema = z.object({ rating: ratingSchema, reason: z.string().min(1).max(420) });

export const geminiQualificationSchema = z.object({
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

export type GeminiQualification = z.infer<typeof geminiQualificationSchema>;

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

export class GeminiQualificationError extends Error {}

function delay(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

export async function analyzeWithGemini(lead: LeadInput, inspection: WebsiteInspection): Promise<GeminiQualification> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new GeminiQualificationError("Gemini credentials are unavailable.");

  const prompt = `You are an evidence-led B2B SEO lead analyst. Assess only the supplied lead and homepage inspection. Never invent facts, exchange rates, or client outcomes. Use UNKNOWN for unsupported conclusions. Your factor names and ratings must exactly match the output schema. The server independently calculates the final score from the factor ratings, explicit weights, thresholds and hard disqualifiers.

Qualification framework: service fit 20%, ICP/company fit 15%, budget fit 15%, geographic/market fit 10%, business-objective fit 10%, SEO use-case fit 10%, timeline fit 5%, buying intent 5%, goal clarity 5%, information completeness 5%. HIGH is 75-100, MEDIUM 50-74, LOW 0-49. A request for meaningful SEO results in less than 30 days must be WEAK for timeline. Do not calculate or convert between currencies.

Lead input:
${JSON.stringify(lead)}

Homepage inspection status: ${inspection.status}
Homepage title: ${inspection.title ?? "Unavailable"}
Homepage meta description: ${inspection.metaDescription ?? "Unavailable"}
Homepage visible text excerpt: ${inspection.visibleText ?? "Unavailable"}`;

  let response: Response | undefined;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${QUALIFICATION_CONFIG.geminiModel}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.15, responseMimeType: "application/json", responseJsonSchema },
        }),
        signal: AbortSignal.timeout(22_000),
      });
    } catch {
      if (attempt === 0) { await delay(350); continue; }
      throw new GeminiQualificationError("Gemini request failed.");
    }
    if (response.ok) break;
    const transient = response.status === 429 || response.status >= 500;
    if (transient && attempt === 0) { await delay(350); continue; }
    throw new GeminiQualificationError(`Gemini returned ${response.status}.`);
  }
  if (!response?.ok) throw new GeminiQualificationError("Gemini request failed.");

  const payload = await response.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const content = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("");
  if (!content) throw new GeminiQualificationError("Gemini returned no structured content.");
  try {
    return geminiQualificationSchema.parse(JSON.parse(content));
  } catch {
    throw new GeminiQualificationError("Gemini returned malformed structured content.");
  }
}

export function ratingToAssessment(rating: AiRating) {
  return ({ STRONG: "Strong", MODERATE: "Moderate", WEAK: "Weak", UNKNOWN: "Unknown" } as const)[rating];
}

export function factorEntries(factors: GeminiQualification["factors"]) {
  return Object.entries(factors) as [FactorKey, { rating: AiRating; reason: string }][];
}
