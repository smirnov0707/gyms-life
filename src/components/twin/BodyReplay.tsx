import { useState } from "react";
import { BodyMap } from "@/components/twin/BodyMap";
import type { BodyMapRegion, BodyMapTone } from "@/components/twin/BodyMap";
import { isAnatomicalRegion, type BodyView } from "@/components/twin/body-map.geometry";
import { useI18n, type TKey } from "@/lib/i18n";
import { KNOWN_MUSCLE_GROUPS } from "@/lib/muscle-load.schema";
import {
  stimulusFor,
  type SessionMuscleContribution,
  type SessionStimulus,
} from "@/lib/session-muscle-breakdown";

const KNOWN_MUSCLE_GROUP_SET = new Set<string>(KNOWN_MUSCLE_GROUPS);

type Copy = {
  eyebrow: string;
  title: string;
  note: string;
  viewLabel: Record<BodyView, string>;
  stimulusLabel: Record<Exclude<SessionStimulus, "none">, string>;
  notWorked: string;
  sets: (count: number) => string;
  offBody: string;
};

function copyFor(lang: string): Copy {
  if (lang === "en") {
    return {
      eyebrow: "SESSION EFFECT",
      title: "What this session worked",
      note: "Measured from the sets you just logged, not an estimate.",
      viewLabel: { front: "Front", back: "Back" },
      stimulusLabel: { primary: "Primary", secondary: "Secondary", light: "Light" },
      notWorked: "Not worked",
      sets: (count) => (count === 1 ? "1 set" : `${count} sets`),
      offBody: "Not on the body",
    };
  }
  return {
    eyebrow: "TRENIRUOTĖS POVEIKIS",
    title: "Ką ši treniruotė apkrovė",
    note: "Išmatuota pagal ką tik užregistruotus setus, ne prognozė.",
    viewLabel: { front: "Priekis", back: "Nugara" },
    stimulusLabel: { primary: "Pagrindinis", secondary: "Antrinis", light: "Nedidelis" },
    notWorked: "Neapkrauta",
    sets: (count) => (count === 1 ? "1 setas" : `${count} setai`),
    offBody: "Ne ant kūno",
  };
}

/** Stimulus has its own vocabulary; here is where it becomes display tone. */
function toneForStimulus(stimulus: SessionStimulus): BodyMapTone {
  if (stimulus === "primary") return "hot";
  if (stimulus === "secondary") return "warm";
  if (stimulus === "light") return "cool";
  return "muted";
}

const TONE_DOT: Record<BodyMapTone, string> = {
  hot: "bg-rose-500",
  warm: "bg-amber-400",
  cool: "bg-emerald-400",
  muted: "bg-muted-foreground/50",
};

function regionLabelFor(region: string, t: (key: TKey) => string): string {
  if (KNOWN_MUSCLE_GROUP_SET.has(region)) return t(`mg.${region}` as TKey);
  return region.charAt(0).toUpperCase() + region.slice(1).replaceAll("_", " ");
}

/**
 * Part IX body replay: the session's own effect, shown on the same figure the
 * Twin uses. Every group that was worked is listed, including the ones that
 * have no place on a body — the figure is never the only path to the data.
 */
export function BodyReplay({ contributions }: { contributions: SessionMuscleContribution[] }) {
  const { lang, t } = useI18n();
  const copy = copyFor(lang);
  const worked = new Map(contributions.map((entry) => [entry.muscleGroup, entry]));

  // A group with no contribution is drawn muted rather than omitted, so the
  // figure shows what today did not touch as plainly as what it did.
  const regions: BodyMapRegion[] = KNOWN_MUSCLE_GROUPS.filter(isAnatomicalRegion).map((group) => {
    const entry = worked.get(group);
    return {
      region: group,
      tone: entry ? toneForStimulus(stimulusFor(entry)) : "muted",
      value: entry ? (entry.volumeKg > 0 ? `${entry.volumeKg} kg` : copy.sets(entry.sets)) : null,
    };
  });

  const heaviest = contributions.find((entry) => isAnatomicalRegion(entry.muscleGroup));
  const [view, setView] = useState<BodyView>(() =>
    heaviest && !segmentsOnFront(heaviest.muscleGroup) ? "back" : "front",
  );
  const [selected, setSelected] = useState<string | null>(heaviest?.muscleGroup ?? null);

  return (
    <section className="mt-6 rounded-2xl border border-border bg-surface-2 p-5 text-left">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
            {copy.eyebrow}
          </p>
          <h2 className="mt-2 text-xl">{copy.title}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{copy.note}</p>
        </div>
        <div className="flex gap-1 rounded-full border border-border bg-surface p-1">
          {(["front", "back"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setView(option)}
              aria-pressed={view === option}
              className={`min-h-8 rounded-full px-3 text-[11px] font-bold uppercase tracking-[0.14em] transition-colors motion-reduce:transition-none ${
                view === option
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {copy.viewLabel[option]}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-5 sm:grid-cols-[minmax(140px,190px)_1fr] sm:items-start">
        <div className="mx-auto h-[300px] w-full max-w-[190px]">
          <BodyMap
            regions={regions}
            view={view}
            selectedRegion={selected}
            onSelectRegion={setSelected}
            regionLabel={(region) => regionLabelFor(region, t)}
          />
        </div>

        <ul className="space-y-2.5">
          {contributions.map((entry) => {
            const stimulus = stimulusFor(entry);
            const tone = toneForStimulus(stimulus);
            return (
              <li key={entry.muscleGroup}>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className={`size-2 shrink-0 rounded-full ${TONE_DOT[tone]}`} />
                    <span className="truncate text-sm font-medium text-foreground">
                      {regionLabelFor(entry.muscleGroup, t)}
                    </span>
                    {!isAnatomicalRegion(entry.muscleGroup) && (
                      <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        {copy.offBody}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">
                    {entry.volumeKg > 0 ? `${entry.volumeKg} kg` : copy.sets(entry.sets)}
                  </span>
                </div>
                {/* A bar is only drawn when there is a share to draw. A
                    zero-width fill reads as a broken control, not as a fact —
                    the row's own text still reports the 0%. */}
                {entry.shareOfSession !== null && entry.shareOfSession > 0 && (
                  <span className="mt-1.5 block h-1.5 w-full overflow-hidden rounded-full bg-surface">
                    <span
                      className={`block h-full rounded-full ${TONE_DOT[tone]}`}
                      style={{ width: `${Math.round(entry.shareOfSession * 100)}%` }}
                    />
                  </span>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  {copy.stimulusLabel[stimulus === "none" ? "light" : stimulus]} ·{" "}
                  {copy.sets(entry.sets)}
                  {entry.shareOfSession !== null
                    ? ` · ${Math.round(entry.shareOfSession * 100)}%`
                    : ""}
                </p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

/** Front-only groups decide which side the replay opens on. */
function segmentsOnFront(region: string): boolean {
  return !["back", "glutes"].includes(region);
}
