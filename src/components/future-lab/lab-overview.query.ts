import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { browserTimeZone } from "@/lib/local-day";
import { getLabOverview } from "@/lib/lab.functions";

/** All Lab surfaces share the same authenticated snapshot refresh. */
export function useLabOverview() {
  const { user } = useAuth();
  const timeZone = browserTimeZone();
  return useQuery({
    queryKey: ["future-lab-overview", user?.id, timeZone],
    queryFn: () => getLabOverview({ data: timeZone }),
    enabled: !!user,
    staleTime: 60_000,
  });
}
