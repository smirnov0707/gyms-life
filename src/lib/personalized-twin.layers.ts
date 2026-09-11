import { z } from "zod";

export const TwinIdentityShellSchema = z.object({
  status: z.enum(["generic", "personalized"]),
  source: z.enum(["gyms_generic", "external_reconstruction"]),
  providerKey: z.string().min(1).nullable(),
  modelObjectPath: z.string().min(1).nullable(),
  visualIdentityOnly: z.literal(true),
  bodyGeometryAuthority: z.literal(false),
  medicalScan: z.literal(false),
});

export const TwinBodyGeometryEvidenceSchema = z.object({
  status: z.enum(["unknown", "observed", "estimated"]),
  source: z.enum(["none", "user_measurement", "device_measurement", "body_scan"]),
  providerKey: z.string().min(1).nullable(),
  measuredAt: z.string().datetime().nullable(),
  mayDriveBodyMetrics: z.boolean(),
  medicalScan: z.literal(false),
});

export type TwinIdentityShell = z.infer<typeof TwinIdentityShellSchema>;
export type TwinBodyGeometryEvidence = z.infer<typeof TwinBodyGeometryEvidenceSchema>;

export const PersonalizedTwinLayerBundleSchema = z.object({
  identity: TwinIdentityShellSchema,
  geometry: TwinBodyGeometryEvidenceSchema,
});

export type PersonalizedTwinLayerBundle = z.infer<typeof PersonalizedTwinLayerBundleSchema>;

export function buildPersonalizedTwinLayers(input: {
  identity: TwinIdentityShell;
  geometry: TwinBodyGeometryEvidence;
}): PersonalizedTwinLayerBundle {
  const parsed = PersonalizedTwinLayerBundleSchema.parse(input);
  if (parsed.geometry.status === "unknown" && parsed.geometry.mayDriveBodyMetrics) {
    throw new Error("PERSONALIZED_TWIN_UNKNOWN_GEOMETRY_CANNOT_DRIVE_METRICS");
  }
  if (parsed.geometry.source === "none" && parsed.geometry.status !== "unknown") {
    throw new Error("PERSONALIZED_TWIN_GEOMETRY_SOURCE_REQUIRED");
  }
  return parsed;
}
