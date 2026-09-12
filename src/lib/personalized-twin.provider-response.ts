import { z } from "zod";

const ProcessingSchema = z.object({ status: z.literal("processing") });
const ReadySchema = z.object({
  status: z.literal("ready"),
  modelUrl: z.string().url(),
});
const FailedSchema = z.object({
  status: z.literal("failed"),
  errorCode: z.string().min(1),
});
export const PersonalizedTwinProviderResponseSchema = z.discriminatedUnion("status", [
  ProcessingSchema,
  ReadySchema,
  FailedSchema,
]);
export type PersonalizedTwinProviderResponse = z.infer<
  typeof PersonalizedTwinProviderResponseSchema
>;

export function parsePersonalizedTwinProviderResponse(
  value: unknown,
): PersonalizedTwinProviderResponse {
  return PersonalizedTwinProviderResponseSchema.parse(value);
}
