import { z } from "zod";
import type { PersonalizedTwinProviderCapability } from "./personalized-twin.provider";

export const GuidedTwinScanStatusSchema = z.enum([
  "not_started",
  "preparing",
  "capturing",
  "captured_local",
  "awaiting_provider",
]);
export type GuidedTwinScanStatus = z.infer<typeof GuidedTwinScanStatusSchema>;

export type GuidedTwinScanState = {
  status: GuidedTwinScanStatus;
  progressPct: number;
  cameraPermission: "unknown" | "granted" | "denied";
  localCaptureReady: boolean;
  canSubmitToProvider: boolean;
};

export function buildGuidedTwinScanState(input: {
  started: boolean;
  capturing: boolean;
  captured: boolean;
  progressPct: number;
  cameraPermission: GuidedTwinScanState["cameraPermission"];
  capability: PersonalizedTwinProviderCapability | null;
}): GuidedTwinScanState {
  const progressPct = Math.max(0, Math.min(100, Math.round(input.progressPct)));
  const supportsGuidedVideo = input.capability?.captureModes.includes("guided_video") === true;
  const providerApproved =
    input.capability?.available === true && input.capability.privacyReview === "approved";
  const canSubmitToProvider = input.captured && supportsGuidedVideo && providerApproved;
  const status: GuidedTwinScanStatus = !input.started
    ? "not_started"
    : input.capturing
      ? "capturing"
      : input.captured
        ? canSubmitToProvider
          ? "awaiting_provider"
          : "captured_local"
        : "preparing";

  return {
    status,
    progressPct,
    cameraPermission: input.cameraPermission,
    localCaptureReady: input.captured,
    canSubmitToProvider,
  };
}
