import { describe, expect, it } from "vitest";
import { EnduranceExperimentSchema } from "./endurance-experiment.schema";
import { enduranceToPersonalExperiment } from "./endurance-experiment.adapter";
describe("endurance experiment adapter", () => {
  it("uses canonical Future Lab governance", () => {
    const e = EnduranceExperimentSchema.parse({
      variable: "long_run_weekday",
      hypothesis: "Moving long run may improve completion.",
      baselineValue: "Saturday",
      testValue: "Sunday",
      primaryMetric: "session_completion",
      durationWeeks: 4,
      startedOn: "2026-10-06",
    });
    const x = enduranceToPersonalExperiment(e);
    expect(x.governance.eligibleToRun).toBe(true);
    expect(x.governance.causalClaimAllowed).toBe(false);
    expect(x.governance.automaticPlanChangeAllowed).toBe(false);
  });
});
