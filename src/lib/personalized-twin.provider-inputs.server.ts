import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { PersonalizedTwinProviderInput } from "./personalized-twin.provider";
import { PERSONALIZED_TWIN_SIGNED_INPUT_TTL_SECONDS } from "./personalized-twin.provider-readiness";

const INPUT_BUCKET = "personalized-twin-private";
const REQUIRED = ["front", "side", "back"] as const;

export async function issuePersonalizedTwinProviderInputs(input: {
  userId: string;
  captureSetId: string;
  now?: () => Date;
}): Promise<readonly PersonalizedTwinProviderInput[]> {
  const { data: captureSet, error: captureError } = await supabaseAdmin
    .from("personalized_twin_capture_sets")
    .select("id")
    .eq("id", input.captureSetId)
    .eq("user_id", input.userId)
    .eq("status", "ready_for_provider")
    .maybeSingle();
  if (captureError)
    throw new Error(`PERSONALIZED_TWIN_CAPTURE_LOOKUP_FAILED:${captureError.message}`);
  if (!captureSet) throw new Error("PERSONALIZED_TWIN_CAPTURE_NOT_READY_FOR_PROVIDER");

  const { data, error } = await supabaseAdmin
    .from("personalized_twin_capture_images")
    .select("angle, object_path")
    .eq("capture_set_id", input.captureSetId)
    .eq("user_id", input.userId);
  if (error) throw new Error(`PERSONALIZED_TWIN_INPUT_LOOKUP_FAILED:${error.message}`);

  const byAngle = new Map((data ?? []).map((row) => [row.angle, row.object_path] as const));
  if (data?.length !== 3 || REQUIRED.some((angle) => !byAngle.has(angle)))
    throw new Error("PERSONALIZED_TWIN_PROVIDER_INPUTS_REQUIRED");

  const now = (input.now ?? (() => new Date()))();
  const expiresAt = new Date(
    now.getTime() + PERSONALIZED_TWIN_SIGNED_INPUT_TTL_SECONDS * 1000,
  ).toISOString();
  const result: PersonalizedTwinProviderInput[] = [];
  for (const angle of REQUIRED) {
    const path = byAngle.get(angle);
    if (!path) throw new Error("PERSONALIZED_TWIN_PROVIDER_INPUTS_REQUIRED");
    const { data: signed, error: signError } = await supabaseAdmin.storage
      .from(INPUT_BUCKET)
      .createSignedUrl(path, PERSONALIZED_TWIN_SIGNED_INPUT_TTL_SECONDS);
    if (signError || !signed?.signedUrl)
      throw new Error(`PERSONALIZED_TWIN_INPUT_SIGN_FAILED:${signError?.message ?? "empty"}`);
    result.push({ angle, url: signed.signedUrl, expiresAt });
  }
  return result;
}
