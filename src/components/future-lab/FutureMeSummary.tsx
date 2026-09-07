import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, BrainCircuit, Dumbbell, Moon, Scale, Sparkles } from "lucide-react";
import { FutureLabEmpty, FutureLabPanel } from "./FutureLabPanel";
import { baseLang, useI18n } from "@/lib/i18n";
import { getTwinTrendHistory } from "@/lib/twin-trend.functions";
import {
  buildTwinMetricTrend,
  type TwinTrendHistory,
  type TwinTrendMetricKey,
} from "@/lib/twin-trend";

const ranges = [30, 90, 180, 0] as const;

type Metric = {
  key: TwinTrendMetricKey;
  labelLt: string;
  labelEn: string;
  unit: string;
  icon: typeof Activity;
};

const metrics: Metric[] = [
  { key: "readiness", labelLt: "Readiness", labelEn: "Readiness", unit: "", icon: Activity },
  {
    key: "totalVolumeLast28Days",
    labelLt: "28 d. krūvis",
    labelEn: "28d load",
    unit: "kg",
    icon: Dumbbell,
  },
  { key: "sleepHours", labelLt: "Miegas", labelEn: "Sleep", unit: "h", icon: Moon },
  { key: "weightKg", labelLt: "Svoris", labelEn: "Weight", unit: "kg", icon: Scale },
];

function scopedHistory(history: TwinTrendHistory, days: number): TwinTrendHistory {
  if (days === 0) return history;
  const cutoff = Date.now() - days * 86_400_000;
  return {
    ...history,
    points: history.points.filter((point) => Date.parse(point.computedAt) >= cutoff),
  };
}

export function FutureMeSummary() {
  const { lang } = useI18n();
  const isEnglish = baseLang(lang) === "en";
  const [range, setRange] = useState<(typeof ranges)[number]>(30);
  const query = useQuery({
    queryKey: ["future-me-trend"],
    queryFn: () => getTwinTrendHistory(),
    staleTime: 60_000,
  });
  const history = useMemo(
    () => (query.data ? scopedHistory(query.data, range) : null),
    [query.data, range],
  );

  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-[#182846] bg-[#040913] p-5 shadow-[0_35px_100px_rgba(0,0,0,.35)] sm:p-7">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_75%_0%,rgba(109,40,217,.18),transparent_35%),radial-gradient(circle_at_15%_75%,rgba(6,182,212,.08),transparent_30%)]"
      />
      <div className="relative">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-violet-300">
              FUTURE ME
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-5xl">
              {isEnglish ? "Your observed trajectory" : "Tavo stebima trajektorija"}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-400">
              {isEnglish
                ? "Real stored Digital Athlete snapshots show how your state has changed. This screen does not invent a future body or call an observed direction a forecast."
                : "Realūs išsaugoti Digital Athlete snapshot'ai rodo, kaip keitėsi tavo būsena. Šis ekranas neišgalvoja būsimo kūno ir stebėtos krypties nevadina prognoze."}
            </p>
          </div>
          <div
            className="flex flex-wrap gap-2"
            aria-label={isEnglish ? "Observation window" : "Stebėjimo langas"}
          >
            {ranges.map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => setRange(days)}
                className={`min-h-10 rounded-xl border px-4 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                  range === days
                    ? "border-violet-400/55 bg-violet-500/20 text-violet-100"
                    : "border-[#1b2940] bg-[#08111e] text-slate-500 hover:text-slate-200"
                }`}
              >
                {days === 0 ? (isEnglish ? "ALL" : "VISKAS") : `${days}D`}
              </button>
            ))}
          </div>
        </div>

        {query.isError ? (
          <div className="mt-6">
            <FutureLabEmpty>
              {isEnglish
                ? "Trajectory data is temporarily unavailable."
                : "Trajektorijos duomenys laikinai nepasiekiami."}
            </FutureLabEmpty>
          </div>
        ) : (
          <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map((metric) => {
              const series = history ? buildTwinMetricTrend(history, metric.key) : null;
              const Icon = metric.icon;
              return (
                <FutureLabPanel
                  key={metric.key}
                  title={isEnglish ? metric.labelEn : metric.labelLt}
                  action={<Icon className="size-4 text-cyan-300" />}
                >
                  {series?.latestValue != null ? (
                    <>
                      <p className="text-3xl font-semibold text-white">
                        {Math.round(series.latestValue * 10) / 10}
                        {metric.unit ? (
                          <span className="ml-1 text-sm text-slate-500">{metric.unit}</span>
                        ) : null}
                      </p>
                      <p className="mt-2 text-[11px] text-slate-500">
                        {series.availability === "available" && series.netChange != null
                          ? `${series.netChange >= 0 ? "+" : ""}${Math.round(series.netChange * 10) / 10}${metric.unit ? ` ${metric.unit}` : ""} ${isEnglish ? "across this observed window" : "šiame stebėtame lange"}`
                          : isEnglish
                            ? "Not enough temporal coverage for a direction."
                            : "Krypčiai dar nepakanka laiko aprėpties."}
                      </p>
                    </>
                  ) : (
                    <FutureLabEmpty>
                      {isEnglish
                        ? "No compatible observations in this window."
                        : "Šiame lange nėra suderinamų stebėjimų."}
                    </FutureLabEmpty>
                  )}
                </FutureLabPanel>
              );
            })}
          </div>
        )}

        <div className="mt-4 grid gap-3 lg:grid-cols-[1.3fr_.7fr]">
          <FutureLabPanel
            eyebrow={isEnglish ? "SIMULATION STATUS" : "SIMULIACIJOS BŪSENA"}
            title={
              isEnglish ? "Future simulation remains gated" : "Ateities simuliacija dar užrakinta"
            }
            action={<Sparkles className="size-4 text-violet-300" />}
          >
            <p className="text-sm leading-relaxed text-slate-300">
              {isEnglish
                ? "GYMS.LIFE will only render projected outcomes after a versioned model has a defined target, evaluation window and calibration evidence. Until then, you see observed evolution instead of a fictional transformation."
                : "GYMS.LIFE rodys projektuojamus rezultatus tik tada, kai versijuotas modelis turės aiškų target'ą, vertinimo langą ir kalibravimo įrodymus. Iki tol matai realiai stebėtą evoliuciją, o ne išgalvotą transformaciją."}
            </p>
          </FutureLabPanel>
          <FutureLabPanel
            eyebrow={isEnglish ? "MODEL PRINCIPLE" : "MODELIO PRINCIPAS"}
            title={isEnglish ? "Known ≠ inferred ≠ predicted" : "Known ≠ inferred ≠ predicted"}
            action={<BrainCircuit className="size-4 text-emerald-300" />}
          >
            <p className="text-xs leading-relaxed text-slate-400">
              {isEnglish
                ? "Missing data stays missing. A trend needs at least four compatible observations across 72 hours."
                : "Trūkstami duomenys lieka trūkstami. Trendui reikia bent keturių suderinamų stebėjimų per 72 valandas."}
            </p>
          </FutureLabPanel>
        </div>
      </div>
    </section>
  );
}
