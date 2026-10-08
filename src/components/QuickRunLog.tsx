import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Route, TimerReset } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { baseLang, useI18n } from "@/lib/i18n";
import { logEnduranceActivity, retryEnduranceRaceSync } from "@/lib/endurance-activity.functions";
import type { EnduranceRaceSyncResult } from "@/lib/endurance-race-sync.schema";
import { confirmRaceSessionMatchFn } from "@/lib/endurance-session-match.functions";

export function QuickRunLog({ onLogged }: { onLogged?: () => void | Promise<void> }) {
  const { lang } = useI18n();
  const english = baseLang(lang) === "en";
  const logActivity = useServerFn(logEnduranceActivity);
  const confirmMatch = useServerFn(confirmRaceSessionMatchFn);
  const retrySync = useServerFn(retryEnduranceRaceSync);
  const busy = useRef(false);
  const [deferredSync, setDeferredSync] = useState<{
    sessionId: string;
    phase: "matching" | "insights";
  } | null>(null);
  const [environment, setEnvironment] = useState<"outdoor" | "treadmill">("outdoor");
  const [minutes, setMinutes] = useState("");
  const [distanceKm, setDistanceKm] = useState("");
  const [rpe, setRpe] = useState("");
  const [saving, setSaving] = useState(false);
  const [pendingMatch, setPendingMatch] = useState<{
    sessionId: string;
    raceGoalId: string;
    planSessionKey: string;
    intent: "easy" | "long" | "tempo" | "intervals" | "recovery" | "race";
  } | null>(null);

  const applySync = (sessionId: string, result: EnduranceRaceSyncResult) => {
    setDeferredSync(
      result.raceSync.status === "deferred" ? { sessionId, phase: result.raceSync.phase } : null,
    );
    if (result.raceMatch?.status === "needs_confirmation") {
      setPendingMatch({
        sessionId,
        raceGoalId: result.raceMatch.raceGoalId,
        planSessionKey: result.raceMatch.plannedSessionKey,
        intent: result.raceMatch.intent,
      });
    } else setPendingMatch(null);
  };

  const refreshToday = async () => {
    try {
      await onLogged?.();
    } catch {
      // This callback is presentation refresh, not the durable save operation.
      toast.warning(
        english
          ? "Run saved. The dashboard could not refresh; do not save it again."
          : "Bėgimas išsaugotas. Nepavyko atnaujinti ekrano; nesaugok jo dar kartą.",
      );
    }
  };

  const retrySavedRun = async () => {
    if (!deferredSync || busy.current) return;
    busy.current = true;
    setSaving(true);
    try {
      const result = await retrySync({ data: { workoutSessionId: deferredSync.sessionId } });
      applySync(deferredSync.sessionId, result);
      window.dispatchEvent(
        new CustomEvent("gymslife:endurance-updated", {
          detail: { raceIntelligence: result.raceIntelligence },
        }),
      );
      await refreshToday();
    } catch {
      // Preserve the saved session ID for the next attempt; never call logActivity here.
      toast.error(
        english
          ? "Run is saved. Plan sync is still unavailable."
          : "Bėgimas išsaugotas. Plano susiejimas vis dar nepasiekiamas.",
      );
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };

  const submit = async () => {
    if (busy.current) return;
    const duration = Number(minutes);
    const distance = Number(distanceKm.replace(",", "."));
    const effort = rpe === "" ? null : Number(rpe);
    if (
      !Number.isFinite(duration) ||
      duration <= 0 ||
      !Number.isFinite(distance) ||
      distance <= 0
    ) {
      toast.error(english ? "Add duration and distance." : "Įrašyk trukmę ir atstumą.");
      return;
    }
    busy.current = true;
    setSaving(true);
    try {
      const result = await logActivity({
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
      applySync(result.session.id, result);
      setMinutes("");
      setDistanceKm("");
      setRpe("");
      window.dispatchEvent(new CustomEvent("gymslife:training-completed"));
      window.dispatchEvent(
        new CustomEvent("gymslife:endurance-updated", {
          detail: { raceIntelligence: result.raceIntelligence ?? null },
        }),
      );
      await refreshToday();
      toast.success(english ? "Run credited to today." : "Bėgimas užskaitytas šiandienai.");
    } catch {
      toast.error(english ? "Run could not be saved." : "Nepavyko išsaugoti bėgimo.");
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };

  const acceptMatch = async () => {
    if (!pendingMatch || busy.current) return;
    busy.current = true;
    setSaving(true);
    try {
      await confirmMatch({
        data: {
          workoutSessionId: pendingMatch.sessionId,
          raceGoalId: pendingMatch.raceGoalId,
          planSessionKey: pendingMatch.planSessionKey,
        },
      });
      setPendingMatch(null);
      setDeferredSync(null);
      window.dispatchEvent(new CustomEvent("gymslife:endurance-updated"));
      toast.success(
        english ? "Run linked to race preparation." : "Bėgimas susietas su pasiruošimo planu.",
      );
    } catch {
      toast.error(
        english ? "Could not confirm the race session." : "Nepavyko patvirtinti plano sesijos.",
      );
    } finally {
      busy.current = false;
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
          onClick={() => setEnvironment("outdoor")}
        >
          <Route className="size-4" /> {english ? "Outdoor" : "Lauke"}
        </Button>
        <Button
          type="button"
          variant={environment === "treadmill" ? "default" : "outline"}
          className="min-h-11"
          onClick={() => setEnvironment("treadmill")}
        >
          <TimerReset className="size-4" /> {english ? "Treadmill" : "Takelis"}
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Input
          inputMode="decimal"
          value={minutes}
          onChange={(e) => setMinutes(e.target.value)}
          placeholder={english ? "Minutes" : "Minutės"}
          aria-label={english ? "Duration in minutes" : "Trukmė minutėmis"}
        />
        <Input
          inputMode="decimal"
          value={distanceKm}
          onChange={(e) => setDistanceKm(e.target.value)}
          placeholder="km"
          aria-label={english ? "Distance in kilometres" : "Atstumas kilometrais"}
        />
      </div>
      <Input
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
      {deferredSync ? (
        <div className="rounded-[1.25rem] border border-border bg-surface p-3" aria-busy={saving}>
          <p role="status" className="text-sm text-foreground">
            {deferredSync.phase === "insights"
              ? english
                ? "Run saved and linked. Plan analysis could not refresh."
                : "Bėgimas išsaugotas ir susietas. Nepavyko atnaujinti plano analizės."
              : english
                ? "Run saved. Linking it to your race plan could not be completed."
                : "Bėgimas išsaugotas. Susiejimo su pasiruošimo planu nepavyko užbaigti."}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {english
              ? "Retry only this saved run's plan sync. It will not record another workout."
              : "Kartojamas tik šio išsaugoto bėgimo susiejimas. Nauja treniruotė nebus kuriama."}
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-3 min-h-11"
            disabled={saving}
            onClick={() => void retrySavedRun()}
          >
            {english ? "Retry plan sync" : "Pakartoti plano susiejimą"}
          </Button>
        </div>
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
