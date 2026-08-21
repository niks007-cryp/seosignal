export type WebsiteValidation =
  | { valid: true; value: string }
  | { valid: false; value: string; message: string };

/**
 * Makes the common bare-domain entry (for example, "company.com") usable by
 * the server contract while only allowing public HTTP(S) URLs through.
 */
export function normalizeWebsite(rawValue: string): WebsiteValidation {
  const value = rawValue.trim();
  if (!value) return { valid: false, value: "", message: "Enter a company website to continue." };

  const hasExplicitScheme = /^[a-z][a-z\d+.-]*:\/\//i.test(value);
  const candidate = hasExplicitScheme ? value : `https://${value}`;

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { valid: false, value, message: "Website must use http or https." };
    }
    if (!parsed.hostname) {
      return { valid: false, value, message: "Enter a complete website URL, such as company.com." };
    }
    return { valid: true, value: parsed.toString() };
  } catch {
    return { valid: false, value, message: "Enter a complete website URL, such as company.com." };
  }
}
