import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Clock3, Dumbbell, Loader2, PersonStanding } from "lucide-react";
import { BodyMap, toneForRecoveryBand } from "@/components/twin/BodyMap";
import {
  isAnatomicalRegion,
  openingView,
  viewShowing,
  type BodyView,
} from "@/components/twin/body-map.geometry";
import { baseLang, useI18n, type TKey } from "@/lib/i18n";
import { browserTimeZone } from "@/lib/local-day";
import { getTwinSnapshot } from "@/lib/digital-twin.functions";
import { KNOWN_MUSCLE_GROUPS } from "@/lib/muscle-load.schema";
import type { TwinRegionRecoveryBand, TwinRegionState } from "@/lib/digital-twin.schema";

const KNOWN_MUSCLE_GROUP_SET = new Set<string>(KNOWN_MUSCLE_GROUPS);

const BAND_TONE: Record<TwinRegionRecoveryBand, string> = {
  fresh: "text-cyan-300 border-cyan-400/25 bg-cyan-400/[0.07]",
  moderate: "text-amber-300 border-amber-400/25 bg-amber-400/[0.07]",
  fatigued: "text-rose-300 border-rose-400/25 bg-rose-400/[0.07]",
  unknown: "text-slate-500 border-white/[0.07] bg-white/[0.025]",
};

const BAND_DOT: Record<TwinRegionRecoveryBand, string> = {
  fresh: "bg-cyan-300",
  moderate: "bg-amber-300",
  fatigued: "bg-rose-400",
  unknown: "bg-slate-600",
};

function regionLabel(region: string, t: (key: TKey) => string): string {
  if (KNOWN_MUSCLE_GROUP_SET.has(region)) return t(`mg.${region}` as TKey);
  return region.charAt(0).toUpperCase() + region.slice(1).replaceAll("_", " ");
}

function recoveryOrder(region: TwinRegionState): number {
  return region.recoveryPct ?? 101;
}

