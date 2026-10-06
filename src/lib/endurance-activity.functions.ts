import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { EnduranceActivitySchema } from "./endurance-activity.schema";

export const logEnduranceActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => EnduranceActivitySchema.extend({ source: EnduranceActivitySchema.shape.source.extract(["manual"]) }).parse(input))
  .handler(async ({ data, context }) => {
    const { recordEnduranceActivity } = await import("./endurance-activity.service");
    return recordEnduranceActivity(context.supabase, context.userId, data);
  });
