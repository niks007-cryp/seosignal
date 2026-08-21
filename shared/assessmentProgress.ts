export const ASSESSMENT_PROGRESS_CAP = 94;

/**
 * UI-only visual progress. It is intentionally capped below completion because
 * the browser has no reliable estimate of the pending network request duration.
 */
export function assessmentProgressAt(elapsedMs: number) {
  const elapsed = Math.max(0, elapsedMs);
  const visualProgress = 94 - 90 * Math.exp(-elapsed / 6_500);
  return Math.min(ASSESSMENT_PROGRESS_CAP, Math.max(4, Math.round(visualProgress)));
}
