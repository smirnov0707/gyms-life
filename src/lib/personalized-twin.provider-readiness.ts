import { z } from "zod";

export const PersonalizedTwinProviderSecretsSchema = z.object({
  apiBaseUrl: z.string().url(),
  apiToken: z.string().min(16),
  authHeader: z.string().min(1),
  submitPathTemplate: z.string().min(1),
  statusPathTemplate: z.string().min(1),
  modelPathTemplate: z.string().min(1),
  webhookSignatureHeader: z.string().min(1),
  webhookSecret: z.string().min(16),
});

export type PersonalizedTwinProviderSecrets = z.infer<typeof PersonalizedTwinProviderSecretsSchema>;

export const PERSONALIZED_TWIN_SIGNED_INPUT_TTL_SECONDS = 300;

export function assertSignedInputTtl(expiresAt: string, now = new Date()): void {
  const expires = new Date(expiresAt).getTime();
  const ttlMs = expires - now.getTime();
  if (!Number.isFinite(expires) || ttlMs <= 0)
    throw new Error("PERSONALIZED_TWIN_INPUT_URL_EXPIRED");
  if (ttlMs > PERSONALIZED_TWIN_SIGNED_INPUT_TTL_SECONDS * 1000)
    throw new Error("PERSONALIZED_TWIN_INPUT_URL_TTL_TOO_LONG");
}

export function readPersonalizedTwinProviderSecrets(env: NodeJS.ProcessEnv = process.env) {
  const candidate = {
    apiBaseUrl: env["THREEDLOOK_API_BASE_URL"],
    apiToken: env["THREEDLOOK_API_TOKEN"],
    authHeader: env["THREEDLOOK_AUTH_HEADER"],
    submitPathTemplate: env["THREEDLOOK_SUBMIT_PATH"],
    statusPathTemplate: env["THREEDLOOK_STATUS_PATH"],
    modelPathTemplate: env["THREEDLOOK_MODEL_PATH"],
    webhookSignatureHeader: env["THREEDLOOK_WEBHOOK_SIGNATURE_HEADER"],
    webhookSecret: env["THREEDLOOK_WEBHOOK_SECRET"],
  };
  const parsed = PersonalizedTwinProviderSecretsSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}
