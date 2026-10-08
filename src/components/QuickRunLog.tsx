import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Route, TimerReset } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { baseLang, useI18n } from "@/lib/i18n";
import {
  logEnduranceActivity,
  retryEnduranceRaceEnrichmentFn,
} from "@/lib/endurance-activity.functions";
import type { EnduranceRaceEnrichmentResult } from "@/lib/endurance-race-enrichment.service";
import type { EnduranceRaceEnrichmentState } from "@/lib/endurance-race-enrichment.schema";
import { confirmRaceSessionMatchFn } from "@/lib/endurance-session-match.functions";

import { useAuth } from "@/lib/auth";
import { offlineIdentity } from "@/lib/offline-identity";
import { runSubmissionStore } from "@/lib/endurance-submission-store";
import { acknowledgesManualRun, type ManualRunSubmission } from "@/lib/endurance-submission.schema";

type Props = { onLogged?: () => void | Promise<void> };
export function QuickRunLog(props: Props) {
  const { user, loading } = useAuth();
  const { lang } = useI18n();
  if (loading || !user)
    return (
      <p role="status">
        {baseLang(lang) === "en"
          ? "Sign in to record a run."
          : "Prisijunk, kad galėtum įrašyti bėgimą."}
      </p>
    );
  // A switched account must never inherit the previous owner's draft or late response.
  return <OwnedQuickRunLog key={user.id} {...props} ownerId={user.id} />;
}

