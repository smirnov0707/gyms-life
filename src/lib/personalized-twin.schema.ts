import { z } from "zod";

export const PersonalizedTwinAngleSchema = z.enum(["front", "side", "back"]);
export type PersonalizedTwinAngle = z.infer<typeof PersonalizedTwinAngleSchema>;

export const PERSONALIZED_TWIN_REQUIRED_ANGLES = ["front", "side", "back"] as const;

export const PersonalizedTwinPreparationSchema = z.object({
  status: z.enum([
    "not_started",
    "collecting",
    "awaiting_consent",
    "ready_for_provider",
    "provider_unavailable",
  ]),
  capturedAngles: z.array(PersonalizedTwinAngleSchema),
  missingAngles: z.array(PersonalizedTwinAngleSchema),
  consentGranted: z.boolean(),
  providerAvailable: z.boolean(),
  canStartReconstruction: z.boolean(),
  medicalScan: z.literal(false),
});

export type PersonalizedTwinPreparation = z.infer<typeof PersonalizedTwinPreparationSchema>;
