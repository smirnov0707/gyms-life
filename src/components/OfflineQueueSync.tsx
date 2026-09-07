import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { CloudOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { flushOfflineWorkoutSets, getOfflineQueue, OFFLINE_QUEUE_EVENT } from "@/lib/offline-store";
import { logWorkoutSet } from "@/lib/set-log.functions";

/**
 * Delivers sets that were logged without a connection, from anywhere in the
 * app — and, while any are still undelivered, says so.
 *
 * The workout screen already flushes the queue and listens for `online`, but
 * only while it is open. An athlete who logged sets in a basement gym, closed
 * the app and reconnected on the way home was never on that screen again, so
 * real training sat in this device's local storage indefinitely — invisible to
 * the Twin, the trend line and the athlete.
 *
 * Delivery failures stay silent per attempt: someone who is simply still
 * offline should not be nagged on every retry. But silence about the *queue*
 * was the second half of the same problem. Sets sitting here are training that
 * happened, and every screen in this app reads their absence as training that
 * did not — so as long as any are waiting, this says how many, how old, and
 * offers to try now.
 *
 * `flushOfflineWorkoutSets` holds a single in-flight flush, so this and the
 * workout screen can both ask without sending anything twice, and the endpoint
 * is idempotent besides.
 */
export function OfflineQueueSync() {
  const { t, lang } = useI18n();
  const sync = useServerFn(logWorkoutSet);
  const [pending, setPending] = useState<{ count: number; oldest: number | null }>({
    count: 0,
    oldest: null,
  });
  const [sending, setSending] = useState(false);

  const readQueue = useCallback(() => {
    const queue = getOfflineQueue();
    setPending({
      count: queue.length,
      oldest: queue.reduce<number | null>(
        (oldest, item) => (oldest === null || item.timestamp < oldest ? item.timestamp : oldest),
        null,
      ),
    });
  }, []);

  const flush = useCallback(
    (announceFailure = false) => {
      if (getOfflineQueue().length === 0) return;
      setSending(true);
      void flushOfflineWorkoutSets((input) => sync({ data: input }))
        .then((result) => {
          if (result.synced === 1) toast.success(t("offline.syncedOne"));
          else if (result.synced > 1)
            toast.success(t("offline.syncedMany").replace("{n}", String(result.synced)));
          // Only when the athlete pressed the button: they asked, so they are
          // owed an answer either way.
          if (announceFailure && result.remaining > 0) toast.error(t("offline.stillQueued"));
        })
        // Silent on an automatic attempt: the sets stay queued, the strip
        // stays up, and the next reconnect or app start tries again.
        .catch(() => {
          if (announceFailure) toast.error(t("offline.stillQueued"));
        })
        .finally(() => {
          setSending(false);
          readQueue();
        });
    },
    [sync, t, readQueue],
  );

  useEffect(() => {
    readQueue();
    const onOnline = () => flush();
    window.addEventListener("online", onOnline);
    window.addEventListener(OFFLINE_QUEUE_EVENT, readQueue);
    flush();
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener(OFFLINE_QUEUE_EVENT, readQueue);
    };
  }, [flush, readQueue]);

  if (pending.count === 0) return null;

  return (
    <section
      aria-label={t("offline.pending").replace("{n}", String(pending.count))}
      className="border-b border-amber-400/30 bg-amber-400/[0.07] px-4 py-2.5"
    >
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-3 gap-y-1.5">
        <CloudOff aria-hidden="true" className="size-4 shrink-0 text-amber-600" />
        <p className="text-xs font-semibold text-foreground">
          {t("offline.pending").replace("{n}", String(pending.count))}
        </p>
        {pending.oldest !== null ? (
          <p className="text-[11px] text-muted-foreground">
            {t("offline.oldest").replace(
              "{date}",
              new Date(pending.oldest).toLocaleDateString(lang),
            )}
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => flush(true)}
          disabled={sending}
          className="ml-auto inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-surface px-4 text-xs font-semibold text-foreground transition-colors hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60"
        >
          {sending ? <Loader2 aria-hidden="true" className="size-3.5 animate-spin" /> : null}
          {sending ? t("offline.sending") : t("offline.sendNow")}
        </button>
        <p className="w-full text-[11px] leading-relaxed text-muted-foreground">
          {t("offline.pendingNote")}
        </p>
      </div>
    </section>
  );
}
