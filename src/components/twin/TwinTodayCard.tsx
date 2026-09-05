import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Loader2, PersonStanding } from "lucide-react";
import { BodyMap, toneForRecoveryBand } from "@/components/twin/BodyMap";
import {
  isAnatomicalRegion,
  openingView,
  viewShowing,
  type BodyView,
} from "@/components/twin/body-map.geometry";
import { baseLang, useI18n, type Lang, type TKey } from "@/lib/i18n";
import { browserTimeZone } from "@/lib/local-day";
import { getTwinSnapshot } from "@/lib/digital-twin.functions";
import { KNOWN_MUSCLE_GROUPS } from "@/lib/muscle-load.schema";
import type {
  TwinRegionRecoveryBand,
  TwinRegionState,
  TwinSnapshot,
} from "@/lib/digital-twin.schema";

const KNOWN_MUSCLE_GROUP_SET = new Set<string>(KNOWN_MUSCLE_GROUPS);

type Copy = {
  eyebrow: string;
  title: string;
  subtitle: string;
  loading: string;
  unavailable: string;
  empty: string;
  emptyHint: string;
  attention: string;
  coverage: (withEvidence: number, total: number) => string;
  window: (days: number) => string;
  viewLabel: Record<BodyView, string>;
  bandLabel: Record<TwinRegionRecoveryBand, string>;
  open: string;
};

function copyFor(lang: Lang): Copy {
  if (baseLang(lang) === "en") {
    return {
      eyebrow: "LIVE DIGITAL TWIN",
      title: "Your body, as GYMS.LIFE understands it today",
      subtitle: "Calculated from your logged training. Unknown regions stay unknown.",
      loading: "Building today's Twin…",
      unavailable: "Your Twin is temporarily unavailable.",
      empty: "Your Twin is still learning",
      emptyHint:
        "Complete set logs with weight and reps can inform this estimate. Unsupported or incomplete groups remain unknown.",
      attention: "Lowest recovery",
      coverage: (withEvidence, total) => `${withEvidence}/${total} regions evidenced`,
      window: (days) => `${days}-day evidence window`,
      viewLabel: { front: "Front", back: "Back" },
      bandLabel: { fresh: "Fresh", moderate: "Moderate", fatigued: "Fatigued", unknown: "Unknown" },
      open: "Enter Twin",
    };
  }

  return {
    eyebrow: "GYVAS SKAITMENINIS DVYNYS",
    title: "Tavo kūnas toks, kokį GYMS.LIFE jį supranta šiandien",
    subtitle: "Apskaičiuota iš tavo treniruočių. Nežinomi regionai lieka nežinomi.",
    loading: "Kuriamas šiandienos dvynys…",
    unavailable: "Tavo dvynys šiuo metu nepasiekiamas.",
    empty: "Tavo dvynys dar mokosi",
    emptyHint:
      "Įverčiui reikia užbaigtų setų su svoriu ir pakartojimais. Nepalaikomos ar neišsamios grupės lieka nežinomos.",
    attention: "Mažiausias atsistatymas",
    coverage: (withEvidence, total) => `${withEvidence}/${total} regionų su įrodymais`,
    window: (days) => `${days} d. įrodymų langas`,
    viewLabel: { front: "Priekis", back: "Nugara" },
    bandLabel: {
      fresh: "Atsistatę",
      moderate: "Vidutiniškai",
      fatigued: "Nuvargę",
      unknown: "Nežinoma",
    },
    open: "Atidaryti dvynį",
  };
}

const BAND_DOT: Record<TwinRegionRecoveryBand, string> = {
  fresh: "bg-emerald-400",
  moderate: "bg-amber-400",
  fatigued: "bg-rose-500",
  unknown: "bg-muted-foreground/40",
};

function regionLabelFor(region: string, t: (key: TKey) => string): string {
  if (KNOWN_MUSCLE_GROUP_SET.has(region)) return t(`mg.${region}` as TKey);
  return region.charAt(0).toUpperCase() + region.slice(1).replaceAll("_", " ");
}

function leastRecovered(regions: TwinRegionState[]): TwinRegionState[] {
  return regions
    .filter((region) => region.provenance === "calculated" && region.recoveryPct !== null)
    .sort((left, right) => (left.recoveryPct ?? 100) - (right.recoveryPct ?? 100));
}

/**
 * Today treats the Twin as the visual stage, not as another dashboard card.
 * The renderer is still the honest segmented BodyMap: the interface is ready
 * for a future 3D renderer because all visual state comes from TwinSnapshot.
 */
