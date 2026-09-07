import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * The athlete's own ingest credential for the health endpoint.
 *
 * Every profile already has one — the column is NOT NULL with a uuid default —
 * and row-level security already lets the owner read it, so this adds no
 * access. What it adds is a single place the token is handed out, so it is
 * never mixed into the general profile query that half the app caches, and so
 * rotation lives next to it.
 *
 * The token is a bearer credential: anyone holding it can write health rows to
 * this account. It is never logged and never put in a URL.
 */
export const getHealthSource = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("health_token")
      .eq("id", context.userId)
      .maybeSingle();
    // A failed read must not look like "you have no token": the caller shows
    // the difference, because one is a retry and the other is a setup step.
    if (error) return { status: "unavailable" as const };
    if (!data?.health_token) return { status: "missing" as const };
    return { status: "ready" as const, token: data.health_token };
  });

/**
 * Issues a new token and invalidates the old one, in one write.
 *
 * The old token stops working the moment this returns, which is the point: it
 * is what an athlete uses when a shortcut, a screenshot or a shared phone has
 * put the credential somewhere they did not intend.
 */
export const rotateHealthToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const next = crypto.randomUUID();
    const { error } = await context.supabase
      .from("profiles")
      .update({ health_token: next })
      .eq("id", context.userId);
    if (error) return { status: "unavailable" as const };
    return { status: "ready" as const, token: next };
  });
