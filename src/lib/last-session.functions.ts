import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { IanaTimeZoneSchema } from "./local-day";
import type { SessionMuscleContribution } from "./session-muscle-breakdown";

/**
 * What the last completed session actually did to the body, kept on the home
 * screen rather than only in the moment after finishing.
 *
 * The projection is the same one the post-workout replay uses — one rule for
 * what a session contributed to a muscle group, so the number never depends
 * on which screen you read it from.
 */
export type LastSessionEffect =
  /** A read failed. Not the same as never having trained. */
  | { status: "unreadable" }
  /** Read successfully, and nothing has been finished yet. */
  | { status: "none" }
  | {
      status: "session";
      /** The session's own title, or null when the plan no longer names it. */
      title: string | null;
      /** When it was finished, as an ISO instant. */
      finishedAt: string;
      breakdown: SessionMuscleContribution[];
      /** False when the breakdown could not be computed for this session. */
      breakdownAvailable: boolean;
    };

export const getLastSessionEffect = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => IanaTimeZoneSchema.optional().parse(input ?? undefined))
  .handler(async ({ context }): Promise<LastSessionEffect> => {
    const { data: session, error } = await context.supabase
      .from("workout_sessions")
      .select("id, title, finished_at")
      .eq("user_id", context.userId)
      .not("finished_at", "is", null)
      .order("finished_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return { status: "unreadable" };
    if (!session?.finished_at) return { status: "none" };

    const { loadCompletedSessionReplay } = await import("./session-replay.server");
    const replay = await loadCompletedSessionReplay(context.supabase, context.userId, session.id);

    return {
      status: "session",
      title: session.title ?? null,
      finishedAt: session.finished_at,
      breakdown: replay.muscleBreakdown,
      // An unavailable replay is not a session that trained nothing, and the
      // card has to be able to tell the caller which of the two it holds.
      breakdownAvailable: replay.replayStatus === "available",
    };
  });
