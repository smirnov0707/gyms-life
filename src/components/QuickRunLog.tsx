import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Route, TimerReset } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { baseLang, useI18n } from "@/lib/i18n";
import { logEnduranceActivity } from "@/lib/endurance-activity.functions";
import { confirmRaceSessionMatchFn } from "@/lib/endurance-session-match.functions";

export function QuickRunLog({ onLogged }: { onLogged?: () => void | Promise<void> }) {
  const { lang } = useI18n();
  const english = baseLang(lang) === "en";
  const logActivity = useServerFn(logEnduranceActivity);
  const confirmMatch = useServerFn(confirmRaceSessionMatchFn);
  const [environment, setEnvironment] = useState<"outdoor" | "treadmill">("outdoor");
  const [minutes, setMinutes] = useState("");
  const [distanceKm, setDistanceKm] = useState("");
  const [rpe, setRpe] = useState("");
  const [saving, setSaving] = useState(false);
  const [pendingMatch, setPendingMatch] = useState<{ sessionId: string; raceGoalId: string; planSessionKey: string; intent: "easy" | "long" | "tempo" | "intervals" | "recovery" | "race" } | null>(null);

  const submit = async () => {
    const duration = Number(minutes);
    const distance = Number(distanceKm.replace(",", "."));
    const effort = rpe === "" ? null : Number(rpe);
    if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(distance) || distance <= 0) {
      toast.error(english ? "Add duration and distance." : "Įrašyk trukmę ir atstumą.");
      return;
    }
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
      if (result.raceMatch?.status === "needs_confirmation" && result.raceMatch.intent) {
        setPendingMatch({ sessionId: result.session.id, raceGoalId: result.raceMatch.raceGoalId, planSessionKey: result.raceMatch.plannedSessionKey, intent: result.raceMatch.intent });
      } else {
        setPendingMatch(null);
      }
      setMinutes("");
      setDistanceKm("");
      setRpe("");
      window.dispatchEvent(new CustomEvent("gymslife:training-completed"));
      window.dispatchEvent(new CustomEvent("gymslife:endurance-updated"));
      await onLogged?.();
      toast.success(english ? "Run credited to today." : "Bėgimas užskaitytas šiandienai.");
    } catch {
      toast.error(english ? "Run could not be saved." : "Nepavyko išsaugoti bėgimo.");
    } finally {
      setSaving(false);
    }
  };

  const acceptMatch = async () => {
    if (!pendingMatch) return;
    setSaving(true);
    try {
      await confirmMatch({ data: { workoutSessionId: pendingMatch.sessionId, raceGoalId: pendingMatch.raceGoalId, planSessionKey: pendingMatch.planSessionKey } });
      setPendingMatch(null);
      window.dispatchEvent(new CustomEvent("gymslife:endurance-updated"));
      toast.success(english ? "Run linked to race preparation." : "Bėgimas susietas su pasiruošimo planu.");
    } catch {
      toast.error(english ? "Could not confirm the race session." : "Nepavyko patvirtinti plano sesijos.");
    } finally { setSaving(false); }
  };

  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-2 gap-2" role="group" aria-label={english ? "Run environment" : "Bėgimo aplinka"}>
        <Button type="button" variant={environment === "outdoor" ? "default" : "outline"} className="min-h-11" onClick={() => setEnvironment("outdoor")}>
          <Route className="size-4" /> {english ? "Outdoor" : "Lauke"}
        </Button>
        <Button type="button" variant={environment === "treadmill" ? "default" : "outline"} className="min-h-11" onClick={() => setEnvironment("treadmill")}>
          <TimerReset className="size-4" /> {english ? "Treadmill" : "Takelis"}
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Input inputMode="decimal" value={minutes} onChange={(e) => setMinutes(e.target.value)} placeholder={english ? "Minutes" : "Minutės"} aria-label={english ? "Duration in minutes" : "Trukmė minutėmis"} />
        <Input inputMode="decimal" value={distanceKm} onChange={(e) => setDistanceKm(e.target.value)} placeholder="km" aria-label={english ? "Distance in kilometres" : "Atstumas kilometrais"} />
      </div>
      <Input inputMode="numeric" value={rpe} onChange={(e) => setRpe(e.target.value)} placeholder={english ? "Effort 1–10 (optional)" : "Pastangos 1–10 (nebūtina)"} aria-label={english ? "Perceived effort from 1 to 10" : "Juntamos pastangos nuo 1 iki 10"} />
      <Button type="button" className="min-h-11" disabled={saving} onClick={() => void submit()}>
        {saving ? <Loader2 className="size-4 animate-spin" /> : null}
        {english ? "Credit this run" : "Užskaityti bėgimą"}
      </Button>
      {pendingMatch ? (
        <div className="rounded-[1.25rem] border border-primary/30 bg-primary/5 p-3">
          <p className="text-sm font-semibold">{english ? "Was this your planned " + pendingMatch.intent + " run?" : "Ar tai buvo tavo suplanuotas „" + pendingMatch.intent + "“ bėgimas?"}</p>
          <p className="mt-1 text-xs text-muted-foreground">{english ? "The evidence is close, but not strong enough for automatic classification." : "Duomenys panašūs, bet jų neužtenka automatiniam priskyrimui."}</p>
          <div className="mt-3 flex gap-2">
            <Button type="button" size="sm" disabled={saving} onClick={() => void acceptMatch()}>{english ? "Yes, count it" : "Taip, užskaityti"}</Button>
            <Button type="button" size="sm" variant="ghost" disabled={saving} onClick={() => setPendingMatch(null)}>{english ? "No" : "Ne"}</Button>
          </div>
        </div>
      ) : null}
      <p className="text-xs leading-relaxed text-muted-foreground">
        {english ? "Counts as endurance training. It does not pretend to complete a different planned strength session." : "Užskaitoma kaip ištvermės treniruotė. Ji nebus klaidingai pažymėta kaip atlikta kita suplanuota jėgos sesija."}
      </p>
    </div>
  );
}
