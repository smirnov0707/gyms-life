import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import {
  ActiveMemoryForAiSchema,
  buildActiveMemoryForAi,
  CorrectUserMemoryInputSchema,
  parseUserMemoryTransparencyItems,
  type ActiveMemoryForAi,
  type UserMemoryTransparencyItem,
} from "./user-memory.schema";

const UserMemoryIdSchema = z.string().uuid();

/**
 * How many active memory entries the transparency page shows at once.
 *
 * The page's own heading is "what GYMS.LIFE currently knows", so a bound it
 * does not mention is a page that quietly answers a different question. One
 * row beyond the limit is fetched so the read can tell the difference between
 * exactly fifty entries and more than fifty — the same idiom the personal
 * timeline already uses.
 */
export const USER_MEMORY_TRANSPARENCY_LIMIT = 50;

export type UserMemoryTransparencyPage = {
  items: UserMemoryTransparencyItem[];
  /** True when the athlete has more active memory than this page shows. */
  hasMore: boolean;
  limit: number;
};

function activeMemoryQuery(supabase: SupabaseClient<Database>, userId: string, now: Date) {
  return supabase
    .from("user_memory")
    .select(
      "id, memory_type, content, source, confidence, importance, status, value, evidence_refs, last_confirmed_at, expires_at",
    )
    .eq("user_id", userId)
    .eq("status", "active")
    .or(`expires_at.is.null,expires_at.gt.${now.toISOString()}`)
    .order("importance", { ascending: false })
    .order("last_confirmed_at", { ascending: false })
    .limit(USER_MEMORY_TRANSPARENCY_LIMIT + 1);
}

/** Lists only the user's live, validated memory entries for transparency. */
export async function loadUserMemoryTransparency(
  supabase: SupabaseClient<Database>,
  userId: string,
  now = new Date(),
): Promise<UserMemoryTransparencyPage> {
  const { data, error } = await activeMemoryQuery(supabase, userId, now);
  if (error) throw new Error("Could not load user memory.");
  const rows = parseUserMemoryTransparencyItems(data);
  return {
    items: rows.slice(0, USER_MEMORY_TRANSPARENCY_LIMIT),
    hasMore: rows.length > USER_MEMORY_TRANSPARENCY_LIMIT,
    limit: USER_MEMORY_TRANSPARENCY_LIMIT,
  };
}

/**
 * A deliberately small, validated subset for the central AI context. It is
 * loaded only after the caller has checked the current personalization consent.
 */
export async function loadActiveMemoryForAi(
  supabase: SupabaseClient<Database>,
  userId: string,
  now = new Date(),
): Promise<ActiveMemoryForAi> {
  try {
    const { data, error } = await activeMemoryQuery(supabase, userId, now);
    if (error) throw error;
    return buildActiveMemoryForAi(data);
  } catch {
    return ActiveMemoryForAiSchema.parse({ available: false, entries: [] });
  }
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
