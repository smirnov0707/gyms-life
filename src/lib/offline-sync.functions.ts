import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { OfflineSyncRequestSchema, LegacyOwnershipRequestSchema } from "./offline-contract";
import { synchronizeOfflineForOwner, resolveLegacyOfflineOwnership } from "./offline-sync.server";
export const syncOfflineWorkoutSet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => OfflineSyncRequestSchema.parse(input))
  .handler(({ data, context }) =>
    synchronizeOfflineForOwner(context.supabase, context.userId, data),
  );
export const identifyOwnedOfflineSessions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => LegacyOwnershipRequestSchema.parse(input))
  .handler(({ data, context }) =>
    resolveLegacyOfflineOwnership(context.supabase, context.userId, data),
  );
