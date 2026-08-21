export type WebsiteInspection = {
  status: "AVAILABLE" | "UNAVAILABLE";
  title?: string;
  metaDescription?: string;
  visibleText?: string;
  siteDescription?: string;
};

function isPrivateHostname(hostname: string) {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host === "::1" || host === "0.0.0.0") return true;
  if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host)) return true;
  const private172 = host.match(/^172\.(\d{1,3})\./);
  return Boolean(private172 && Number(private172[1]) >= 16 && Number(private172[1]) <= 31);
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function extractTag(html: string, pattern: RegExp) {
  const match = html.match(pattern);
  return match?.[1] ? decodeHtml(match[1].replace(/\s+/g, " ").trim()).slice(0, 500) : undefined;
}

export async function inspectHomepage(website: string): Promise<WebsiteInspection> {
  try {
    const url = new URL(website);
    if (url.protocol !== "https:" && url.protocol !== "http:") return { status: "UNAVAILABLE" };
    if (isPrivateHostname(url.hostname)) return { status: "UNAVAILABLE" };

    const response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(7_000),
      headers: { "User-Agent": "SEOSignal/1.0 website-inspection" },
    });
    const contentType = response.headers.get("content-type") ?? "";
    if (!response.ok || !contentType.includes("text/html")) return { status: "UNAVAILABLE" };

    const html = (await response.text()).slice(0, 100_000);
    const title = extractTag(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
    const metaDescription = extractTag(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i)
      ?? extractTag(html, /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["'][^>]*>/i);
    const visibleText = decodeHtml(
      html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
    ).slice(0, 1600);

    return {
      status: "AVAILABLE",
      title,
      metaDescription,
      visibleText,
      siteDescription: metaDescription ?? visibleText?.slice(0, 360),
    };
  } catch {
    return { status: "UNAVAILABLE" };
  }
}
