import { z } from "zod";

const MAX_MODEL_BYTES = 16 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 15_000;

export const PersonalizedTwinNetworkGateSchema = z.object({
  enabled: z.literal(true),
  allowedOrigin: z.string().url(),
});
export type PersonalizedTwinNetworkGate = z.infer<typeof PersonalizedTwinNetworkGateSchema>;

export function readPersonalizedTwinNetworkGate(
  env: NodeJS.ProcessEnv = process.env,
): PersonalizedTwinNetworkGate | null {
  if (env["PERSONALIZED_TWIN_PROVIDER_NETWORK_ENABLED"] !== "true") return null;
  const parsed = PersonalizedTwinNetworkGateSchema.safeParse({
    enabled: true,
    allowedOrigin: env["PERSONALIZED_TWIN_PROVIDER_ALLOWED_ORIGIN"],
  });
  return parsed.success ? parsed.data : null;
}

export function assertProviderUrlAllowed(url: string, gate: PersonalizedTwinNetworkGate): URL {
  const parsed = new URL(url);
  const allowed = new URL(gate.allowedOrigin);
  if (parsed.protocol !== "https:") throw new Error("PERSONALIZED_TWIN_PROVIDER_HTTPS_REQUIRED");
  if (parsed.origin !== allowed.origin)
    throw new Error("PERSONALIZED_TWIN_PROVIDER_ORIGIN_BLOCKED");
  return parsed;
}

export async function fetchPersonalizedTwinModel(input: {
  url: string;
  gate: PersonalizedTwinNetworkGate | null;
  fetchImpl?: typeof fetch;
}): Promise<Uint8Array> {
  if (!input.gate) throw new Error("PERSONALIZED_TWIN_PROVIDER_NETWORK_DISABLED");
  const url = assertProviderUrlAllowed(input.url, input.gate);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await (input.fetchImpl ?? fetch)(url, {
      method: "GET",
      redirect: "error",
      signal: controller.signal,
      headers: { Accept: "model/gltf-binary, application/octet-stream" },
    });
    if (!response.ok) throw new Error(`PERSONALIZED_TWIN_MODEL_FETCH_HTTP_${response.status}`);
    const type = response.headers.get("content-type")?.split(";")[0]?.trim();
    if (type !== "model/gltf-binary" && type !== "application/octet-stream")
      throw new Error("PERSONALIZED_TWIN_MODEL_CONTENT_TYPE_INVALID");
    const declared = Number(response.headers.get("content-length") ?? "0");
    if (Number.isFinite(declared) && declared > MAX_MODEL_BYTES)
      throw new Error("PERSONALIZED_TWIN_MODEL_TOO_LARGE");
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength === 0) throw new Error("PERSONALIZED_TWIN_MODEL_EMPTY");
    if (bytes.byteLength > MAX_MODEL_BYTES) throw new Error("PERSONALIZED_TWIN_MODEL_TOO_LARGE");
    return bytes;
  } finally {
    clearTimeout(timeout);
  }
}
