import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { qualifyLead } from "./qualification";
import { GeminiQualificationError } from "./geminiQualification";
import { inspectHomepage } from "./websiteInspection";
import { persistQualification, SupabasePersistenceError } from "./supabasePersistence";

const leadInput = z.object({
  company: z.string().min(2).max(120),
  website: z.string().url().max(500).refine((value) => /^https?:\/\//i.test(value), "Website must use http or https."),
  serviceRequired: z.enum(["SEO strategy", "Technical SEO", "Content SEO", "Enterprise SEO", "SEO audit"]),
  budgetAmount: z.number().positive().max(1_000_000_000),
  budgetCurrency: z.enum(["USD", "EUR", "GBP", "INR", "CAD", "AUD", "SGD", "AED", "CHF", "JPY"]),
  businessGoal: z.enum(["Qualified leads", "Organic revenue", "Market visibility", "Technical health"]),
  targetMarket: z.string().max(160).optional(),
  timeline: z.string().max(160).optional(),
  seoChallenge: z.string().max(1000).optional(),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  qualification: router({
    analyze: publicProcedure.input(leadInput).mutation(async ({ input }) => {
      const inspection = await inspectHomepage(input.website);
      try {
        const outcome = await qualifyLead(input, inspection);
        await persistQualification({ lead: input, inspection, report: outcome.report, model: outcome.model });
        return outcome.report;
      } catch (error) {
        if (error instanceof GeminiQualificationError || error instanceof SupabasePersistenceError) {
          console.warn("[SEOSignal] Qualification dependency failed:", error.name);
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Unable to complete the qualification right now. Please try again." });
        }
        console.error("[SEOSignal] Unexpected qualification error:", error instanceof Error ? error.name : "unknown");
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Unable to complete the qualification right now. Please try again." });
      }
    }),
  }),
});

export type AppRouter = typeof appRouter;
