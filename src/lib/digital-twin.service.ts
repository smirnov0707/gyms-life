import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { refreshAthleteStateSnapshot } from "./athlete-state-snapshot.server";
import { mapDigitalAthleteStateToTwinSnapshot, twinBodyVariantFor } from "./digital-twin.mapper";
import type { TwinSnapshot } from "./digital-twin.schema";
import { buildTwinIntelligence } from "./twin-intelligence.engine";
import type { TwinIntelligence } from "./twin-intelligence.schema";
import {
  buildPersonalizedTwinLayers,
  type PersonalizedTwinLayerBundle,
} from "./personalized-twin.layers";
import { buildTwinBodyGeometryEvidenceFromAthleteState } from "./personalized-twin.geometry";

export type TwinExperience = {
  snapshot: TwinSnapshot;
  intelligence: TwinIntelligence;
  personalizedTwin: PersonalizedTwinLayerBundle;
};

/**
 * One canonical refresh feeds both the renderer and intelligence layer.
 * This prevents the visible body and its explanation from drifting apart.
 */
export async function loadTwinExperience(
  supabase: SupabaseClient<Database>,
  userId: string,
  timeZone = "UTC",
  now = new Date(),
): Promise<TwinExperience> {
  const [athlete, profile] = await Promise.all([
    refreshAthleteStateSnapshot(supabase, userId, timeZone, now),
    supabase.from("profiles").select("gender").eq("id", userId).maybeSingle(),
  ]);
  const snapshot = mapDigitalAthleteStateToTwinSnapshot(
    athlete.state,
    now,
    twinBodyVariantFor(profile.error ? null : profile.data?.gender),
  );
  return {
    snapshot,
    intelligence: buildTwinIntelligence(athlete.state, now),
    personalizedTwin: buildPersonalizedTwinLayers({
      identity: {
        status: "generic",
        source: "gyms_generic",
        providerKey: null,
        modelObjectPath: null,
        visualIdentityOnly: true,
        bodyGeometryAuthority: false,
        medicalScan: false,
      },
      geometry: buildTwinBodyGeometryEvidenceFromAthleteState(athlete.state),
    }),
  };
}

/** Existing callers keep the renderer-only contract. */
export async function loadTwinSnapshot(
  supabase: SupabaseClient<Database>,
  userId: string,
  timeZone = "UTC",
  now = new Date(),
): Promise<TwinSnapshot> {
  return (await loadTwinExperience(supabase, userId, timeZone, now)).snapshot;
}
