import { useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getOfflineQueue } from "./offline-store";
import { OFFLINE_QUEUE_EVENT, OFFLINE_DB_NAME, LEGACY_OFFLINE_KEYS } from "./offline-contract";
export function useOfflineQueue(ownerId: string) {
  const client = useQueryClient();
  const key = ["offline-workout-sets", ownerId];
  const query = useQuery({
    queryKey: key,
    queryFn: () => getOfflineQueue(ownerId),
    retry: false,
    networkMode: "always",
    staleTime: 0,
    gcTime: 0,
  });
  const refresh = useCallback(() => {
    void client.invalidateQueries({ queryKey: ["offline-workout-sets", ownerId] });
  }, [client, ownerId]);
  useEffect(() => {
    const legacy = (event: StorageEvent) => {
      if (event.key === null || LEGACY_OFFLINE_KEYS.some((key) => key === event.key)) refresh();
    };
    window.addEventListener(OFFLINE_QUEUE_EVENT, refresh);
    window.addEventListener("storage", legacy);
    window.addEventListener("focus", refresh);
    let channel: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== "undefined") {
        channel = new BroadcastChannel(OFFLINE_DB_NAME);
        channel.onmessage = refresh;
      }
    } catch {
      /* Focus/own-window updates remain available if broadcasts are denied. */
    }
    return () => {
      window.removeEventListener(OFFLINE_QUEUE_EVENT, refresh);
      window.removeEventListener("storage", legacy);
      window.removeEventListener("focus", refresh);
      channel?.close();
    };
  }, [refresh]);
  return query;
}
