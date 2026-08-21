import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { qualifyLead } from "./qualification";

const leadInput = z.object({
  company: z.string().min(2).max(120),
  website: z.string().url().max(500),
  serviceRequired: z.enum(["SEO strategy", "Technical SEO", "Content SEO", "Enterprise SEO", "SEO audit"]),
  monthlyBudget: z.enum(["Under $2,000", "$2,000–$4,000", "$4,000–$8,000", "$8,000+"]),
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
    analyze: publicProcedure.input(leadInput).mutation(({ input }) => qualifyLead(input)),
  }),
});

export type AppRouter = typeof appRouter;
