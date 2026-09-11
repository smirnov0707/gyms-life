import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CaptureSetInput = z.object({ captureSetId: z.string().uuid() }).strict();
const IdentityFallbackInput = z
  .object({ reason: z.enum(["load_failed", "invalid_geometry", "expired_url"]) })
  .strict();

export const getPersonalizedTwinLifecycle = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadLatestPersonalizedTwinLifecycle } =
      await import("./personalized-twin.lifecycle.server");
    return loadLatestPersonalizedTwinLifecycle(context.supabase, context.userId);
  });

export const deletePersonalizedTwinAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => CaptureSetInput.parse(input))
  .handler(async ({ data, context }) => {
    const { deleteOwnedPersonalizedTwin } = await import("./personalized-twin.lifecycle.server");
    return deleteOwnedPersonalizedTwin(context.supabase, context.userId, data.captureSetId);
  });

export const retryPersonalizedTwinAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => CaptureSetInput.parse(input))
  .handler(async ({ data, context }) => {
    const { retryFailedPersonalizedTwin } = await import("./personalized-twin.lifecycle.server");
    return retryFailedPersonalizedTwin(context.supabase, context.userId, data.captureSetId);
  });

export const reportPersonalizedTwinIdentityFallback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => IdentityFallbackInput.parse(input))
  .handler(async ({ data, context }) => {
    const { recordObservabilityEvent } = await import("./observability.server");
    await recordObservabilityEvent({
      eventName: "personalized_twin.identity_shell_fallback",
      outcome: "failure",
      userId: context.userId,
      errorCode: "PERSONALIZED_TWIN_IDENTITY_FALLBACK",
      metadata: { reason: data.reason },
    });
    return { ok: true };
  });
