import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { observeServerAction } from "./observability.server";

const FingerprintInputSchema = z.object({ fingerprint: z.string().min(1).max(300) }).strict();

export const markTwinMemoryChangeSeen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => FingerprintInputSchema.parse(input))
  .handler(async ({ data, context }) =>
    observeServerAction(
      {
        eventName: "twin_memory_change.seen",
        userId: context.userId,
        failureCode: "TWIN_MEMORY_CHANGE_SEEN_FAILED",
        metadata: {},
      },
      async () => {
        const { transitionTwinMemoryProactiveRecord } =
          await import("./twin-memory-proactive.server");
        return transitionTwinMemoryProactiveRecord(context.userId, data.fingerprint, "seen");
      },
    ),
  );

export const dismissTwinMemoryChange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => FingerprintInputSchema.parse(input))
  .handler(async ({ data, context }) =>
    observeServerAction(
      {
        eventName: "twin_memory_change.dismissed",
        userId: context.userId,
        failureCode: "TWIN_MEMORY_CHANGE_DISMISS_FAILED",
        metadata: {},
      },
      async () => {
        const { transitionTwinMemoryProactiveRecord } =
          await import("./twin-memory-proactive.server");
        return transitionTwinMemoryProactiveRecord(context.userId, data.fingerprint, "dismissed");
      },
    ),
  );
