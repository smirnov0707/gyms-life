import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Droplets, Plus, RotateCcw } from "lucide-react";
import { Button } from "./ui/button";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { browserTimeZone, dayInTimeZone } from "@/lib/local-day";
import { getHydrationTarget } from "@/lib/hydration.functions";
import { HYDRATION_GENERIC_BASELINE_ML } from "@/lib/hydration.engine";
import type {
  HydrationComponentKey,
  HydrationMissingInput,
  HydrationTarget,
} from "@/lib/hydration.schema";

const todayKey = () => dayInTimeZone(new Date(), browserTimeZone());
const storageKey = (userId: string) => `gymslife:hydration:${userId}:${todayKey()}`;

type Copy = {
  breakdown: string;
  componentLabel: Record<HydrationComponentKey, string>;
  baselineFrom: (weightKg: number, mlPerKg: number) => string;
  trainingFrom: (minutes: number) => string;
  proteinFrom: (grams: number, perKg: number) => string;
  genericBaseline: string;
  missingTitle: string;
  missingLabel: Record<HydrationMissingInput, string>;
  addWeight: string;
  logMeals: string;
  electrolyteNote: string;
  cappedNote: (fromMl: number) => string;
  estimateNote: string;
};

function copyFor(lang: string): Copy {
  if (lang === "en") {
    return {
      breakdown: "How this number is made",
      componentLabel: {
        baseline: "Body mass",
        training: "Training today",
        creatine: "Creatine",
        stimulants: "Pre-workout",
        protein: "High protein day",
      },
      baselineFrom: (weightKg, mlPerKg) => `${weightKg} kg × ${mlPerKg} ml`,
      trainingFrom: (minutes) => `${minutes} min logged`,
      proteinFrom: (grams, perKg) => `${grams} g · ${perKg} g/kg`,
      genericBaseline: "General adult default",
      missingTitle: "Not counted yet",
      missingLabel: {
        body_weight: "Your body weight",
        nutrition: "Today's meals",
        training: "A finished session today",
      },
      addWeight: "Add weight",
      logMeals: "Log a meal",
      electrolyteNote: "At this volume, replace electrolytes too — water alone dilutes sodium.",
      cappedNote: (fromMl) =>
        `The components add up to ${fromMl} ml. Held at the daily ceiling, since drinking well past need carries its own risk.`,
      estimateNote:
        "A calculated estimate from your logged data, not a measurement or medical advice.",
    };
  }
  return {
    breakdown: "Iš ko sudarytas šis skaičius",
    componentLabel: {
      baseline: "Kūno masė",
      training: "Šiandienos treniruotė",
      creatine: "Kreatinas",
      stimulants: "Prieštreniruotinis",
      protein: "Daug baltymų diena",
    },
    baselineFrom: (weightKg, mlPerKg) => `${weightKg} kg × ${mlPerKg} ml`,
    trainingFrom: (minutes) => `${minutes} min. užregistruota`,
    proteinFrom: (grams, perKg) => `${grams} g · ${perKg} g/kg`,
    genericBaseline: "Bendras suaugusiojo vidurkis",
    missingTitle: "Kol kas neįskaičiuota",
    missingLabel: {
      body_weight: "Tavo kūno svoris",
      nutrition: "Šiandienos valgiai",
      training: "Šiandien užbaigta treniruotė",
    },
    addWeight: "Įvesti svorį",
    logMeals: "Registruoti valgį",
    electrolyteNote: "Prie tokio kiekio papildyk ir elektrolitus — vien vanduo skiedžia natrį.",
    cappedNote: (fromMl) =>
      `Dedamosios sudaro ${fromMl} ml. Paliktas dienos maksimumas, nes gerti gerokai daugiau nei reikia taip pat rizikinga.`,
    estimateNote:
      "Apskaičiuotas įvertis pagal tavo registruotus duomenis — ne matavimas ir ne medicininis patarimas.",
  };
}

/** The arithmetic behind one component, so the total can be checked. */
function componentBasis(
  component: HydrationTarget["components"][number],
  copy: Copy,
): string | null {
  const { weightKg, mlPerKg, minutes, proteinG, perKg } = component.inputs;
  if (component.key === "baseline") {
    return weightKg !== undefined && mlPerKg !== undefined
      ? copy.baselineFrom(weightKg, mlPerKg)
      : copy.genericBaseline;
  }
  if (component.key === "training" && minutes !== undefined) return copy.trainingFrom(minutes);
  if (component.key === "protein" && proteinG !== undefined && perKg !== undefined) {
    return copy.proteinFrom(proteinG, perKg);
  }
  return null;
}

/**
 * Today's fluid target, derived from body mass, the training actually logged,
 * the day's protein and the supplements being taken — with the whole sum shown
 * rather than a number handed over on trust. What we could not derive is named
 * as missing instead of being silently assumed.
 *
 * Title and progress keep the shared i18n keys: those already carry all eight
 * locales. The breakdown copy below is domain copy and follows the local
 * `copyFor` convention used elsewhere in the app.
 */
