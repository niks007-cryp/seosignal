import { describe, expect, it } from "vitest";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

describe("Supabase credentials", () => {
  it.skipIf(!supabaseUrl || !serviceRoleKey)("authenticates with the project REST gateway", async () => {
    const response = await fetch(`${supabaseUrl!.replace(/\/$/, "")}/rest/v1/`, {
      headers: {
        apikey: serviceRoleKey!,
        Authorization: `Bearer ${serviceRoleKey!}`,
      },
      signal: AbortSignal.timeout(12_000),
    });

    expect([401, 403]).not.toContain(response.status);
  });
});
