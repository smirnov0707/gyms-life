import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { observeServerAction } from "./observability.server";
import { IanaTimeZoneSchema } from "./local-day";
import { TodayDecisionOutcomeSchema } from "./today-decision.schema";

const GetTodayDecisionInputSchema = z.object({ timeZone: IanaTimeZoneSchema.optional() }).strict();

const RecordOutcomeInputSchema = z
  .object({
    decisionId: z.string().uuid(),
    outcome: TodayDecisionOutcomeSchema,
  })
  .strict();

/** Returns the server-owned, deterministic primary action for the current day. */
export const getTodayDecision = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => GetTodayDecisionInputSchema.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const { getOrCreateTodayDecision } = await import("./today-decision.server");
    const { loadPersistedProfileTimeZone } = await import("./user-context.server");
    const timeZone =
      data.timeZone ?? (await loadPersistedProfileTimeZone(context.supabase, context.userId));
    return getOrCreateTodayDecision(context.supabase, context.userId, timeZone);
  });

/** Stores an explicit user outcome without granting browser writes to audit tables. */
export const recordTodayDecisionOutcome = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => RecordOutcomeInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    return observeServerAction(
      {
        eventName: "today_decision.outcome",
        userId: context.userId,
        failureCode: "TODAY_DECISION_OUTCOME_FAILED",
        metadata: { outcome: data.outcome },
      },
      async () => {
        const { recordTodayDecisionOutcome: storeOutcome } =
          await import("./today-decision.server");
        await storeOutcome(context.supabase, context.userId, data.decisionId, data.outcome);
        return { ok: true };
      },
    );
  });
