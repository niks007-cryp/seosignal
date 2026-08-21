import { describe, expect, it } from "vitest";
import { ASSESSMENT_PROGRESS_CAP, assessmentProgressAt } from "../shared/assessmentProgress";

describe("assessment progress UI helper", () => {
  it("starts at a visible minimum and progresses monotonically", () => {
    expect(assessmentProgressAt(0)).toBe(4);
    expect(assessmentProgressAt(3_000)).toBeGreaterThan(assessmentProgressAt(400));
    expect(assessmentProgressAt(9_000)).toBeGreaterThan(assessmentProgressAt(3_000));
  });

  it("never represents an incomplete request as 100 percent", () => {
    expect(assessmentProgressAt(60_000)).toBeLessThan(100);
    expect(assessmentProgressAt(60_000)).toBeLessThanOrEqual(ASSESSMENT_PROGRESS_CAP);
  });
});
