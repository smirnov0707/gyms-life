import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Flag, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { baseLang, useI18n } from "@/lib/i18n";
import { startRacePreparation } from "@/lib/endurance-race-goal.functions";
import type { RaceDistance } from "@/lib/endurance-activity.schema";

const distances: Array<{ value: RaceDistance; label: string }> = [
  { value: "5k", label: "5K" }, { value: "10k", label: "10K" },
  { value: "half_marathon", label: "21.1K" }, { value: "marathon", label: "42.2K" },
];

export function RacePrepStarter() {
  const { lang } = useI18n();
  const english = baseLang(lang) === "en";
  const start = useServerFn(startRacePreparation);
  const [distance, setDistance] = useState<RaceDistance>("10k");
  const [raceDate, setRaceDate] = useState("");
  const [sessions, setSessions] = useState(4);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ weeks: number; measured: boolean } | null>(null);

  const submit = async () => {
    if (!raceDate) { toast.error(english ? "Choose race date." : "Pasirink varžybų datą."); return; }
    setSaving(true);
    try {
      const response = await start({ data: {
        goal: { distance, raceDate, sessionsPerWeek: sessions, targetTimeSeconds: null, longestRecentRunMeters: null },
      }});
      setResult({ weeks: response.plan.weeks, measured: response.plan.baseline === "measured" });
      toast.success(english ? "Race preparation created." : "Pasiruošimas varžyboms sukurtas.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : (english ? "Could not create race preparation." : "Nepavyko sukurti pasiruošimo."));
    } finally { setSaving(false); }
  };

  return (
    <section className="fl-premium-card grid gap-4 rounded-[2rem] border border-border bg-surface p-4 sm:p-5">
      <div>
        <p className="fl-eyebrow">ENDURANCE OS</p>
        <h2 className="mt-2 text-2xl font-semibold">{english ? "Prepare for a race" : "Pasiruošk varžyboms"}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{english ? "Your recent running becomes the baseline. The plan adapts from evidence, not guesswork." : "Tavo naujausi bėgimai tampa atskaitos tašku. Planas adaptuojamas pagal duomenis, ne spėjimus."}</p>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {distances.map((item) => <Button key={item.value} type="button" variant={distance === item.value ? "default" : "outline"} className="min-h-11 px-2" onClick={() => setDistance(item.value)}>{item.label}</Button>)}
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <Input type="date" value={raceDate} onChange={(e) => setRaceDate(e.target.value)} aria-label={english ? "Race date" : "Varžybų data"} />
        <div className="flex items-center gap-2">
          {[3, 4, 5].map((n) => <Button key={n} type="button" variant={sessions === n ? "default" : "outline"} className="min-h-11" onClick={() => setSessions(n)}>{n}×/{english ? "wk" : "sav."}</Button>)}
        </div>
      </div>
      <Button className="min-h-11" disabled={saving} onClick={() => void submit()}>
        {saving ? <Loader2 className="size-4 animate-spin" /> : <Flag className="size-4" />}
        {english ? "Build race preparation" : "Sukurti pasiruošimą"}
      </Button>
      {result ? <p className="text-sm text-primary">{english ? result.weeks + "-week preparation created · baseline: " + (result.measured ? "your recent runs" : "conservative start") : "Sukurtas " + result.weeks + " sav. pasiruošimas · bazė: " + (result.measured ? "tavo realūs bėgimai" : "konservatyvi pradžia")}</p> : null}
    </section>
  );
}