export function FutureLabBodyMap() {
  const { lang, t } = useI18n();
  const isEnglish = baseLang(lang) === "en";
  const timeZone = browserTimeZone();
  const [view, setView] = useState<BodyView>("front");
  const [selected, setSelected] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ["future-lab-body-map", timeZone],
    queryFn: () => getTwinSnapshot({ data: timeZone }),
    staleTime: 60_000,
  });

  const regions = useMemo(
    () =>
      (query.data?.regions ?? [])
        .filter((region) => isAnatomicalRegion(region.region))
        .sort((left, right) => recoveryOrder(left) - recoveryOrder(right)),
    [query.data],
  );

  useEffect(() => {
    if (selected || regions.length === 0) return;
    const initial = regions.find((region) => region.provenance === "calculated") ?? regions[0];
    if (!initial) return;
    setSelected(initial.region);
    setView(openingView([initial.region]));
  }, [regions, selected]);

  const selectedRegion = regions.find((region) => region.region === selected) ?? null;
  const selectRegion = (region: string) => {
    setSelected(region);
    if (isAnatomicalRegion(region)) setView((current) => viewShowing(region, current));
  };

  const knownCount = regions.filter((region) => region.provenance === "calculated").length;

  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-[#182846] bg-[#040913] p-4 shadow-[0_35px_100px_rgba(0,0,0,.32)] sm:p-6 lg:p-7">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_48%_28%,rgba(59,130,246,.14),transparent_34%),radial-gradient(circle_at_80%_10%,rgba(124,58,237,.12),transparent_28%)]"
      />
      <div className="relative">
        <header className="flex flex-col gap-4 border-b border-[#17243b] pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link
              to="/app"
              className="inline-flex min-h-9 items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 transition-colors hover:text-violet-200"
            >
              <ArrowLeft className="size-3.5" /> {isEnglish ? "Back to Today" : "Grįžti į Today"}
            </Link>
            <p className="mt-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.24em] text-violet-300">
              <PersonStanding className="size-4" /> BODY MAP
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-5xl">
              {isEnglish ? "Inspect one body region" : "Peržiūrėk vieną kūno regioną"}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-400">
              {isEnglish
                ? "This screen reads the same Digital Twin snapshot you already use. Unknown regions remain unknown; no score is filled in for presentation."
                : "Šis ekranas skaito tą patį jau naudojamą Digital Twin snapshot'ą. Nežinomi regionai lieka nežinomi — vien dėl vaizdo jokie balai nesukuriami."}
            </p>
          </div>
          {query.data ? (
            <div className="rounded-2xl border border-[#1a2941] bg-[#07111d]/85 px-4 py-3 text-right">
              <p className="text-[9px] uppercase tracking-[0.16em] text-slate-600">
                {isEnglish ? "Evidence coverage" : "Įrodymų aprėptis"}
              </p>
              <p className="mt-1 font-mono text-sm text-white">
                {knownCount}/{regions.length} · {query.data.evidenceWindowDays}D
              </p>
            </div>
          ) : null}
        </header>

        {query.isLoading ? (
          <div className="grid min-h-[560px] place-items-center text-sm text-slate-500">
            <span className="flex items-center gap-2">
              <Loader2 className="size-4 animate-spin text-violet-300" />
              {isEnglish ? "Loading Body Map…" : "Kraunamas Body Map…"}
            </span>
          </div>
        ) : query.isError || !query.data ? (
          <div className="grid min-h-[420px] place-items-center text-sm text-slate-500">
            {isEnglish
              ? "Body Map is temporarily unavailable."
              : "Body Map laikinai nepasiekiamas."}
          </div>
        ) : (
          <div className="mt-5 grid gap-4 xl:grid-cols-[250px_minmax(360px,1fr)_320px]">
            <aside className="order-2 rounded-[1.5rem] border border-[#182846] bg-[#07111d]/72 p-3 xl:order-1">
              <p className="px-2 pb-2 text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500">
                {isEnglish ? "Regions" : "Regionai"}
              </p>
              <div className="grid max-h-[600px] gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-1">
                {regions.map((region) => (
                  <button
                    key={region.region}
                    type="button"
                    onClick={() => selectRegion(region.region)}
                    className={`flex min-h-12 items-center justify-between gap-3 rounded-xl border px-3 text-left transition-colors ${
                      selected === region.region
                        ? "border-violet-400/35 bg-violet-500/[0.10] text-white"
                        : "border-transparent bg-white/[0.02] text-slate-400 hover:border-[#243653] hover:text-slate-200"
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className={`size-2 shrink-0 rounded-full ${BAND_DOT[region.recoveryBand]}`}
                      />
                      <span className="truncate text-xs font-semibold">
                        {regionLabel(region.region, t)}
                      </span>
                    </span>
                    <span className="shrink-0 font-mono text-[10px] text-slate-500">
                      {region.recoveryPct == null ? "—" : `${region.recoveryPct}%`}
                    </span>
                  </button>
                ))}
              </div>
            </aside>

            <div className="order-1 min-h-[540px] rounded-[1.5rem] border border-[#182846] bg-black/25 p-3 xl:order-2">
              <div className="mb-2 flex justify-center">
                <div className="inline-flex rounded-xl border border-[#1a2941] bg-[#06101c] p-1">
                  {(["front", "back"] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      aria-pressed={view === option}
                      onClick={() => setView(option)}
                      className={`min-h-9 rounded-lg px-4 text-[9px] font-bold uppercase tracking-wider transition-colors ${
                        view === option
                          ? "bg-violet-500/20 text-violet-100"
                          : "text-slate-500 hover:text-slate-200"
                      }`}
                    >
                      {option === "front"
                        ? isEnglish
                          ? "Front"
                          : "Priekis"
                        : isEnglish
                          ? "Back"
                          : "Nugara"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mx-auto h-[500px] w-full max-w-[470px]">
                <BodyMap
                  regions={regions.map((region) => ({
                    region: region.region,
                    tone: toneForRecoveryBand(region.recoveryBand),
                    value: region.recoveryPct == null ? null : `${region.recoveryPct}%`,
                  }))}
                  view={view}
                  selectedRegion={selected}
                  onSelectRegion={selectRegion}
                  regionLabel={(region) => regionLabel(region, t)}
                />
              </div>
            </div>

            <aside className="order-3 rounded-[1.5rem] border border-[#182846] bg-[#07111d]/72 p-4 sm:p-5">
              {selectedRegion ? (
                <>
                  <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500">
                    {isEnglish ? "Selected region" : "Pasirinktas regionas"}
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">
                    {regionLabel(selectedRegion.region, t)}
                  </h2>
                  <span
                    className={`mt-3 inline-flex rounded-full border px-3 py-1 text-[9px] font-bold uppercase tracking-wider ${BAND_TONE[selectedRegion.recoveryBand]}`}
                  >
                    {selectedRegion.recoveryBand}
                  </span>

                  <div className="mt-5 grid gap-3">
                    <div className="rounded-2xl border border-[#1a2941] bg-[#08111e] p-4">
                      <p className="text-[9px] uppercase tracking-[0.15em] text-slate-600">
                        {isEnglish ? "Recovery estimate" : "Atsistatymo įvertis"}
                      </p>
                      <p className="mt-2 text-4xl font-semibold text-white">
                        {selectedRegion.recoveryPct == null
                          ? "—"
                          : `${selectedRegion.recoveryPct}%`}
                      </p>
                      <p className="mt-2 text-[10px] text-slate-500">
                        {selectedRegion.provenance === "calculated"
                          ? isEnglish
                            ? "Calculated from recorded training"
                            : "Apskaičiuota iš registruotų treniruočių"
                          : isEnglish
                            ? "No compatible evidence"
                            : "Nėra suderinamų įrodymų"}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-2xl border border-[#1a2941] bg-[#08111e] p-3">
                        <Dumbbell className="size-4 text-violet-300" />
                        <p className="mt-3 text-[9px] uppercase tracking-[0.14em] text-slate-600">
                          {isEnglish ? "Recorded load" : "Registruotas krūvis"}
                        </p>
                        <p className="mt-1 font-mono text-sm text-white">
                          {selectedRegion.volumeKg == null
                            ? "—"
                            : `${Math.round(selectedRegion.volumeKg).toLocaleString()} kg`}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-[#1a2941] bg-[#08111e] p-3">
                        <Clock3 className="size-4 text-cyan-300" />
                        <p className="mt-3 text-[9px] uppercase tracking-[0.14em] text-slate-600">
                          {isEnglish ? "Last trained" : "Paskutinė treniruotė"}
                        </p>
                        <p className="mt-1 font-mono text-sm text-white">
                          {selectedRegion.lastTrainedHoursAgo == null
                            ? "—"
                            : selectedRegion.lastTrainedHoursAgo < 48
                              ? `${Math.round(selectedRegion.lastTrainedHoursAgo)} h`
                              : `${Math.round(selectedRegion.lastTrainedHoursAgo / 24)} d`}
                        </p>
                      </div>
                    </div>
                  </div>

                  <Link
                    to="/twin"
                    className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-violet-400/30 bg-violet-500/12 px-4 text-[10px] font-bold uppercase tracking-wider text-violet-100 transition-colors hover:bg-violet-500/20"
                  >
                    {isEnglish ? "Open full My Twin" : "Atidaryti pilną My Twin"}
                  </Link>
                </>
              ) : (
                <p className="text-sm text-slate-500">
                  {isEnglish
                    ? "Select a region to inspect it."
                    : "Pasirink regioną detaliai peržiūrai."}
                </p>
              )}
            </aside>
          </div>
        )}
      </div>
    </section>
  );
}
