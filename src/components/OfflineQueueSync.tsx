import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect } from "react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { flushOfflineWorkoutSets, getOfflineQueue } from "@/lib/offline-store";
import { logWorkoutSet } from "@/lib/set-log.functions";

/**
 * Delivers sets that were logged without a connection, from anywhere in the
 * app.
 *
 * The workout screen already flushes the queue and listens for `online`, but
 * only while it is open. An athlete who logged sets in a basement gym, closed
 * the app and reconnected on the way home was never on that screen again, so
 * real training sat in this device's local storage indefinitely — invisible to
 * the Twin, the trend line and the athlete.
 *
 * `flushOfflineWorkoutSets` holds a single in-flight flush, so this and the
 * workout screen can both ask without sending anything twice, and the endpoint
 * is idempotent besides.
 */
export function OfflineQueueSync() {
  const { t } = useI18n();
  const sync = useServerFn(logWorkoutSet);

  const flush = useCallback(() => {
    if (getOfflineQueue().length === 0) return;
    void flushOfflineWorkoutSets((input) => sync({ data: input }))
      .then((result) => {
        if (result.synced === 1) toast.success(t("offline.syncedOne"));
        else if (result.synced > 1)
          toast.success(t("offline.syncedMany").replace("{n}", String(result.synced)));
      })
      // Silent on failure: the sets stay queued and the next reconnect or app
      // start tries again. A toast on every failed attempt would nag someone
      // who is simply still offline.
      .catch(() => {});
  }, [sync, t]);

  useEffect(() => {
    flush();
    window.addEventListener("online", flush);
    return () => window.removeEventListener("online", flush);
  }, [flush]);

  return null;
}
