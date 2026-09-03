import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database, Json } from "@/integrations/supabase/types";
import {
  LifeContextInputSchema,
  lifeContextValueFromInput,
  parseActiveLifeContext,
  type ActiveLifeContext,
  type LifeContextInput,
  type LifeContextValue,
} from "./life-context.schema";

type LifeContextSourceResult = {
  contexts: ActiveLifeContext[];
  available: boolean;
};

function toJson(value: LifeContextValue): Json {
  const output: { [key: string]: Json | undefined } = { kind: value.kind };
  if (value.note !== undefined) output["note"] = value.note;
  if (value.kind === "time_limited") output["minutes"] = value.minutes;
  if (value.kind === "equipment_limited") output["equipment"] = [...value.equipment];
  return output;
}

function contextContent(value: LifeContextValue): string {
  const detail =
    value.kind === "time_limited"
      ? ` (${value.minutes} min)`
      : value.kind === "equipment_limited"
        ? ` (${value.equipment.join(", ")})`
        : "";
  return `Temporary context: ${value.kind}${detail}${value.note ? ` — ${value.note}` : ""}`;
}

function importanceFor(value: LifeContextValue): number {
  if (value.kind === "temporary_limitation") return 0.9;
  if (value.kind === "facility_closed") return 0.8;
  if (value.kind === "time_limited" || value.kind === "equipment_limited") return 0.7;
  return 0.6;
}

function lifeContextKey(value: LifeContextValue): string {
  return `life_context:${value.kind}`;
}

async function expireStaleLifeContexts(userId: string, now: Date): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin
    .from("user_memory")
    .update({ status: "expired", updated_at: now.toISOString() })
    .eq("user_id", userId)
    .eq("memory_type", "current_context")
    .eq("status", "active")
    .lt("expires_at", now.toISOString());
  if (error) throw new Error("Could not expire stale life context.");
}

/**
 * Loads only active, validated user-reported context. A malformed row makes
 * the context source unavailable rather than leaking unvalidated JSON into a
 * decision or AI prompt.
 */
export async function loadActiveLifeContexts(
  supabase: SupabaseClient<Database>,
  userId: string,
  now = new Date(),
): Promise<LifeContextSourceResult> {
  try {
    await expireStaleLifeContexts(userId, now);
  } catch {
    return { contexts: [], available: false };
  }

  const { data, error } = await supabase
    .from("user_memory")
    .select("id, content, value, expires_at")
    .eq("user_id", userId)
    .eq("memory_type", "current_context")
    .eq("status", "active")
    .gt("expires_at", now.toISOString())
    .order("expires_at", { ascending: true })
    .limit(12);
  if (error) return { contexts: [], available: false };

  const contexts: ActiveLifeContext[] = [];
  for (const row of data ?? []) {
    try {
      contexts.push(parseActiveLifeContext(row));
    } catch {
      return { contexts: [], available: false };
    }
  }
  return { contexts, available: true };
}

export async function saveLifeContext(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: LifeContextInput,
  now = new Date(),
): Promise<{ id: string }> {
  const parsedInput = LifeContextInputSchema.parse(input);
  const value = lifeContextValueFromInput(parsedInput);
  const expiresAt = new Date(now.getTime() + parsedInput.durationHours * 3_600_000);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("replace_active_life_context", {
    p_user_id: userId,
    p_memory_key: lifeContextKey(value),
    p_content: contextContent(value),
    p_value: toJson(value),
    p_importance: importanceFor(value),
    p_expires_at: expiresAt.toISOString(),
  });
  if (error) throw new Error("Could not save life context.");
  return { id: z.string().uuid().parse(data) };
}

/** Marks context dismissed; it deliberately preserves the user-visible history. */
export async function dismissLifeContext(
  supabase: SupabaseClient<Database>,
  userId: string,
  contextId: string,
): Promise<void> {
  const validatedId = z.string().uuid().parse(contextId);
  const { data: owned, error: ownershipError } = await supabase
    .from("user_memory")
    .select("id")
    .eq("id", validatedId)
    .eq("user_id", userId)
    .eq("memory_type", "current_context")
    .eq("status", "active")
    .maybeSingle();
  if (ownershipError || !owned) throw new Error("Life context was not found.");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin
    .from("user_memory")
    .update({ status: "dismissed", updated_at: new Date().toISOString() })
    .eq("id", validatedId)
    .eq("user_id", userId);
  if (error) throw new Error("Could not dismiss life context.");
}
