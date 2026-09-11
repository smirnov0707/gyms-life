import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { personalizedTwinProviderCapability } from "./personalized-twin.provider";

export const getPersonalizedTwinCapability = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => personalizedTwinProviderCapability());
