import { describe, expect, it } from "vitest";

const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const projectRef = projectUrl ? new URL(projectUrl).hostname.split(".")[0] : undefined;

describe("Supabase Management API credential", () => {
  it.skipIf(!accessToken || !projectRef)("can read the configured project", async () => {
    const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}`, {
      headers: { Authorization: `Bearer ${accessToken!}` },
      signal: AbortSignal.timeout(12_000),
    });

    expect(response.ok).toBe(true);
    const project = (await response.json()) as { ref?: string };
    expect(project.ref).toBe(projectRef);
  });
});
