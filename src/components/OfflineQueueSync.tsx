import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CloudOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { baseLang, useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import {
  flushOfflineWorkoutSets,
  inspectLegacyOffline,
  recoverLegacyOfflineSets,
} from "@/lib/offline-store";
import { syncOfflineWorkoutSet, identifyOwnedOfflineSessions } from "@/lib/offline-sync.functions";
import { offlineIdentity } from "@/lib/offline-identity";
import { useOfflineQueue } from "@/lib/use-offline-queue";
import { OFFLINE_QUEUE_EVENT } from "@/lib/offline-contract";
import { refreshCoreData } from "@/lib/core-cache";
export function OfflineQueueSync() {
  const { user, loading } = useAuth();
  if (loading || !user) return null;
  return <OwnedQueueStatus key={user.id} ownerId={user.id} />;
}
function OwnedQueueStatus({ ownerId }: { ownerId: string }) {
  const { t, lang } = useI18n(),
    lt = baseLang(lang) === "lt",
    client = useQueryClient(),
    queue = useOfflineQueue(ownerId);
  const sync = useServerFn(syncOfflineWorkoutSet),
    verify = useServerFn(identifyOwnedOfflineSessions);
  const refetchQueue = queue.refetch;
  const [sending, setSending] = useState(false),
    [recovering, setRecovering] = useState(false),
    [legacy, setLegacy] = useState(() => inspectLegacyOffline().status);
  const mounted = useRef(false),
    busy = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const flush = useCallback(
    (announce = false) => {
      if (busy.current || offlineIdentity.current() !== ownerId) return;
      const scope = offlineIdentity.capture(ownerId);
      busy.current = true;
      setSending(true);
      void flushOfflineWorkoutSets(ownerId, (input) => sync({ data: input }))
        .then(async (result) => {
          if (!mounted.current || !scope.isCurrent()) return;
          if (result.synced > 0) {
            toast.success(
              result.synced === 1
                ? t("offline.syncedOne")
                : t("offline.syncedMany").replace("{n}", String(result.synced)),
            );
            await refreshCoreData(client, "training");
          }
          if (announce && (result.remaining || result.invalidCount))
            toast.error(t("offline.stillQueued"));
        })
        .catch(() => {
          if (announce && mounted.current && scope.isCurrent())
            toast.error(t("offline.stillQueued"));
        })
        .finally(() => {
          busy.current = false;
          if (mounted.current && scope.isCurrent()) {
            setSending(false);
            void refetchQueue();
          }
        });
    },
    [ownerId, sync, t, client, refetchQueue],
  );
  useEffect(() => {
    const readLegacy = () => setLegacy(inspectLegacyOffline().status);
    const online = () => flush();
    window.addEventListener("online", online);
    window.addEventListener("storage", readLegacy);
    window.addEventListener(OFFLINE_QUEUE_EVENT, readLegacy);
    flush();
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("storage", readLegacy);
      window.removeEventListener(OFFLINE_QUEUE_EVENT, readLegacy);
    };
  }, [flush]);
  const recover = async () => {
    if (busy.current) return;
    const scope = offlineIdentity.capture(ownerId);
    busy.current = true;
    setRecovering(true);
    try {
      const result = await recoverLegacyOfflineSets(ownerId, (input) => verify({ data: input }));
      if (!mounted.current || !scope.isCurrent()) return;
      toast.info(
        result.recovered > 0
          ? lt
            ? `Atkurta šiai paskyrai priklausančių įrašų: ${result.recovered}.`
            : `Recovered records belonging to this account: ${result.recovered}.`
          : lt
            ? "Papildomų šiai paskyrai patvirtintų įrašų nerasta. Ankstesni įrašai nepakeisti."
            : "No additional verified records for this account. Earlier records are unchanged.",
      );
      await refetchQueue();
    } catch {
      if (mounted.current && scope.isCurrent())
        toast.error(
          lt
            ? "Nepavyko patikrinti ankstesnių įrašų. Jie nepakeisti."
            : "Could not verify earlier records. They remain unchanged.",
        );
    } finally {
      busy.current = false;
      if (mounted.current && scope.isCurrent()) setRecovering(false);
    }
  };
  const data = queue.data?.ownerId === ownerId ? queue.data : null;
  const count = data?.items.length ?? 0,
    needsReview =
      data?.items.filter((item) => item.lastFailure && item.lastFailure !== "unavailable") ?? [];
  if (!queue.isPending && !queue.isError && !data?.invalidCount && !count && legacy === "absent")
    return null;
  const unavailable = queue.isError || Boolean(data?.invalidCount);
  return (
    <section
      aria-label={lt ? "Šios paskyros įrašai įrenginyje" : "This account's device records"}
      className="border-b border-amber-400/30 bg-amber-400/[0.07] px-4 py-3"
    >
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-3">
        <CloudOff aria-hidden="true" className="size-4 shrink-0" />
        <p role={unavailable ? "alert" : "status"} className="text-sm font-semibold">
          {unavailable
            ? lt
              ? "Nepavyko patikimai perskaityti šios paskyros įrašų. Nieko neištrinta."
              : "Could not read this account's device records reliably. Nothing was deleted."
            : queue.isPending
              ? t("common.loading")
              : count
                ? t("offline.pending").replace("{n}", String(count))
                : lt
                  ? "Ankstesnės versijos įrašams reikia paskyros patikros."
                  : "Earlier device records need an account check."}
        </p>
        {(count > 0 || unavailable) && (
          <button
            type="button"
            className="ml-auto min-h-11 rounded-full border border-border bg-surface px-4 text-sm"
            disabled={sending || recovering}
            onClick={() => flush(true)}
          >
            {sending ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                {t("offline.sending")}
              </span>
            ) : (
              t("offline.sendNow")
            )}
          </button>
        )}
        {data?.items[0] && (
          <p className="w-full text-xs text-muted-foreground">
            {t("offline.oldest").replace(
              "{date}",
              new Date(data.items[0].timestamp).toLocaleDateString(lang),
            )}
          </p>
        )}
        {count > 0 && (
          <p className="w-full text-xs text-muted-foreground">{t("offline.pendingNote")}</p>
        )}
        {count > 0 && (
          <p className="w-full text-xs text-muted-foreground">
            {lt
              ? "Rodomi tik šios paskyros įrašai. Iš įrenginio jie pašalinami tik serveriui patvirtinus tuos pačius duomenis."
              : "Only this account's records are shown. A record leaves this device's pending queue only after the server confirms its matching values."}
          </p>
        )}
        {needsReview.length > 0 && (
          <details className="w-full rounded-lg border border-border p-3 text-sm">
            <summary>
              {lt ? "Yra įrašų, kuriuos reikia peržiūrėti" : "Some records need review"} (
              {needsReview.length})
            </summary>
            <p className="my-2 text-xs text-muted-foreground">
              {lt
                ? "Duomenys nesutampa arba sesija jau užbaigta. Ankstesni serverio duomenys neperrašomi."
                : "Values conflict, need a timestamp review, or the session is already finished. Existing server records are not overwritten."}
            </p>
            {needsReview.map((item) => (
              <p key={item.id} className="break-words">
                {item.data.exerciseName} · #{item.data.setNumber} · {item.data.weightKg ?? "—"} kg ×{" "}
                {item.data.reps ?? "—"}
              </p>
            ))}
          </details>
        )}
        {legacy !== "absent" && (
          <div className="w-full space-y-2 text-xs">
            <p>
              {lt
                ? "Ankstesnės versijos įrašai saugomi nepakeisti. Patikra atkurs tik su šia paskyra susietas treniruotes; kiti įrašai nebus priskirti šiai paskyrai."
                : "Earlier-version device records remain unchanged. Verification recovers only workouts owned by this account; other records are not assigned to it."}
            </p>
            <button
              type="button"
              disabled={sending || recovering}
              onClick={() => void recover()}
              className="min-h-11 rounded-full border border-border bg-surface px-4 text-sm"
            >
              {recovering
                ? t("common.loading")
                : lt
                  ? "Patikrinti ankstesnius įrašus"
                  : "Verify earlier device records"}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
