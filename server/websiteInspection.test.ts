import { describe, expect, it } from "vitest";
import { inspectHomepage } from "./websiteInspection";

describe("homepage inspection", () => {
  it("fails safely rather than attempting a private-network request", async () => {
    await expect(inspectHomepage("http://127.0.0.1:3000")).resolves.toEqual({ status: "UNAVAILABLE" });
  });
});
