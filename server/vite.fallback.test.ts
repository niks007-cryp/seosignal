import { describe, expect, it } from "vitest";
import { isHtmlNavigationRequest, isModuleLikeRequest } from "./_core/vite";

describe("isHtmlNavigationRequest", () => {
  it("allows a browser document navigation to receive the SPA shell", () => {
    expect(isHtmlNavigationRequest({ method: "GET", headers: { accept: "text/html,application/xhtml+xml" } } as never)).toBe(true);
  });

  it("rejects stale JavaScript module and API request fallbacks", () => {
    expect(isHtmlNavigationRequest({ method: "GET", headers: { accept: "*/*" } } as never)).toBe(false);
    expect(isHtmlNavigationRequest({ method: "POST", headers: { accept: "text/html" } } as never)).toBe(false);
  });

  it("identifies unresolved JavaScript module requests for dedicated tracing", () => {
    expect(isModuleLikeRequest({ method: "GET", originalUrl: "/src/missing-client-module.tsx?stale=1", headers: { accept: "*/*" } } as never)).toBe(true);
    expect(isModuleLikeRequest({ method: "GET", originalUrl: "/missing-route", headers: { accept: "text/html" } } as never)).toBe(false);
  });
});
