import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type {
  PersonalizedTwinCapturePersistence,
  PersonalizedTwinCaptureStorage,
} from "./personalized-twin.capture.service";
import type { PersonalizedTwinTerminalStorage } from "./personalized-twin.terminalize.service";

const INPUT_BUCKET = "personalized-twin-private";
const MODEL_BUCKET = "personalized-twin-models";

function assertNoSupabaseError(error: { message: string } | null, code: string): void {
  if (error) throw new Error(`${code}:${error.message}`);
}

export const personalizedTwinSupabaseCapturePersistence: PersonalizedTwinCapturePersistence = {
  async createCaptureSet(input) {
    const { data, error } = await supabaseAdmin
      .from("personalized_twin_capture_sets")
      .insert({
        user_id: input.userId,
        status: "collecting",
        consent_version: input.consentVersion,
        consented_at: input.consentedAt,
      })
      .select("id")
      .single();
    assertNoSupabaseError(error, "PERSONALIZED_TWIN_CAPTURE_SET_CREATE_FAILED");
    if (!data) throw new Error("PERSONALIZED_TWIN_CAPTURE_SET_CREATE_EMPTY");
    return { id: data.id };
  },
  async addImageMetadata(input) {
    const { error } = await supabaseAdmin.from("personalized_twin_capture_images").insert({
      capture_set_id: input.captureSetId,
      user_id: input.userId,
      angle: input.angle,
      object_path: input.objectPath,
      content_type: input.contentType,
      byte_size: input.byteSize,
      sha256: input.sha256,
    });
    assertNoSupabaseError(error, "PERSONALIZED_TWIN_IMAGE_METADATA_FAILED");
  },
  async markReadyForProvider(input) {
    const { data, error } = await supabaseAdmin
      .from("personalized_twin_capture_sets")
      .update({ status: "ready_for_provider" })
      .eq("id", input.captureSetId)
      .eq("user_id", input.userId)
      .eq("status", "collecting")
      .select("id")
      .maybeSingle();
    assertNoSupabaseError(error, "PERSONALIZED_TWIN_CAPTURE_READY_FAILED");
    if (!data) throw new Error("PERSONALIZED_TWIN_CAPTURE_STATE_LOST");
  },
  async deleteCaptureSet(input) {
    const { error } = await supabaseAdmin
      .from("personalized_twin_capture_sets")
      .delete()
      .eq("id", input.captureSetId)
      .eq("user_id", input.userId);
    assertNoSupabaseError(error, "PERSONALIZED_TWIN_CAPTURE_DELETE_FAILED");
  },
};
export const personalizedTwinSupabaseCaptureStorage: PersonalizedTwinCaptureStorage = {
  async put(input) {
    const { error } = await supabaseAdmin.storage
      .from(INPUT_BUCKET)
      .upload(input.path, input.bytes, {
        contentType: input.contentType,
        upsert: false,
      });
    assertNoSupabaseError(error, "PERSONALIZED_TWIN_INPUT_UPLOAD_FAILED");
  },
  async remove(paths) {
    if (paths.length === 0) return;
    const { error } = await supabaseAdmin.storage.from(INPUT_BUCKET).remove([...paths]);
    assertNoSupabaseError(error, "PERSONALIZED_TWIN_INPUT_REMOVE_FAILED");
  },
};

export const personalizedTwinSupabaseTerminalStorage: PersonalizedTwinTerminalStorage = {
  async putModel(input) {
    const { error } = await supabaseAdmin.storage
      .from(MODEL_BUCKET)
      .upload(input.path, input.bytes, {
        contentType: "model/gltf-binary",
        upsert: false,
      });
    assertNoSupabaseError(error, "PERSONALIZED_TWIN_MODEL_UPLOAD_FAILED");
  },
  async removeInputs(paths) {
    await personalizedTwinSupabaseCaptureStorage.remove(paths);
  },
  async removeModels(paths) {
    if (paths.length === 0) return;
    const { error } = await supabaseAdmin.storage.from(MODEL_BUCKET).remove([...paths]);
    assertNoSupabaseError(error, "PERSONALIZED_TWIN_MODEL_REMOVE_FAILED");
  },
};
