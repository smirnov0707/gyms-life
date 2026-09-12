import { z } from "zod";
import { parsePersonalizedTwinProviderResponse } from "./personalized-twin.provider-response";

export const PersonalizedTwinWebhookEnvelopeSchema = z.object({
  eventId: z.string().min(1),
  providerJobId: z.string().min(1),
  payload: z.unknown(),
});

export type PersonalizedTwinWebhookVerifier = (input: {
  rawBody: Uint8Array;
  signature: string;
}) => boolean;

export function parseVerifiedPersonalizedTwinWebhook(input: {
  rawBody: Uint8Array;
  signature: string | null;
  verify: PersonalizedTwinWebhookVerifier;
}) {
  if (!input.signature) throw new Error("PERSONALIZED_TWIN_WEBHOOK_SIGNATURE_REQUIRED");
  if (!input.verify({ rawBody: input.rawBody, signature: input.signature }))
    throw new Error("PERSONALIZED_TWIN_WEBHOOK_SIGNATURE_INVALID");

  const json = JSON.parse(new TextDecoder().decode(input.rawBody)) as unknown;
  const envelope = PersonalizedTwinWebhookEnvelopeSchema.parse(json);
  return {
    eventId: envelope.eventId,
    providerJobId: envelope.providerJobId,
    result: parsePersonalizedTwinProviderResponse(envelope.payload),
  };
}
