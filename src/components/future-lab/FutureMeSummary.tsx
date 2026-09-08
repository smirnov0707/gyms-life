import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, BrainCircuit, Dumbbell, Moon, Scale, Sparkles } from "lucide-react";
import { FutureLabEmpty, FutureLabPanel } from "./FutureLabPanel";
import { baseLang, useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { getTwinTrendHistory } from "@/lib/twin-trend.functions";
import {
  buildTwinMetricTrend,
  type TwinTrendHistory,
  type TwinTrendMetricKey,
  type TwinTrendSeries,
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

function ObservedLine({ series, label }: { series: TwinTrendSeries; label: string }) {
  if (series.availability !== "available" || series.samples.length < 4) return null;
  const firstSample = series.samples[0];
  const lastSample = series.samples[series.samples.length - 1];
  if (!firstSample || !lastSample) return null;
  const first = Date.parse(firstSample.computedAt);
  const duration = Date.parse(lastSample.computedAt) - first;
  if (duration <= 0 || series.minValue === null || series.maxValue === null) return null;
  const minimum = series.minValue;
  const range = series.maxValue - minimum;
  const points = series.samples
    .map((sample) => {
      const x = 3 + ((Date.parse(sample.computedAt) - first) / duration) * 234;
      const y = range === 0 ? 28 : 49 - ((sample.value - minimum) / range) * 42;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg
      viewBox="0 0 240 56"
      role="img"
      aria-label={label}
      className="mt-3 h-14 w-full text-cyan-400"
    >
      <path d="M3 50H237" stroke="currentColor" strokeOpacity=".12" />
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function FutureMeSummary() {
  const { lang } = useI18n();
  const isEnglish = baseLang(lang) === "en";
  const { user } = useAuth();
  const [range, setRange] = useState<(typeof ranges)[number]>(30);
  const query = useQuery({
    queryKey: ["future-me-trend", user?.id],
    queryFn: () => getTwinTrendHistory(),
    enabled: !!user,
    staleTime: 60_000,
  });
  const history = useMemo(
    () => (query.data ? scopedHistory(query.data, range) : null),
    [query.data, range],
  );

  return (
    <section className="fl-observed-page fl-panel relative overflow-hidden rounded-xl border border-border bg-surface/90 p-4 sm:p-5">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_75%_0%,rgba(109,40,217,.18),transparent_35%),radial-gradient(circle_at_15%_75%,rgba(6,182,212,.08),transparent_30%)]"
      />
      <div className="relative">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-violet-300">
              FUTURE ME
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              {isEnglish ? "Your observed evolution" : "Tavo stebimi pokyčiai"}
            </h2>
            <p className="mt-2 max-w-2xl text-xs leading-relaxed text-muted-foreground">
              {isEnglish
                ? "Stored observations show how your state has changed."
                : "Išsaugoti stebėjimai rodo, kaip keitėsi tavo būsena."}
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
                aria-pressed={range === days}
                onClick={() => setRange(days)}
                className={`min-h-9 rounded-lg border px-3 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                  range === days
                    ? "border-violet-400/55 bg-violet-500/20 text-violet-100"
                    : "border-border bg-surface-2/50 text-muted-foreground hover:text-foreground"
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
          <div className="mt-4 grid grid-cols-2 gap-2 xl:grid-cols-4">
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
                      <p className="font-mono text-2xl font-semibold text-foreground">
                        {Math.round(series.latestValue * 10) / 10}
                        {metric.unit ? (
                          <span className="ml-1 text-sm text-muted-foreground">{metric.unit}</span>
                        ) : null}
                      </p>
                      <ObservedLine
                        series={series}
                        label={`${isEnglish ? metric.labelEn : metric.labelLt} · ${isEnglish ? "stored observations" : "išsaugoti stebėjimai"}`}
                      />
                      <p className="mt-2 text-[10px] text-muted-foreground">
                        {series.availability === "available" && series.netChange != null
                          ? `${series.netChange >= 0 ? "+" : ""}${Math.round(series.netChange * 10) / 10}${metric.unit ? ` ${metric.unit}` : ""} ${isEnglish ? "across this observed window" : "šiame stebėtame lange"}`
                          : isEnglish
                            ? "Not enough temporal coverage for a direction."
                            : "Krypčiai dar nepakanka laiko aprėpties."}
                      </p>
                    </>
                  ) : query.data === undefined ? (
                    // Nothing has been read yet. "No compatible observations
                    // in this window" is a claim about the athlete's stored
                    // snapshots, and it was on screen before a single one had
                    // come back.
                    <FutureLabEmpty>
                      {isEnglish
                        ? "Reading your stored snapshots…"
                        : "Skaitomi tavo išsaugoti snapshot'ai…"}
                    </FutureLabEmpty>
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
            eyebrow={isEnglish ? "BODY PROJECTIONS" : "KŪNO PROJEKCIJOS"}
            title={isEnglish ? "Body composition is not projected" : "Kūno sudėtis neprognozuojama"}
            action={<Sparkles className="size-4 text-violet-300" />}
          >
            <p className="text-xs leading-relaxed text-muted-foreground">
              {isEnglish
                ? "The strength model above projects estimated 1RM at 4 and 12 weeks. There is no model for future muscle mass, body fat or body shape."
                : "Aukščiau esantis jėgos modelis projektuoja apskaičiuotą 1RM po 4 ir 12 savaičių. Būsimos raumenų masės, riebalų ar kūno formos modelio nėra."}
            </p>
          </FutureLabPanel>
          <FutureLabPanel
            eyebrow={isEnglish ? "MODEL PRINCIPLE" : "MODELIO PRINCIPAS"}
            title={isEnglish ? "Known ≠ inferred ≠ predicted" : "Known ≠ inferred ≠ predicted"}
            action={<BrainCircuit className="size-4 text-emerald-300" />}
          >
            <p className="text-xs leading-relaxed text-muted-foreground">
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
