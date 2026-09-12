import { describe, expect, it } from "vitest";
import {
  activePersonalizedTwinPoseBackend,
  PERSONALIZED_TWIN_POSE_BACKENDS,
} from "./personalized-twin.pose-backend";

describe("Personalized Twin pose backends", () => {
  it("keeps only the privacy-safe manual guide active", () => {
    expect(PERSONALIZED_TWIN_POSE_BACKENDS.filter((backend) => backend.enabled)).toHaveLength(1);
    expect(activePersonalizedTwinPoseBackend()).toMatchObject({
      key: "manual_guide",
      externalMetrics: false,
      review: "approved",
    });
  });

  it("keeps reviewed ML backends disabled until their blockers are cleared", () => {
    expect(PERSONALIZED_TWIN_POSE_BACKENDS.find((b) => b.key === "mediapipe_tasks")).toMatchObject({
      enabled: false,
      externalMetrics: true,
    });
    expect(PERSONALIZED_TWIN_POSE_BACKENDS.find((b) => b.key === "movenet_tfjs")).toMatchObject({
      enabled: false,
      review: "model_license_and_network_review_required",
    });
  });
});