export function TwinTodayView({
  data,
  copy,
  label,
  status = "ready",
}: {
  data: TwinSnapshot | null;
  copy: Copy;
  label: (region: string) => string;
  status?: "loading" | "error" | "ready";
}) {
  const [view, setView] = useState<BodyView>("front");
  const [selected, setSelected] = useState<string | null>(null);
  const aligned = useRef(false);

  const ranked = data ? leastRecovered(data.regions) : [];
  const focus = selected
    ? (data?.regions.find((region) => region.region === selected) ?? ranked[0] ?? null)
    : (ranked[0] ?? null);

  useEffect(() => {
    if (aligned.current || !data) return;
    aligned.current = true;
    const initial = leastRecovered(data.regions)[0];
    if (!initial) return;
    setSelected(initial.region);
    setView(openingView([initial.region]));
  }, [data]);

  const selectRegion = (region: string) => {
    setSelected(region);
    if (isAnatomicalRegion(region)) setView((current) => viewShowing(region, current));
  };

  const evidenceCount =
    data?.regions.filter((region) => region.provenance === "calculated").length ?? 0;

  return (
    <section className="relative min-h-[620px] overflow-hidden rounded-[2rem] border border-white/[0.07] bg-[#050607] sm:min-h-[680px] lg:min-h-[720px]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-80"
        style={{
          background:
            "radial-gradient(55% 60% at 50% 42%, color-mix(in srgb, var(--primary) 13%, transparent), transparent 72%), radial-gradient(55% 50% at 50% 100%, rgba(255,255,255,.035), transparent 72%)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-[18%] top-[15%] h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"
      />

      <div className="relative z-10 flex min-h-[620px] flex-col sm:min-h-[680px] lg:min-h-[720px]">
        <header className="flex items-start justify-between gap-3 px-5 pt-5 sm:px-7 sm:pt-7">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.26em] text-primary">
              <PersonStanding className="size-3.5" /> {copy.eyebrow}
            </p>
            <h2 className="mt-2 max-w-xl text-xl leading-tight text-foreground sm:text-2xl lg:text-3xl">
              {copy.title}
            </h2>
            <p className="mt-1.5 max-w-xl text-xs leading-relaxed text-muted-foreground sm:text-sm">
              {copy.subtitle}
            </p>
          </div>
          <Link
            to="/twin"
            aria-label={copy.open}
            className="group grid size-11 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.035] text-primary backdrop-blur-xl transition-colors hover:border-primary/40 hover:bg-primary/[0.06]"
          >
            <ArrowUpRight className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transition-none" />
          </Link>
        </header>

        {status === "loading" ? (
          <div className="grid flex-1 place-items-center px-6 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <Loader2 className="size-4 animate-spin text-primary" /> {copy.loading}
            </span>
          </div>
        ) : status === "error" || !data ? (
          <div className="grid flex-1 place-items-center px-6 text-sm text-muted-foreground">
            {copy.unavailable}
          </div>
        ) : (
          <div className="relative flex flex-1 flex-col px-4 pb-5 sm:px-7 sm:pb-7">
            <div className="absolute left-1/2 top-3 z-20 flex -translate-x-1/2 rounded-full border border-white/[0.08] bg-black/45 p-1 backdrop-blur-xl">
              {(["front", "back"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={view === option}
                  onClick={() => setView(option)}
                  className={`min-h-8 rounded-full px-3 text-[9px] font-bold uppercase tracking-[0.15em] transition-colors motion-reduce:transition-none ${
                    view === option
                      ? "bg-white/10 text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {copy.viewLabel[option]}
                </button>
              ))}
            </div>

            <div className="relative mx-auto mt-4 h-[400px] w-full max-w-[330px] flex-1 sm:h-[470px] sm:max-w-[390px] lg:max-w-[430px]">
              <BodyMap
                regions={data.regions
                  .filter((region) => isAnatomicalRegion(region.region))
                  .map((region) => ({
                    region: region.region,
                    tone: toneForRecoveryBand(region.recoveryBand),
                    value: region.recoveryPct === null ? null : `${region.recoveryPct}%`,
                  }))}
                view={view}
                selectedRegion={selected}
                onSelectRegion={selectRegion}
                regionLabel={label}
              />
            </div>

            <div className="pointer-events-none absolute left-4 top-16 hidden max-w-40 rounded-2xl border border-white/[0.08] bg-black/35 p-3 backdrop-blur-xl sm:block lg:left-7">
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                {copy.window(data.evidenceWindowDays)}
              </p>
              <p className="mt-1 font-mono text-sm text-foreground">
                {copy.coverage(evidenceCount, data.regions.length)}
              </p>
            </div>

            {focus ? (
              <div className="absolute right-4 top-24 hidden w-44 rounded-2xl border border-white/[0.08] bg-black/40 p-3 backdrop-blur-xl sm:block lg:right-7">
                <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  {copy.attention}
                </p>
                <button
                  type="button"
                  onClick={() => selectRegion(focus.region)}
                  className="mt-2 block w-full text-left"
                >
                  <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <span className={`size-2 rounded-full ${BAND_DOT[focus.recoveryBand]}`} />
                    {label(focus.region)}
                  </span>
                  <span className="mt-1 block font-mono text-xs text-muted-foreground">
                    {focus.recoveryPct}% · {copy.bandLabel[focus.recoveryBand]}
                  </span>
                </button>
              </div>
            ) : null}

            <div className="mt-auto rounded-2xl border border-white/[0.08] bg-black/35 p-3 backdrop-blur-xl sm:hidden">
              {focus ? (
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                      {copy.attention}
                    </p>
                    <p className="mt-1 flex items-center gap-2 truncate text-sm font-semibold text-foreground">
                      <span
                        className={`size-2 shrink-0 rounded-full ${BAND_DOT[focus.recoveryBand]}`}
                      />
                      {label(focus.region)}
                    </p>
                  </div>
                  <p className="shrink-0 font-mono text-sm text-foreground">{focus.recoveryPct}%</p>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-semibold text-foreground">{copy.empty}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{copy.emptyHint}</p>
                </div>
              )}
              <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/[0.07] pt-2 text-[10px] text-muted-foreground">
                <span>{copy.window(data.evidenceWindowDays)}</span>
                <span>{copy.coverage(evidenceCount, data.regions.length)}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export function TwinTodayCard() {
  const { lang, t } = useI18n();
  const timeZone = browserTimeZone();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["twin-snapshot", timeZone],
    queryFn: () => getTwinSnapshot({ data: timeZone }),
    staleTime: 60_000,
  });

  return (
    <TwinTodayView
      data={data ?? null}
      copy={copyFor(lang)}
      label={(region) => regionLabelFor(region, t)}
      status={isLoading ? "loading" : isError || !data ? "error" : "ready"}
    />
  );
}

export { copyFor as twinTodayCopyFor };
