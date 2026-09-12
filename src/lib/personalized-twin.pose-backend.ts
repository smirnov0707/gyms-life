export type PersonalizedTwinPoseBackendKey = "manual_guide" | "mediapipe_tasks" | "movenet_tfjs";

export type PersonalizedTwinPoseBackend = {
  key: PersonalizedTwinPoseBackendKey;
  enabled: boolean;
  onDevice: boolean;
  externalMetrics: boolean | "unknown";
  review: "approved" | "metrics_review_required" | "model_license_and_network_review_required";
};

export const PERSONALIZED_TWIN_POSE_BACKENDS: readonly PersonalizedTwinPoseBackend[] = [
  {
    key: "manual_guide",
    enabled: true,
    onDevice: true,
    externalMetrics: false,
    review: "approved",
  },
  {
    key: "mediapipe_tasks",
    enabled: false,
    onDevice: true,
    externalMetrics: true,
    review: "metrics_review_required",
  },
  {
    key: "movenet_tfjs",
    enabled: false,
    onDevice: true,
    externalMetrics: "unknown",
    review: "model_license_and_network_review_required",
  },
];

export function activePersonalizedTwinPoseBackend(): PersonalizedTwinPoseBackend {
  const active = PERSONALIZED_TWIN_POSE_BACKENDS.find((backend) => backend.enabled);
  if (!active) {
    throw new Error("No approved Personalized Twin pose backend");
  }
  return active;
}
