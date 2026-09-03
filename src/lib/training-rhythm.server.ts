import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  TrainingRhythmInputSchema,
  trainingRhythmFromDatabaseRow,
  type TrainingRhythm,
  type TrainingRhythmInput,
} from "./training-rhythm.schema";

/** Loads only the caller's narrow, validated rhythm preference through RLS. */
export async function loadTrainingRhythm(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<TrainingRhythm | null> {
  const { data, error } = await supabase
    .from("training_rhythms")
    .select("preferred_weekdays, updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error("Training rhythm lookup failed.");
  return data === null ? null : trainingRhythmFromDatabaseRow(data);
}

/**
 * Writes via the server-owned service role after authenticated middleware has
 * established the user id. Browser clients keep read-only access to this
 * preference, so no client can forge a rhythm for another athlete.
 */
export async function saveTrainingRhythm(
  userId: string,
  input: TrainingRhythmInput,
  now = new Date(),
): Promise<TrainingRhythm> {
  const rhythm = TrainingRhythmInputSchema.parse(input);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("training_rhythms")
    .upsert(
      {
        user_id: userId,
        preferred_weekdays: rhythm.preferredWeekdays,
        updated_at: now.toISOString(),
      },
      { onConflict: "user_id" },
    )
    .select("preferred_weekdays, updated_at")
    .single();

  if (error) throw new Error("Could not save training rhythm.");
  return trainingRhythmFromDatabaseRow(data);
}

/** Removes the optional preference without touching a user's plan or history. */
export async function clearTrainingRhythm(userId: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("training_rhythms").delete().eq("user_id", userId);
  if (error) throw new Error("Could not clear training rhythm.");
}
