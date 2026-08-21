import { afterEach, describe, expect, it, vi } from "vitest";
import type { QualificationReport } from "../shared/qualification";
import { persistQualification } from "./supabasePersistence";

const report: QualificationReport = {
  qualification: "HIGH",
  score: 82,
  title: "High-fit opportunity",
  rationale: "Clear fit.",
  confidence: { label: "High", rationale: "Complete context.", evaluatedSignals: 9 },
  executiveSummary: [],
  signals: [{ signal: "Service Fit", assessment: "Strong", evidence: "Aligned." }],
  missingInfo: [],
  recommendation: { title: "Schedule discovery", body: "Confirm scope.", steps: ["Confirm scope"] },
  methodology: "Method.",
  assumptions: "Assumptions.",
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Supabase persistence boundary", () => {
  it("writes linked lead and qualification records while preserving currency context", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co/rest/v1/");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-role-key");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: "lead-123" }]), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: "qualification-123" }]), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(persistQualification({
      lead: { company: "Northstar", website: "https://northstar.example", serviceRequired: "Technical SEO", budgetAmount: 250000, budgetCurrency: "INR", businessGoal: "Qualified leads" },
      inspection: { status: "UNAVAILABLE" },
      report,
      model: "gemini-3.6-flash",
    })).resolves.toEqual({ leadId: "lead-123" });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe("https://project.supabase.co/rest/v1/leads");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ budget_amount: 250000, budget_currency: "INR", website_inspection_status: "UNAVAILABLE" });
    expect(fetchMock.mock.calls[1][0]).toBe("https://project.supabase.co/rest/v1/qualifications");
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({ lead_id: "lead-123", score: 82, model: "gemini-3.6-flash" });
  });

  it("maps limited user-facing confidence to the valid stored LOW value", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co/rest/v1/");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-role-key");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: "lead-456" }]), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: "qualification-456" }]), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    await persistQualification({
      lead: { company: "Northstar", website: "https://northstar.example", serviceRequired: "Technical SEO", budgetAmount: 250000, budgetCurrency: "INR", businessGoal: "Qualified leads" },
      inspection: { status: "UNAVAILABLE" },
      report: { ...report, confidence: { ...report.confidence, label: "Limited" } },
      model: "gemini-3.6-flash",
    });

    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({ confidence: "LOW" });
  });

  it("removes the new lead when creating its linked qualification fails", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co/rest/v1/");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-role-key");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: "lead-cleanup" }]), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: "confidence constraint" }), { status: 400 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(persistQualification({
      lead: { company: "Northstar", website: "https://northstar.example", serviceRequired: "Technical SEO", budgetAmount: 250000, budgetCurrency: "INR", businessGoal: "Qualified leads" },
      inspection: { status: "UNAVAILABLE" },
      report,
      model: "gemini-3.6-flash",
    })).rejects.toBeInstanceOf(Error);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[2][0]).toBe("https://project.supabase.co/rest/v1/leads?id=eq.lead-cleanup");
    expect(fetchMock.mock.calls[2][1]).toMatchObject({ method: "DELETE" });
  });
});
