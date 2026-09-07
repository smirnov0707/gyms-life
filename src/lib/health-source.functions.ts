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
    // The newest sample comes back with the key, because handing someone a
    // credential and no way to see whether it worked leaves a broken
    // automation looking exactly like one that was never set up.
    const [profileRes, sampleRes] = await Promise.all([
      context.supabase
        .from("profiles")
        .select("health_token")
        .eq("id", context.userId)
        .maybeSingle(),
      context.supabase
        .from("health_samples")
        .select("sample_on, source, updated_at")
        .eq("user_id", context.userId)
        .order("sample_on", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    // A failed read must not look like "you have no token": the caller shows
    // the difference, because one is a retry and the other is a setup step.
    if (profileRes.error) return { status: "unavailable" as const };
    if (!profileRes.data?.health_token) return { status: "missing" as const };

    const sample = sampleRes.error ? undefined : sampleRes.data;
    return {
      status: "ready" as const,
      token: profileRes.data.health_token,
      // undefined: we could not look. null: we looked, nothing has arrived.
      lastSample: sampleRes.error
        ? undefined
        : sample
          ? { day: sample.sample_on, source: sample.source, receivedAt: sample.updated_at }
          : null,
    };
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
