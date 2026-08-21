import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const ctx = {
  user: null,
  req: {},
  res: {},
} as unknown as TrpcContext;

describe("qualification.analyze", () => {
  it("rejects incomplete lead input before initiating an assessment", async () => {
    const caller = appRouter.createCaller(ctx);

    await expect(caller.qualification.analyze({
      company: "",
      website: "not-a-url",
      serviceRequired: "SEO strategy",
      budgetAmount: 5000,
      budgetCurrency: "USD",
      businessGoal: "Qualified leads",
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
