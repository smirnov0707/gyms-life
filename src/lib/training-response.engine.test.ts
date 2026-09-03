import { describe, expect, it } from "vitest";
import { resolveTrainingResponseVolumeGuard } from "./training-response.engine";

function response(
  overrides: Partial<Parameters<typeof resolveTrainingResponseVolumeGuard>[0]> = {},
) {
  return {
    source: "user_reported" as const,
    available: true,
    ratedSessionsLast28Days: 4,
    latestFeeling: 2,
    averageFeelingLast28Days: 2.3,
    recentLowFeelingStreak: 3,
    ...overrides,
  };
}

describe("resolveTrainingResponseVolumeGuard", () => {
  it("does not infer a guard when the response source is unavailable", () => {
    expect(
      resolveTrainingResponseVolumeGuard(
        response({
          available: false,
          ratedSessionsLast28Days: 0,
          latestFeeling: null,
          averageFeelingLast28Days: null,
          recentLowFeelingStreak: 0,
        }),
      ),
    ).toMatchObject({ status: "not_active", volumeModifier: 1 });
  });

  it("does not react to fewer than four rated sessions", () => {
    expect(
      resolveTrainingResponseVolumeGuard(
        response({ ratedSessionsLast28Days: 3, recentLowFeelingStreak: 3 }),
      ),
    ).toMatchObject({ status: "not_active", volumeModifier: 1 });
  });

  it("temporarily reduces volume only after repeated difficult sessions", () => {
    expect(resolveTrainingResponseVolumeGuard(response())).toEqual({
      status: "temporary_reduced_volume",
      volumeModifier: 0.8,
      ratedSessionsLast28Days: 4,
      recentLowFeelingStreak: 3,
    });
  });

  it("does not react when the difficult-session streak has ended", () => {
    expect(
      resolveTrainingResponseVolumeGuard(response({ latestFeeling: 3, recentLowFeelingStreak: 0 })),
    ).toMatchObject({ status: "not_active", volumeModifier: 1 });
  });

  it("rejects an impossible response summary instead of inventing a guard", () => {
    expect(() =>
      resolveTrainingResponseVolumeGuard(response({ latestFeeling: 4, recentLowFeelingStreak: 1 })),
    ).toThrow("ends the low-feeling streak");
  });
});
