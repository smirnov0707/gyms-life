import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { browserTimeZone, dayInTimeZone } from "@/lib/local-day";
import { getActiveRacePrep } from "@/lib/endurance-race-prep.functions";
import { RacePrepCockpit } from "@/components/RacePrepCockpit";
import { RacePrepStarter } from "@/components/RacePrepStarter";

export function RacePrepWorkspace() {
  const queryClient = useQueryClient();
  const timeZone = browserTimeZone();
  const today = dayInTimeZone(new Date(), timeZone);
  const queryKey = ["active-race-prep", today, timeZone] as const;
  const { data } = useQuery({
    queryKey,
    queryFn: () => getActiveRacePrep({ data: { today, timeZone } }),
    staleTime: 30_000,
  });

  useEffect(() => {
    const refresh = () => void queryClient.invalidateQueries({ queryKey: ["active-race-prep"] });
    window.addEventListener("gymslife:endurance-updated", refresh);
    return () => window.removeEventListener("gymslife:endurance-updated", refresh);
  }, [queryClient]);

  if (!data) return null;
  if (data.status === "none") return <RacePrepStarter />;
  return <RacePrepCockpit data={data} />;
}
