import { z } from "zod";

export const PersonalizedTwinCaptureModeSchema = z.enum(["three_view", "guided_video"]);
export const PersonalizedTwinProviderCandidateSchema = z.enum([
  "in3d",
  "3dlook",
  "avatar_sdk",
  "meshy",
]);

export const PersonalizedTwinProviderCapabilitySchema = z.object({
  available: z.boolean(),
  providerKey: z.string().min(1).nullable(),
  candidate: PersonalizedTwinProviderCandidateSchema.nullable(),
  captureModes: z.array(PersonalizedTwinCaptureModeSchema).min(1),
  outputFormat: z.literal("glb"),
  externalProcessing: z.boolean(),
  privacyReview: z.enum(["not_started", "requires_contract", "approved"]),
  medicalScan: z.literal(false),
});

export type PersonalizedTwinProviderCapability = z.infer<
  typeof PersonalizedTwinProviderCapabilitySchema
>;

/**
 * Provider-neutral reconstruction port. Implementations belong server-side only.
 * Input photos must never be sent to a provider without explicit capture-set consent.
 */
export interface PersonalizedTwinReconstructionProvider {
  readonly key: string;
  submit(input: {
    userId: string;
    captureSetId: string;
    frontObjectPath: string;
    sideObjectPath: string;
    backObjectPath: string;
  }): Promise<{ providerJobId: string }>;
  poll(
    providerJobId: string,
  ): Promise<
    | { status: "processing" }
    | { status: "ready"; modelBytes: Uint8Array; contentType: "model/gltf-binary" }
    | { status: "failed"; errorCode: string }
  >;
}

/** No provider is configured until a reviewed adapter is explicitly wired here. */
export function personalizedTwinProviderCapability(): PersonalizedTwinProviderCapability {
  return PersonalizedTwinProviderCapabilitySchema.parse({
    available: false,
    providerKey: null,
    candidate: "in3d",
    captureModes: ["guided_video"],
    outputFormat: "glb",
    externalProcessing: true,
    privacyReview: "requires_contract",
    medicalScan: false,
  });
}
