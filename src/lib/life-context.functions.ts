import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { observeServerAction } from "./observability.server";
import { LifeContextInputSchema } from "./life-context.schema";

const DismissLifeContextInputSchema = z.object({ contextId: z.string().uuid() }).strict();

/** Returns current, user-reported life context for the Today experience. */
export const getActiveLifeContexts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadActiveLifeContexts } = await import("./life-context.server");
    const result = await loadActiveLifeContexts(context.supabase, context.userId);
    if (!result.available) throw new Error("Life context is temporarily unavailable.");
    return result.contexts;
  });

/** Stores a validated, expiring current-state fact through the server boundary. */
export const setActiveLifeContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => LifeContextInputSchema.parse(input))
  .handler(async ({ data, context }) =>
    observeServerAction(
      {
        eventName: "life_context.set",
        userId: context.userId,
        failureCode: "LIFE_CONTEXT_SET_FAILED",
        metadata: { kind: data.kind, durationHours: data.durationHours },
      },
      async () => {
        const { saveLifeContext } = await import("./life-context.server");
        return saveLifeContext(context.supabase, context.userId, data);
      },
    ),
  );

/** Stops applying a context without deleting the historical user record. */
export const dismissActiveLifeContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => DismissLifeContextInputSchema.parse(input))
  .handler(async ({ data, context }) =>
    observeServerAction(
      {
        eventName: "life_context.dismiss",
        userId: context.userId,
        failureCode: "LIFE_CONTEXT_DISMISS_FAILED",
        metadata: {},
      },
      async () => {
        const { dismissLifeContext } = await import("./life-context.server");
        await dismissLifeContext(context.supabase, context.userId, data.contextId);
        return { ok: true };
      },
    ),
  );
