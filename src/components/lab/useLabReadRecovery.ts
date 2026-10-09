import { useAuth } from "@/lib/auth";
import { useLabOverview } from "@/components/future-lab/lab-overview.query";
import type { LabReadMode } from "./lab-read.copy";

/** Preserve the existing owner/timezone key and distinguish stale data from no data. */
export function useLabReadRecovery() {
  const { user } = useAuth();
  const query = useLabOverview();
  const readMode: LabReadMode | null = !query.data
    ? query.isLoading
      ? "loading"
      : "unavailable"
    : query.isError
      ? "stale"
      : query.data.unreadable.length > 0
        ? "partial"
        : query.isFetching
          ? "refreshing"
          : null;
  const retry = user
    ? () => {
        if (query.isFetching) return;
        void query.refetch({ cancelRefetch: false, throwOnError: false }).catch(() => {
          console.warn("[Lab] REFRESH_UNAVAILABLE");
        });
      }
    : undefined;
  return { ...query, readMode, retry };
}
