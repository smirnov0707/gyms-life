import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  OfflineSyncRequestSchema,
  LegacyOwnershipRequestSchema,
  OwnerIdSchema,
  sameOfflineExecution,
  type OfflineSyncReply,
  type OfflineRetainedReason,
  type OfflineSyncRequest,
} from "./offline-contract";
import { recordOwnedWorkoutSet } from "./set-log.service";
import { resolvePerformedAt } from "./performed-at.engine";
const StoredSetSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  session_id: z.string().uuid(),
  exercise_slug: z.string(),
  set_number: z.number().int(),
  reps: z.number().finite().nullable(),
  weight_kg: z.number().finite().nullable(),
  rpe: z.number().finite().nullable(),
  done: z.boolean(),
  performed_at: z.string().datetime({ offset: true }).nullable(),
  created_at: z.string().datetime({ offset: true }),
});
const select =
  "id,user_id,session_id,exercise_slug,set_number,reps,weight_kg,rpe,done,performed_at,created_at";
function requireOwner(expected: string, authenticated: string) {
  OwnerIdSchema.parse(authenticated);
  if (expected !== authenticated) throw new Error("OFFLINE_IDENTITY_CHANGED");
}
/** Binding to the token's verified user happens before any DB read or mutation. */
export async function resolveLegacyOfflineOwnership(
  client: SupabaseClient<Database>,
  authenticated: string,
  raw: unknown,
) {
  const request = LegacyOwnershipRequestSchema.parse(raw);
  requireOwner(request.ownerId, authenticated);
  const { data, error } = await client
    .from("workout_sessions")
    .select("id")
    .eq("user_id", authenticated)
    .in("id", request.sessionIds);
  if (error || !data) throw new Error("OFFLINE_OWNERSHIP_UNAVAILABLE");
  const rows = z.array(z.object({ id: z.string().uuid() })).parse(data);
  if (rows.some((row) => !request.sessionIds.includes(row.id)))
    throw new Error("OFFLINE_OWNERSHIP_UNAVAILABLE");
  return { ownerId: authenticated, sessionIds: rows.map((row) => row.id) };
}
export async function synchronizeOfflineForOwner(
  client: SupabaseClient<Database>,
  authenticated: string,
  raw: unknown,
  now = new Date(),
): Promise<OfflineSyncReply> {
  const request = OfflineSyncRequestSchema.parse(raw);
  requireOwner(request.ownerId, authenticated);
  const input = request.data;
  const retained = (reason: OfflineRetainedReason): OfflineSyncReply => ({
    status: "retained",
    ownerId: authenticated,
    clientId: request.clientId,
    reason,
  });
  const readExisting = async () => {
    const { data, error } = await client
      .from("set_logs")
      .select(select)
      .eq("user_id", authenticated)
      .eq("session_id", input.sessionId)
      .eq("exercise_slug", input.exerciseSlug)
      .eq("set_number", input.setNumber)
      .maybeSingle();
    if (error) throw new Error("OFFLINE_SYNC_UNAVAILABLE");
    if (!data) return null;
    const row = StoredSetSchema.parse(data);
    if (row.user_id !== authenticated) throw new Error("OFFLINE_IDENTITY_CHANGED");
    return row;
  };
  const responseFor = (row: z.infer<typeof StoredSetSchema>): OfflineSyncReply => {
    const saved = {
      sessionId: row.session_id,
      exerciseSlug: row.exercise_slug,
      exerciseName: input.exerciseName,
      setNumber: row.set_number,
      reps: row.reps,
      weightKg: row.weight_kg,
      rpe: row.rpe,
      done: row.done,
      performedAt: row.performed_at ?? row.created_at,
    };
    return sameOfflineExecution(input, saved)
      ? {
          status: "acknowledged",
          ownerId: authenticated,
          clientId: request.clientId,
          serverSetId: row.id,
          data: saved,
        }
      : retained("conflict");
  };
  // A lost acknowledgement can be recovered after completion without reopening a session.
  const existing = await readExisting();
  if (existing) return responseFor(existing);
  const { data: session, error } = await client
    .from("workout_sessions")
    .select("id,finished_at")
    .eq("id", input.sessionId)
    .eq("user_id", authenticated)
    .maybeSingle();
  if (error) throw new Error("OFFLINE_SYNC_UNAVAILABLE");
  if (!session) return retained("session_unavailable");
  if (session.finished_at !== null) return retained("session_finished");
  if (resolvePerformedAt(input.performedAt, now).getTime() !== Date.parse(input.performedAt))
    return retained("performed_at_review");
  if (
    (input.reps !== null && input.reps > 100) ||
    (input.weightKg !== null && input.weightKg > 1000) ||
    (input.rpe !== null && input.rpe < 1)
  )
    return retained("invalid_measurement");
  await recordOwnedWorkoutSet(client, authenticated, input);
  const saved = await readExisting();
  if (!saved) throw new Error("OFFLINE_SYNC_UNCONFIRMED");
  return responseFor(saved);
}
