import { Link } from "@tanstack/react-router";
import { BrainCircuit, Moon, Scale, ShieldAlert, Sparkles, Activity } from "lucide-react";
import { baseLang, useI18n, type TKey } from "@/lib/i18n";
import { KNOWN_MUSCLE_GROUPS } from "@/lib/muscle-load.schema";
import type { TwinIntelligence } from "@/lib/twin-intelligence.schema";

const KNOWN = new Set<string>(KNOWN_MUSCLE_GROUPS);

function labelFor(region: string, t: (key: TKey) => string) {
  return KNOWN.has(region)
    ? t(`mg.${region}` as TKey)
    : region.charAt(0).toUpperCase() + region.slice(1).replaceAll("_", " ");
}

function modeCopy(mode: TwinIntelligence["mode"], lt: boolean) {
  const copy = {
    insufficient_evidence: lt
      ? "Twin dar renka bazinius duomenis"
      : "Twin is still building its baseline",
    context_attention: lt
      ? "Dabartinis kontekstas reikalauja dėmesio"
      : "Current context needs attention",
    recovery_attention: lt
      ? "Atsistatymo signalai reikalauja dėmesio"
      : "Recovery signals need attention",
    training_ready: lt
      ? "Dabartiniai signalai palaiko treniruotę"
      : "Current signals support training",
    balanced: lt ? "Dabartinė būsena subalansuota" : "Current state is balanced",
  };
  return copy[mode];
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface-2 px-3 py-2">
      <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-mono text-sm text-foreground">{value}</p>
    </div>
  );
}
export function TwinIntelligencePanel({
  intelligence,
  selectedRegion,
  onSelectRegion,
  compact = false,
}: {
  intelligence: TwinIntelligence;
  selectedRegion: string | null;
  onSelectRegion: (region: string) => void;
  compact?: boolean;
}) {
  const { t, lang } = useI18n();
  const lt = baseLang(lang) === "lt";
  const weightChange =
    intelligence.weightChangeKg30d === null
      ? "—"
      : `${intelligence.weightChangeKg30d > 0 ? "+" : ""}${intelligence.weightChangeKg30d.toFixed(1)} kg`;

  return (
    <section
      className={compact ? "space-y-3" : "rounded-2xl border border-border bg-surface/70 p-4"}
    >
      <div className="flex items-start gap-3">
        <BrainCircuit className="mt-0.5 size-4 shrink-0 text-primary" />
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
            {lt ? "Twin Intelligence" : "Twin Intelligence"}
          </p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {modeCopy(intelligence.mode, lt)}
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            {lt
              ? "Sujungta iš tavo patvirtintų treniruočių, readiness, miego, kūno ir raumenų apkrovos duomenų."
              : "Combined from your confirmed training, readiness, sleep, body and muscle-load data."}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Metric
          label={lt ? "Readiness" : "Readiness"}
          value={
            intelligence.readiness === null ? "—" : `${Math.round(intelligence.readiness)}/100`
          }
        />
        <Metric
          label={lt ? "Miegas 7 d." : "Sleep 7d"}
          value={
            intelligence.averageSleepHours7d === null
              ? "—"
              : `${intelligence.averageSleepHours7d.toFixed(1)} h`
          }
        />
        <Metric
          label={lt ? "Treniruotės 7 d." : "Sessions 7d"}
          value={String(intelligence.sessions7d)}
        />
        <Metric label={lt ? "Svorio pokytis 30 d." : "Weight change 30d"} value={weightChange} />
      </div>
      <div>
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
          <Activity className="size-3.5" /> {lt ? "Svarbiausios zonos" : "Priority regions"}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {intelligence.focusRegions.length ? (
            intelligence.focusRegions.map((region) => (
              <button
                key={region.region}
                type="button"
                aria-pressed={selectedRegion === region.region}
                onClick={() => onSelectRegion(region.region)}
                className={`min-h-10 rounded-full border px-3 text-xs transition-colors ${
                  selectedRegion === region.region
                    ? "border-primary/50 bg-primary/10 text-foreground"
                    : "border-border bg-surface-2 text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className="font-semibold">{labelFor(region.region, t)}</span>
                {region.recoveryPct !== null ? ` · ${region.recoveryPct}%` : " · —"}
              </button>
            ))
          ) : (
            <p className="text-xs text-muted-foreground">
              {lt
                ? "Dar nėra pakankamai raumenų apkrovos duomenų."
                : "Not enough muscle-load data yet."}
            </p>
          )}
        </div>
        {selectedRegion ? (
          <Link
            to="/twin"
            search={{ view: "muscles", region: selectedRegion, detail: "status" }}
            className="mt-2 inline-flex min-h-10 items-center text-xs font-semibold text-primary"
          >
            {lt ? "Atidaryti raumens detales" : "Open muscle details"} →
          </Link>
        ) : null}
      </div>

      {!compact ? (
        <div className="grid gap-2 sm:grid-cols-3">
          <Metric
            label={lt ? "Volume 28 d." : "Volume 28d"}
            value={`${Math.round(intelligence.trainingVolume28d).toLocaleString()} kg`}
          />
          <Metric
            label={lt ? "Svoris" : "Weight"}
            value={intelligence.weightKg === null ? "—" : `${intelligence.weightKg.toFixed(1)} kg`}
          />
          <Metric
            label={lt ? "Kūno riebalai" : "Body fat"}
            value={
              intelligence.bodyFatPercent === null
                ? "—"
                : `${intelligence.bodyFatPercent.toFixed(1)}%`
            }
          />
        </div>
      ) : null}

      <div className="flex items-start gap-2 text-[10px] leading-relaxed text-muted-foreground">
        {intelligence.hasSafetyConstraint ? (
          <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
        ) : intelligence.averageSleepHours7d !== null && intelligence.averageSleepHours7d < 6.5 ? (
          <Moon className="mt-0.5 size-3.5 shrink-0 text-primary" />
        ) : (
          <Sparkles className="mt-0.5 size-3.5 shrink-0 text-primary" />
        )}
        <span>
          {lt
            ? "Twin rodo faktus ir apskaičiuotus signalus, o ne medicininę diagnozę ar tiesioginį raumenų matavimą."
            : "Twin shows facts and calculated signals, not a medical diagnosis or direct muscle measurement."}
        </span>
      </div>
    </section>
  );
}
