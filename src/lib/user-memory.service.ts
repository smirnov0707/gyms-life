import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import {
  CorrectUserMemoryInputSchema,
  parseUserMemoryTransparencyItems,
  type UserMemoryTransparencyItem,
} from "./user-memory.schema";

const UserMemoryIdSchema = z.string().uuid();

function activeMemoryQuery(supabase: SupabaseClient<Database>, userId: string, now: Date) {
  return supabase
    .from("user_memory")
    .select(
      "id, memory_type, content, source, confidence, importance, status, evidence_refs, last_confirmed_at, expires_at",
    )
    .eq("user_id", userId)
    .eq("status", "active")
    .or(`expires_at.is.null,expires_at.gt.${now.toISOString()}`)
    .order("importance", { ascending: false })
    .order("last_confirmed_at", { ascending: false })
    .limit(50);
}

/** Lists only the user's live, validated memory entries for transparency. */
export async function loadUserMemoryTransparency(
  supabase: SupabaseClient<Database>,
  userId: string,
  now = new Date(),
): Promise<UserMemoryTransparencyItem[]> {
  const { data, error } = await activeMemoryQuery(supabase, userId, now);
  if (error) throw new Error("Could not load user memory.");
  return parseUserMemoryTransparencyItems(data);
}

async function requireOwnedActiveMemory(
  supabase: SupabaseClient<Database>,
  userId: string,
  memoryId: string,
): Promise<string> {
  const id = UserMemoryIdSchema.parse(memoryId);
  const { data, error } = await supabase
    .from("user_memory")
    .select("id")
    .eq("id", id)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  if (error || data === null) throw new Error("Memory entry was not found.");
  return id;
}

/** Keeps an audit trail while ensuring an explicitly rejected memory is never used again. */
export async function markUserMemoryIncorrect(
  supabase: SupabaseClient<Database>,
  userId: string,
  memoryId: string,
): Promise<void> {
  const id = await requireOwnedActiveMemory(supabase, userId, memoryId);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_memory")
    .update({ status: "incorrect", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId)
    .eq("status", "active")
    .select("id")
    .maybeSingle();
  if (error || data === null) throw new Error("Could not mark memory as incorrect.");
}

/**
 * Replaces an active non-context memory atomically. The database keeps the
 * corrected source record and only the explicit user-reported replacement
 * remains active for decisions and AI context.
 */
export async function correctUserMemory(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: unknown,
): Promise<{ id: string }> {
  const parsedInput = CorrectUserMemoryInputSchema.parse(input);
  await requireOwnedActiveMemory(supabase, userId, parsedInput.memoryId);

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("correct_user_memory", {
    p_user_id: userId,
    p_memory_id: parsedInput.memoryId,
    p_content: parsedInput.content,
  });
  if (error) throw new Error("Could not correct memory.");
  return { id: z.string().uuid().parse(data) };
}

/** Permanently removes a user-selected memory after an RLS-scoped ownership check. */
export async function forgetUserMemory(
  supabase: SupabaseClient<Database>,
  userId: string,
  memoryId: string,
): Promise<void> {
  const id = await requireOwnedActiveMemory(supabase, userId, memoryId);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_memory")
    .delete()
    .eq("id", id)
    .eq("user_id", userId)
    .eq("status", "active")
    .select("id")
    .maybeSingle();
  if (error || data === null) throw new Error("Could not forget memory.");
}
