import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { deletePersonalizedTwin } from "./personalized-twin.delete.service";
import { personalizedTwinSupabaseTerminalStorage } from "./personalized-twin.capture-supabase.server";
import { PersonalizedTwinLifecycleStatusSchema } from "./personalized-twin.lifecycle";
import type { PersonalizedTwinLifecycleSnapshot } from "./personalized-twin.presentation";

export async function loadLatestPersonalizedTwinLifecycle(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<PersonalizedTwinLifecycleSnapshot | null> {
  const { data, error } = await supabase
    .from("personalized_twin_capture_sets")
    .select("id,status,error_code,model_object_path,updated_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`PERSONALIZED_TWIN_LIFECYCLE_LOAD_FAILED:${error.message}`);
  if (!data) return null;
  let modelUrl: string | null = null;
  if (data.status === "ready" && data.model_object_path) {
    const { data: signed, error: signedError } = await supabaseAdmin.storage
      .from("personalized-twin-models")
      .createSignedUrl(data.model_object_path, 300);
    if (signedError) throw new Error(`PERSONALIZED_TWIN_MODEL_URL_FAILED:${signedError.message}`);
    modelUrl = signed?.signedUrl ?? null;
  }
  return {
    captureSetId: data.id,
    status: PersonalizedTwinLifecycleStatusSchema.parse(data.status),
    errorCode: data.error_code,
    hasModel: Boolean(data.model_object_path),
    modelUrl,
    updatedAt: data.updated_at,
  };
}

async function loadOwnedCapture(
  supabase: SupabaseClient<Database>,
  userId: string,
  captureSetId: string,
) {
  const { data: capture, error: captureError } = await supabase
    .from("personalized_twin_capture_sets")
    .select("id,user_id,status,model_object_path")
    .eq("id", captureSetId)
    .eq("user_id", userId)
    .maybeSingle();
  if (captureError)
    throw new Error(`PERSONALIZED_TWIN_DELETE_LOOKUP_FAILED:${captureError.message}`);
  if (!capture) return null;
  const { data: images, error: imageError } = await supabase
    .from("personalized_twin_capture_images")
    .select("object_path")
    .eq("capture_set_id", captureSetId)
    .eq("user_id", userId);
  if (imageError)
    throw new Error(`PERSONALIZED_TWIN_DELETE_INPUT_LOOKUP_FAILED:${imageError.message}`);
  return { capture, inputObjectPaths: (images ?? []).map((row) => row.object_path) };
}

export async function deleteOwnedPersonalizedTwin(
  supabase: SupabaseClient<Database>,
  userId: string,
  captureSetId: string,
): Promise<{ deleted: boolean }> {
  const owned = await loadOwnedCapture(supabase, userId, captureSetId);
  if (!owned) return { deleted: false };
  if (owned.capture.status === "processing")
    throw new Error("PERSONALIZED_TWIN_DELETE_PROCESSING_BLOCKED");

  return deletePersonalizedTwin({
    userId,
    captureSetId,
    persistence: {
      loadOwnedCapture: async () => ({
        captureSetId,
        userId,
        inputObjectPaths: owned.inputObjectPaths,
        modelObjectPath: owned.capture.model_object_path,
      }),
      deleteCaptureSet: async () => {
        const { error } = await supabaseAdmin
          .from("personalized_twin_capture_sets")
          .delete()
          .eq("id", captureSetId)
          .eq("user_id", userId);
        if (error) throw new Error(`PERSONALIZED_TWIN_DELETE_FAILED:${error.message}`);
      },
    },
    storage: personalizedTwinSupabaseTerminalStorage,
  });
}

export async function retryFailedPersonalizedTwin(
  supabase: SupabaseClient<Database>,
  userId: string,
  captureSetId: string,
): Promise<{ reset: boolean }> {
  const owned = await loadOwnedCapture(supabase, userId, captureSetId);
  if (!owned) return { reset: false };
  if (owned.capture.status !== "failed")
    throw new Error("PERSONALIZED_TWIN_RETRY_REQUIRES_FAILED_STATE");
  await deleteOwnedPersonalizedTwin(supabase, userId, captureSetId);
  return { reset: true };
}