export const QuickHydrationWidget: React.FC = () => {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const copy = copyFor(lang);
  const [currentMl, setCurrentMl] = useState<number>(0);
  const [ready, setReady] = useState(false);

  const { data: target } = useQuery({
    queryKey: ["hydration-target", user?.id, todayKey()],
    queryFn: () => getHydrationTarget({ data: browserTimeZone() }),
    enabled: !!user,
    staleTime: 5 * 60_000,
  });

  const targetMl = target?.targetMl ?? HYDRATION_GENERIC_BASELINE_ML;

  // Load today's real intake (starts at 0 for a fresh day / fresh login).
  useEffect(() => {
    if (!user) return;
    try {
      const raw = window.localStorage.getItem(storageKey(user.id));
      const parsed = raw ? Number(raw) : 0;
      setCurrentMl(Number.isFinite(parsed) && parsed > 0 ? parsed : 0);
    } catch {
      setCurrentMl(0);
    }
    setReady(true);
  }, [user]);

  const persist = (value: number) => {
    setCurrentMl(value);
    if (!user) return;
    try {
      window.localStorage.setItem(storageKey(user.id), String(value));
    } catch {
      /* storage unavailable — keep in-memory only */
    }
  };

  const addWater = (amount: number) => persist(Math.min(targetMl + 1000, currentMl + amount));
  const resetWater = () => persist(0);

  const percentage = Math.min(100, Math.round((currentMl / targetMl) * 100));

  return (
    <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-cyan-950/30 via-surface to-surface p-5 shadow-2xl backdrop-blur-xl">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-2 text-cyan-400">
            <Droplets className="size-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
              {t("ms.hydration.title")}
            </h3>
            <p className="text-xs text-muted-foreground">
              {t("ms.hydration.progress")
                .replace("{cur}", String(ready ? currentMl : 0))
                .replace("{target}", String(targetMl))
                .replace("{pct}", String(ready ? percentage : 0))}
            </p>
          </div>
        </div>
        <Button
          onClick={resetWater}
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="size-4" />
        </Button>
      </div>

      <div className="relative mb-4 h-3.5 w-full overflow-hidden rounded-full border border-border bg-surface">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-500 motion-reduce:transition-none"
          style={{ width: `${ready ? percentage : 0}%` }}
        />
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[250, 500, 750].map((amount) => (
          <Button
            key={amount}
            onClick={() => addWater(amount)}
            variant="outline"
            size="sm"
            className="min-h-11 border-border bg-surface text-xs text-foreground hover:border-cyan-500/40 hover:bg-cyan-950/40"
          >
            <Plus className="mr-1 size-3.5 text-cyan-400" /> {amount} ml
          </Button>
        ))}
      </div>

      {target ? (
        <>
          {target.electrolyteNote ? (
            <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs leading-5 text-muted-foreground">
              {copy.electrolyteNote}
            </p>
          ) : null}

          <details className="mt-4 border-t border-border pt-3">
            <summary className="cursor-pointer text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              {copy.breakdown}
            </summary>

            <ul className="mt-3 space-y-1.5">
              {target.components.map((component) => {
                const basis = componentBasis(component, copy);
                return (
                  <li
                    key={component.key}
                    className="flex items-baseline justify-between gap-3 text-sm"
                  >
                    <span className="min-w-0">
                      <span className="text-foreground">{copy.componentLabel[component.key]}</span>
                      {basis ? (
                        <span className="ml-2 text-xs text-muted-foreground">{basis}</span>
                      ) : null}
                    </span>
                    <span className="shrink-0 font-mono text-xs text-muted-foreground">
                      +{component.ml} ml
                    </span>
                  </li>
                );
              })}
            </ul>

            {target.cappedFromMl !== null ? (
              <p className="mt-3 text-xs leading-5 text-muted-foreground">
                {copy.cappedNote(target.cappedFromMl)}
              </p>
            ) : null}

            {target.missingInputs.length > 0 ? (
              <div className="mt-3 border-t border-border pt-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                  {copy.missingTitle}
                </p>
                <ul className="mt-1.5 space-y-1">
                  {target.missingInputs.map((missing) => (
                    <li key={missing} className="text-xs text-muted-foreground">
                      {copy.missingLabel[missing]}
                    </li>
                  ))}
                </ul>
                <div className="mt-2 flex flex-wrap gap-2">
                  {target.missingInputs.includes("body_weight") ? (
                    <Button asChild variant="outline" size="sm" className="min-h-9 rounded-full">
                      <Link to="/progress">{copy.addWeight}</Link>
                    </Button>
                  ) : null}
                  {target.missingInputs.includes("nutrition") ? (
                    <Button asChild variant="outline" size="sm" className="min-h-9 rounded-full">
                      <Link to="/nutrition">{copy.logMeals}</Link>
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : null}

            <p className="mt-3 text-xs leading-5 text-muted-foreground">{copy.estimateNote}</p>
          </details>
        </>
      ) : null}
    </div>
  );
};
