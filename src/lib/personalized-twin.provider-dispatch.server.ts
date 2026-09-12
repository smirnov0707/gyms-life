import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { acceptPersonalizedTwinProviderResult } from "./personalized-twin.provider-result.service";
import { personalizedTwinSupabaseResultPersistence } from "./personalized-twin.provider-supabase.server";
import { personalizedTwinSupabaseTerminalStorage } from "./personalized-twin.capture-supabase.server";
import type { PersonalizedTwinProviderResponse } from "./personalized-twin.provider-response";

export type PersonalizedTwinModelFetcher = (url: string) => Promise<Uint8Array>;

export async function lookupPersonalizedTwinProviderJob(
  providerKey: string,
  providerJobId: string,
) {
  const { data, error } = await supabaseAdmin
    .from("personalized_twin_capture_sets")
    .select("id, user_id, status")
    .eq("provider_key", providerKey)
    .eq("provider_job_id", providerJobId)
    .maybeSingle();
  if (error) throw new Error(`PERSONALIZED_TWIN_PROVIDER_JOB_LOOKUP_FAILED:${error.message}`);
  if (!data) throw new Error("PERSONALIZED_TWIN_PROVIDER_JOB_NOT_FOUND");

  const { data: images, error: imagesError } = await supabaseAdmin
    .from("personalized_twin_capture_images")
    .select("object_path")
    .eq("capture_set_id", data.id)
    .eq("user_id", data.user_id);
  if (imagesError)
    throw new Error(`PERSONALIZED_TWIN_PROVIDER_INPUT_LOOKUP_FAILED:${imagesError.message}`);
  return {
    captureSetId: data.id,
    userId: data.user_id,
    status: data.status,
    rawInputPaths: (images ?? []).map((row) => row.object_path),
  };
}

export async function dispatchPersonalizedTwinProviderWebhook(input: {
  providerKey: string;
  providerJobId: string;
  eventId: string;
  response: PersonalizedTwinProviderResponse;
  fetchModel: PersonalizedTwinModelFetcher;
}) {
  if (input.response.status === "processing") return "processing" as const;
  const job = await lookupPersonalizedTwinProviderJob(input.providerKey, input.providerJobId);
  const result =
    input.response.status === "failed"
      ? { status: "failed" as const, errorCode: input.response.errorCode }
      : {
          status: "ready" as const,
          modelBytes: await input.fetchModel(input.response.modelUrl),
          contentType: "model/gltf-binary" as const,
        };
  return acceptPersonalizedTwinProviderResult({
    userId: job.userId,
    captureSetId: job.captureSetId,
    providerKey: input.providerKey,
    providerJobId: input.providerJobId,
    eventKey: input.eventId,
    rawInputPaths: job.rawInputPaths,
    result,
    persistence: personalizedTwinSupabaseResultPersistence,
    storage: personalizedTwinSupabaseTerminalStorage,
  });
}
