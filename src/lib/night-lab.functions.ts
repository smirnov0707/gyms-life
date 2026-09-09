import { z } from "zod";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Identity is request-scoped; the browser sends nothing and chooses nothing. */
export const getOvernightWork = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadOvernightWork } = await import("./night-lab.read.server");
    return loadOvernightWork(context.supabase, context.userId);
  });

/** Read-only morning evidence, scoped by the authenticated server context. */
export const getMorningNightReview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ ownerId: z.string().uuid() }).strict().parse(input))
  .handler(async ({ data, context }) => {
    if (data.ownerId !== context.userId) throw new Error("NIGHT_REVIEW_IDENTITY_CHANGED");
    const { loadMorningNightReview } = await import("./night-review.server");
    return loadMorningNightReview(context.supabase, context.userId);
  });
