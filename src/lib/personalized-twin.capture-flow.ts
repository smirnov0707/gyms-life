import { z } from "zod";
import {
  PersonalizedTwinCaptureModeSchema,
  type PersonalizedTwinProviderCapability,
} from "./personalized-twin.provider";

export const PersonalizedTwinCaptureFlowSchema = z.object({
  localPrototypeMode: z.literal("three_view"),
  providerCaptureMode: PersonalizedTwinCaptureModeSchema.nullable(),
  currentUiCanSubmit: z.boolean(),
  requiresDifferentCapture: z.boolean(),
  externalProcessing: z.boolean(),
  privacyReviewApproved: z.boolean(),
});

export type PersonalizedTwinCaptureFlow = z.infer<typeof PersonalizedTwinCaptureFlowSchema>;

export function buildPersonalizedTwinCaptureFlow(
  capability: PersonalizedTwinProviderCapability | null,
): PersonalizedTwinCaptureFlow {
  const providerCaptureMode = capability?.captureModes[0] ?? null;
  const supportsThreeView = capability?.captureModes.includes("three_view") === true;
  const privacyReviewApproved = capability?.privacyReview === "approved";

  return PersonalizedTwinCaptureFlowSchema.parse({
    localPrototypeMode: "three_view",
    providerCaptureMode,
    currentUiCanSubmit:
      capability?.available === true && supportsThreeView && privacyReviewApproved,
    requiresDifferentCapture: capability !== null && !supportsThreeView,
    externalProcessing: capability?.externalProcessing === true,
    privacyReviewApproved,
  });
}
