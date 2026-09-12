import type { TwinCaptureQuality } from "./personalized-twin.capture-quality";
import type { TwinFramingAssessment } from "./personalized-twin.framing";
import type { PersonalizedTwinProviderCapability } from "./personalized-twin.provider";
import type { TwinRotationProgress } from "./personalized-twin.rotation-progress";

export type PersonalizedTwinPreflightStatus =
  | "camera_missing"
  | "framing_not_ready"
  | "quality_not_ready"
  | "rotation_incomplete"
  | "provider_blocked"
  | "ready_for_provider";

export type PersonalizedTwinPreflight = {
  status: PersonalizedTwinPreflightStatus;
  localComplete: boolean;
  canSubmitToProvider: boolean;
};

export function buildPersonalizedTwinPreflight(input: {
  cameraActive: boolean;
  framing: TwinFramingAssessment;
  quality: TwinCaptureQuality;
  rotation: TwinRotationProgress;
  capability: PersonalizedTwinProviderCapability | null;
}): PersonalizedTwinPreflight {
  if (!input.cameraActive)
    return { status: "camera_missing", localComplete: false, canSubmitToProvider: false };
  if (input.framing.status !== "ready")
    return { status: "framing_not_ready", localComplete: false, canSubmitToProvider: false };
  if (!input.quality.canAdvanceRotation)
    return { status: "quality_not_ready", localComplete: false, canSubmitToProvider: false };
  if (!input.rotation.completeEstimate)
    return { status: "rotation_incomplete", localComplete: false, canSubmitToProvider: false };

  const providerReady =
    input.capability?.available === true &&
    input.capability.privacyReview === "approved" &&
    input.capability.captureModes.includes("guided_video");

  return providerReady
    ? { status: "ready_for_provider", localComplete: true, canSubmitToProvider: true }
    : { status: "provider_blocked", localComplete: true, canSubmitToProvider: false };
}