function OwnedQuickRunLog({ onLogged, ownerId }: Props & { ownerId: string }) {
  const { lang } = useI18n();
  const english = baseLang(lang) === "en";
  const logActivity = useServerFn(logEnduranceActivity);
  const confirmMatch = useServerFn(confirmRaceSessionMatchFn);
  const retryEnrichment = useServerFn(retryEnduranceRaceEnrichmentFn);
  const inFlight = useRef(false);
  const [environment, setEnvironment] = useState<"outdoor" | "treadmill">("outdoor");
  const [minutes, setMinutes] = useState("");
  const [distanceKm, setDistanceKm] = useState("");
  const [rpe, setRpe] = useState("");
  const [saving, setSaving] = useState(false);
  const [pendingSubmission, setPendingSubmission] = useState<ManualRunSubmission | null>(null);
  const [journalReady, setJournalReady] = useState(false);
  const [confirmedPending, setConfirmedPending] = useState(false);
  const [recoveryAttempt, setRecoveryAttempt] = useState(0);
  const [storageFailed, setStorageFailed] = useState(false);
  useEffect(() => {
    let active = true;
    const scope = offlineIdentity.capture(ownerId);
    void runSubmissionStore
      .read(scope)
      .then((pending) => {
        if (!active || !scope.isCurrent()) return;
        setPendingSubmission(pending);
        if (pending) {
          setMinutes(String(pending.activity.durationSeconds / 60));
          setDistanceKm(
            pending.activity.distanceMeters === null
              ? ""
              : String(pending.activity.distanceMeters / 1000),
          );
          setRpe(
            pending.activity.perceivedEffort === null
              ? ""
              : String(pending.activity.perceivedEffort),
          );
          if (
            pending.activity.environment === "outdoor" ||
            pending.activity.environment === "treadmill"
          )
            setEnvironment(pending.activity.environment);
        }
        setStorageFailed(false);
        setJournalReady(true);
      })
      .catch(() => {
        if (active && scope.isCurrent()) {
          setStorageFailed(true);
          setJournalReady(false);
        }
      });
    return () => {
      active = false;
    };
  }, [ownerId, recoveryAttempt]);
  const [savedRun, setSavedRun] = useState<{
    sessionId: string;
    enrichment: EnduranceRaceEnrichmentState;
  } | null>(null);
  const [pendingMatch, setPendingMatch] = useState<{
    sessionId: string;
    raceGoalId: string;
    planSessionKey: string;
    intent: "easy" | "long" | "tempo" | "intervals" | "recovery" | "race";
  } | null>(null);

  const applyEnrichment = (sessionId: string, result: EnduranceRaceEnrichmentResult) => {
    setSavedRun({ sessionId, enrichment: result.raceEnrichment });
    if (result.raceMatch?.status === "needs_confirmation" && result.raceMatch.intent) {
      setPendingMatch({
        sessionId,
        raceGoalId: result.raceMatch.raceGoalId,
        planSessionKey: result.raceMatch.plannedSessionKey,
        intent: result.raceMatch.intent,
      });
    } else setPendingMatch(null);
  };

  // Refresh is secondary: once persistence succeeded, a callback failure must
  // never tell the athlete to save the same completed run a second time.
  const refreshSavedRun = async (
    newRun: boolean,
    raceIntelligence: EnduranceRaceEnrichmentResult["raceIntelligence"] = null,
  ) => {
    try {
      if (newRun) window.dispatchEvent(new CustomEvent("gymslife:training-completed"));
      window.dispatchEvent(
        new CustomEvent("gymslife:endurance-updated", { detail: { raceIntelligence } }),
      );
      await onLogged?.();
    } catch {
      console.warn("[Endurance] SAVED_RUN_VIEW_REFRESH_FAILED");
      toast.warning(
        english
          ? "Run saved. The screen could not refresh; do not record it again."
          : "Bėgimas išsaugotas. Ekrano atnaujinti nepavyko; nekartok įrašymo.",
      );
    }
  };

  const deliverSubmission = async (request: ManualRunSubmission) => {
    const scope = offlineIdentity.capture(ownerId);
    let result;
    try {
      scope.assertCurrent();
      result = await logActivity({ data: request });
      scope.assertCurrent();
      if (!acknowledgesManualRun(request, result)) throw new Error("RUN_ACKNOWLEDGEMENT_MISMATCH");
    } catch {
      if (scope.isCurrent())
        toast.error(
          english
            ? "Save confirmation is unavailable. Retry this same request; do not create another run."
            : "Išsaugojimo patvirtinimo nėra. Kartok šią užklausą, nekurk kito bėgimo.",
        );
      return;
    }
    setConfirmedPending(true);
    // The server acknowledged the original evidence. A local cleanup failure
    // must not be presented as a failed save; the retained ID remains safe to retry.
    try {
      await runSubmissionStore.acknowledge(scope, request);
      scope.assertCurrent();
      setPendingSubmission(null);
      setMinutes("");
      setDistanceKm("");
      setRpe("");
    } catch {
      if (!scope.isCurrent()) return;
      toast.warning(
        english
          ? "Run saved. Local confirmation could not be cleared; retry uses the same run."
          : "Bėgimas išsaugotas. Vietinio patvirtinimo pašalinti nepavyko; kartojama ta pati užklausa.",
      );
    }
    if (!scope.isCurrent()) return;
    applyEnrichment(result.session.id, result);
    toast.success(
      result.submission?.persistence === "replayed"
        ? english
          ? "Previously saved run recovered. No duplicate created."
          : "Anksčiau išsaugotas bėgimas atkurtas. Dublikatas nesukurtas."
        : english
          ? "Run saved."
          : "Bėgimas išsaugotas.",
    );
    await refreshSavedRun(result.submission?.persistence === "created", result.raceIntelligence);
  };

  const submit = async () => {
    if (inFlight.current || !journalReady || pendingSubmission) return;
    const duration = Number(minutes.replace(",", "."));
    const distance = Number(distanceKm.replace(",", "."));
    const effort = rpe === "" ? null : Number(rpe);
    if (
      !Number.isFinite(duration) ||
      duration <= 0 ||
      duration > 1440 ||
      Math.round(duration * 60) < 1 ||
      !Number.isFinite(distance) ||
      distance <= 0 ||
      distance > 250 ||
      Math.round(distance * 1000) < 1 ||
      (effort !== null && (!Number.isInteger(effort) || effort < 1 || effort > 10))
    ) {
      toast.error(
        english
          ? "Check duration, distance and effort (1–10)."
          : "Patikrink trukmę, atstumą ir pastangas (1–10).",
      );
      return;
    }
    inFlight.current = true;
    setSaving(true);
    const scope = offlineIdentity.capture(ownerId);
    let request: ManualRunSubmission;
    try {
      request = {
        ownerId,
        requestId: crypto.randomUUID(),
        activity: {
          kind: "run",
          environment,
          source: "manual",
          startedAt: new Date(Date.now() - duration * 60_000).toISOString(),
          durationSeconds: Math.round(duration * 60),
          distanceMeters: Math.round(distance * 1000),
          averageHeartRateBpm: null,
          perceivedEffort: effort,
        },
      };
      // Await the durable transaction before any network call. Never silently
      // fall back to an untracked insert when local storage is refused.
      await runSubmissionStore.begin(scope, request);
      scope.assertCurrent();
      setConfirmedPending(false);
      setPendingSubmission(request);
    } catch {
      if (!scope.isCurrent()) return;
      toast.error(
        english
          ? "The request could not be retained safely. Nothing new was sent; check local recovery."
          : "Užklausos saugiai išlaikyti nepavyko. Naujas įrašas nesiųstas; patikrink vietinį atkūrimą.",
      );
      setJournalReady(false);
      setRecoveryAttempt((attempt) => attempt + 1);
      inFlight.current = false;
      setSaving(false);
      return;
    }
    try {
      await deliverSubmission(request);
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  };

  const retrySubmission = async () => {
    if (inFlight.current || !pendingSubmission) return;
    inFlight.current = true;
    setSaving(true);
    try {
      await deliverSubmission(pendingSubmission);
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  };

  const retryPlanCheck = async () => {
    if (inFlight.current || !savedRun?.enrichment.retryable) return;
    inFlight.current = true;
    setSaving(true);
    const scope = offlineIdentity.capture(ownerId);
    try {
      const result = await retryEnrichment({ data: { workoutSessionId: savedRun.sessionId } });
      if (!scope.isCurrent()) return;
      applyEnrichment(savedRun.sessionId, result);
      await refreshSavedRun(false, result.raceIntelligence);
    } catch {
      if (!scope.isCurrent()) return;
      toast.error(
        english
          ? "Run remains saved. The plan check is still unavailable."
          : "Bėgimas lieka išsaugotas. Plano susiejimo patikra vis dar nepasiekiama.",
      );
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  };

  const acceptMatch = async () => {
    if (!pendingMatch || inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    const scope = offlineIdentity.capture(ownerId);
    try {
      await confirmMatch({
        data: {
          workoutSessionId: pendingMatch.sessionId,
          raceGoalId: pendingMatch.raceGoalId,
          planSessionKey: pendingMatch.planSessionKey,
        },
      });
      if (!scope.isCurrent()) return;
      setSavedRun({
        sessionId: pendingMatch.sessionId,
        enrichment: { status: "matched", linked: true, retryable: false },
      });
      setPendingMatch(null);
      toast.success(
        english ? "Run linked to race preparation." : "Bėgimas susietas su pasiruošimo planu.",
      );
      await refreshSavedRun(false);
    } catch {
      // A lost response may follow a committed confirmation. Re-read the saved
      // run before offering another classification, never log another workout.
      if (!scope.isCurrent()) return;
      setSavedRun({
        sessionId: pendingMatch.sessionId,
        enrichment: { status: "unavailable", linked: false, retryable: true, stage: "link" },
      });
      setPendingMatch(null);
      toast.error(
        english ? "Could not confirm the race session." : "Nepavyko patvirtinti plano sesijos.",
      );
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-3">
      <div
        className="grid grid-cols-2 gap-2"
        role="group"
        aria-label={english ? "Run environment" : "Bėgimo aplinka"}
      >
        <Button
          type="button"
          variant={environment === "outdoor" ? "default" : "outline"}
          className="min-h-11"
          disabled={saving || !journalReady || pendingSubmission !== null}
          onClick={() => setEnvironment("outdoor")}
        >
          <Route className="size-4" /> {english ? "Outdoor" : "Lauke"}
        </Button>
        <Button
          type="button"
          variant={environment === "treadmill" ? "default" : "outline"}
          className="min-h-11"
          disabled={saving || !journalReady || pendingSubmission !== null}
          onClick={() => setEnvironment("treadmill")}
        >
          <TimerReset className="size-4" /> {english ? "Treadmill" : "Takelis"}
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Input
          disabled={saving || !journalReady || pendingSubmission !== null}
          inputMode="decimal"
          value={minutes}
          onChange={(e) => setMinutes(e.target.value)}
          placeholder={english ? "Minutes" : "Minutės"}
          aria-label={english ? "Duration in minutes" : "Trukmė minutėmis"}
        />
        <Input
          disabled={saving || !journalReady || pendingSubmission !== null}
          inputMode="decimal"
          value={distanceKm}
          onChange={(e) => setDistanceKm(e.target.value)}
          placeholder="km"
          aria-label={english ? "Distance in kilometres" : "Atstumas kilometrais"}
        />
      </div>
      <Input
        disabled={saving || !journalReady || pendingSubmission !== null}
        inputMode="numeric"
        value={rpe}
        onChange={(e) => setRpe(e.target.value)}
        placeholder={english ? "Effort 1–10 (optional)" : "Pastangos 1–10 (nebūtina)"}
        aria-label={english ? "Perceived effort from 1 to 10" : "Juntamos pastangos nuo 1 iki 10"}
      />
      <Button
        type="button"
        className="min-h-11"
        disabled={saving || !journalReady || pendingSubmission !== null}
        onClick={() => void submit()}
      >
        {saving ? <Loader2 className="size-4 animate-spin" /> : null}
        {english ? "Credit this run" : "Užskaityti bėgimą"}
      </Button>
      {storageFailed ? (
        <div role="alert" className="rounded-2xl border border-border bg-surface p-3 text-sm">
          <p>
            {english
              ? "Local recovery is unavailable. No untracked run will be sent."
              : "Vietinis atkūrimas nepasiekiamas. Bėgimas be išsaugotos užklausos nebus siunčiamas."}
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-3 min-h-11 w-full whitespace-normal"
            onClick={() => setRecoveryAttempt((attempt) => attempt + 1)}
          >
            {english ? "Retry local recovery" : "Pakartoti vietinį atkūrimą"}
          </Button>
        </div>
      ) : pendingSubmission ? (
        <div className="rounded-2xl border border-border bg-surface p-3">
          <p role="status" className="text-sm leading-relaxed text-foreground">
            {confirmedPending
              ? english
                ? "Run already saved. The local request is still retained. Retry its confirmation without recording another run."
                : "Bėgimas jau išsaugotas. Vietinė užklausa dar išlaikyta. Pakartok jos patvirtinimą, neįrašydamas kito bėgimo."
              : english
                ? "This run's save confirmation is pending. Its original request is retained on this device. Retry it without recording a second run."
                : "Šio bėgimo išsaugojimo patvirtinimas laukiamas. Pradinė užklausa išlaikyta šiame įrenginyje. Kartok ją, neįrašydamas antro bėgimo."}
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-3 min-h-11 w-full whitespace-normal"
            disabled={saving}
            onClick={() => void retrySubmission()}
          >
            {english ? "Retry the same save" : "Pakartoti tą patį išsaugojimą"}
          </Button>
        </div>
      ) : null}
      {savedRun?.enrichment.retryable ? (
        <div className="rounded-2xl border border-border bg-surface p-3">
          <p role="status" className="text-sm leading-relaxed text-foreground">
            {savedRun.enrichment.linked
              ? english
                ? "Run saved and linked. Updated analysis is temporarily unavailable."
                : "Bėgimas išsaugotas ir susietas. Atnaujinta analizė laikinai nepasiekiama."
              : english
                ? "Run saved. Race-plan matching is temporarily unavailable. Retry without recording another run."
                : "Bėgimas išsaugotas. Susiejimas su planu laikinai nepasiekiamas. Kartok tik patikrą, ne bėgimo įrašymą."}
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-3 min-h-11 w-full whitespace-normal"
            disabled={saving || !journalReady || pendingSubmission !== null}
            onClick={() => void retryPlanCheck()}
          >
            {english ? "Retry plan check" : "Pakartoti plano patikrą"}
          </Button>
        </div>
      ) : savedRun?.enrichment.status === "matched" ? (
        <p role="status" className="text-sm text-foreground">
          {english ? "Saved run is linked to the plan." : "Išsaugotas bėgimas susietas su planu."}
        </p>
      ) : null}
      {pendingMatch ? (
        <div className="rounded-[1.25rem] border border-primary/30 bg-primary/5 p-3">
          <p className="text-sm font-semibold">
            {english
              ? "Was this your planned " + pendingMatch.intent + " run?"
              : "Ar tai buvo tavo suplanuotas „" + pendingMatch.intent + "“ bėgimas?"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {english
              ? "The evidence is close, but not strong enough for automatic classification."
              : "Duomenys panašūs, bet jų neužtenka automatiniam priskyrimui."}
          </p>
          <div className="mt-3 flex gap-2">
            <Button
              type="button"
              size="sm"
              disabled={saving || !journalReady || pendingSubmission !== null}
              onClick={() => void acceptMatch()}
            >
              {english ? "Yes, count it" : "Taip, užskaityti"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={saving || !journalReady || pendingSubmission !== null}
              onClick={() => setPendingMatch(null)}
            >
              {english ? "No" : "Ne"}
            </Button>
          </div>
        </div>
      ) : null}
      <p className="text-xs leading-relaxed text-muted-foreground">
        {english
          ? "Counts as endurance training. It does not pretend to complete a different planned strength session."
          : "Užskaitoma kaip ištvermės treniruotė. Ji nebus klaidingai pažymėta kaip atlikta kita suplanuota jėgos sesija."}
      </p>
    </div>
  );
}
