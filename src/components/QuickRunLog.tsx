import { useRef, useState } from "react";
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

export function QuickRunLog({ onLogged }: { onLogged?: () => void | Promise<void> }) {
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

  const submit = async () => {
    if (inFlight.current) return;
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
    try {
      let result;
      try {
        result = await logActivity({
          data: {
            kind: "run",
            environment,
            source: "manual",
            startedAt: new Date(Date.now() - duration * 60_000).toISOString(),
            durationSeconds: Math.round(duration * 60),
            distanceMeters: Math.round(distance * 1000),
            averageHeartRateBpm: null,
            perceivedEffort: effort,
          },
        });
      } catch {
        toast.error(english ? "Run could not be saved." : "Nepavyko išsaugoti bėgimo.");
        return;
      }
      applyEnrichment(result.session.id, result);
      setMinutes("");
      setDistanceKm("");
      setRpe("");
      toast.success(english ? "Run credited to today." : "Bėgimas užskaitytas šiandienai.");
      await refreshSavedRun(true, result.raceIntelligence);
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  };

  const retryPlanCheck = async () => {
    if (inFlight.current || !savedRun?.enrichment.retryable) return;
    inFlight.current = true;
    setSaving(true);
    try {
      const result = await retryEnrichment({ data: { workoutSessionId: savedRun.sessionId } });
      applyEnrichment(savedRun.sessionId, result);
      await refreshSavedRun(false, result.raceIntelligence);
    } catch {
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
    try {
      await confirmMatch({
        data: {
          workoutSessionId: pendingMatch.sessionId,
          raceGoalId: pendingMatch.raceGoalId,
          planSessionKey: pendingMatch.planSessionKey,
        },
      });
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
          disabled={saving}
          onClick={() => setEnvironment("outdoor")}
        >
          <Route className="size-4" /> {english ? "Outdoor" : "Lauke"}
        </Button>
        <Button
          type="button"
          variant={environment === "treadmill" ? "default" : "outline"}
          className="min-h-11"
          disabled={saving}
          onClick={() => setEnvironment("treadmill")}
        >
          <TimerReset className="size-4" /> {english ? "Treadmill" : "Takelis"}
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Input
          disabled={saving}
          inputMode="decimal"
          value={minutes}
          onChange={(e) => setMinutes(e.target.value)}
          placeholder={english ? "Minutes" : "Minutės"}
          aria-label={english ? "Duration in minutes" : "Trukmė minutėmis"}
        />
        <Input
          disabled={saving}
          inputMode="decimal"
          value={distanceKm}
          onChange={(e) => setDistanceKm(e.target.value)}
          placeholder="km"
          aria-label={english ? "Distance in kilometres" : "Atstumas kilometrais"}
        />
      </div>
      <Input
        disabled={saving}
        inputMode="numeric"
        value={rpe}
        onChange={(e) => setRpe(e.target.value)}
        placeholder={english ? "Effort 1–10 (optional)" : "Pastangos 1–10 (nebūtina)"}
        aria-label={english ? "Perceived effort from 1 to 10" : "Juntamos pastangos nuo 1 iki 10"}
      />
      <Button type="button" className="min-h-11" disabled={saving} onClick={() => void submit()}>
        {saving ? <Loader2 className="size-4 animate-spin" /> : null}
        {english ? "Credit this run" : "Užskaityti bėgimą"}
      </Button>
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
            disabled={saving}
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
            <Button type="button" size="sm" disabled={saving} onClick={() => void acceptMatch()}>
              {english ? "Yes, count it" : "Taip, užskaityti"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={saving}
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
