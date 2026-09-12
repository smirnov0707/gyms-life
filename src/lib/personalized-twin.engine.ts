import {
  PERSONALIZED_TWIN_REQUIRED_ANGLES,
  PersonalizedTwinPreparationSchema,
  type PersonalizedTwinAngle,
  type PersonalizedTwinPreparation,
} from "./personalized-twin.schema";

export function buildPersonalizedTwinPreparation(input: {
  capturedAngles: readonly PersonalizedTwinAngle[];
  consentGranted: boolean;
  providerAvailable: boolean;
}): PersonalizedTwinPreparation {
  const capturedAngles = PERSONALIZED_TWIN_REQUIRED_ANGLES.filter((angle) =>
    input.capturedAngles.includes(angle),
  );
  const missingAngles = PERSONALIZED_TWIN_REQUIRED_ANGLES.filter(
    (angle) => !capturedAngles.includes(angle),
  );

  const complete = missingAngles.length === 0;
  const status =
    capturedAngles.length === 0
      ? "not_started"
      : !complete
        ? "collecting"
        : !input.consentGranted
          ? "awaiting_consent"
          : input.providerAvailable
            ? "ready_for_provider"
            : "provider_unavailable";

  return PersonalizedTwinPreparationSchema.parse({
    status,
    capturedAngles,
    missingAngles,
    consentGranted: input.consentGranted,
    providerAvailable: input.providerAvailable,
    canStartReconstruction: complete && input.consentGranted && input.providerAvailable,
    medicalScan: false,
  });
}
