import { z } from "zod";

export const PersonalizedTwinProviderCapabilitySchema = z.object({
  available: z.boolean(),
  providerKey: z.string().min(1).nullable(),
  supportsThreeView: z.boolean(),
  outputFormat: z.literal("glb"),
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
    supportsThreeView: true,
    outputFormat: "glb",
    medicalScan: false,
  });
}
