export type PersonalizedTwinPosePrivacyGate = {
  allowed: boolean;
  reason: "metrics_review_required" | "approved";
};

/**
 * MediaPipe Tasks sends utilization/performance metrics externally.
 * Keep the detector fail-closed until that processing is explicitly approved
 * or the runtime is replaced by a verified telemetry-free implementation.
 */
export function personalizedTwinPosePrivacyGate(): PersonalizedTwinPosePrivacyGate {
  return {
    allowed: false,
    reason: "metrics_review_required",
  };
}

export async function createWhenPosePrivacyAllows<T>(
  gate: PersonalizedTwinPosePrivacyGate,
  create: () => Promise<T>,
): Promise<T | null> {
  if (!gate.allowed) return null;
  return create();
}
