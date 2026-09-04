import { useQuery } from "@tanstack/react-query";
import { Loader2, PersonStanding } from "lucide-react";
import { GlowCard } from "@/components/GlowCard";
import { useI18n, type TKey } from "@/lib/i18n";
import { browserTimeZone } from "@/lib/local-day";
import { getTwinSnapshot } from "@/lib/digital-twin.functions";
import { KNOWN_MUSCLE_GROUPS } from "@/lib/muscle-load.schema";
import type { TwinRegionRecoveryBand, TwinRegionState } from "@/lib/digital-twin.schema";

const KNOWN_MUSCLE_GROUP_SET = new Set<string>(KNOWN_MUSCLE_GROUPS);

function regionLabel(region: string, t: (key: TKey) => string): string {
  if (KNOWN_MUSCLE_GROUP_SET.has(region)) return t(`mg.${region}` as TKey);
  return region.charAt(0).toUpperCase() + region.slice(1).replaceAll("_", " ");
}

type Copy = {
  eyebrow: string;
  title: string;
  description: string;
  loading: string;
  unavailable: string;
  dataGapBanner: string;
  evidenceWindow: (days: number) => string;
  bandLabel: Record<TwinRegionRecoveryBand, string>;
  volume: string;
  lastTrained: (hours: number) => string;
  noEvidence: string;
};

function copyFor(lang: string): Copy {
  if (lang === "en") {
    return {
      eyebrow: "TWIN",
      title: "Your Digital Twin",
      description:
        "Calculated recovery per body region, from your logged training — never a diagnosis or a prediction.",
      loading: "Loading your Twin…",
      unavailable: "Your Twin is temporarily unavailable.",
      dataGapBanner:
        "Training-load data could not be loaded right now. Showing what we already know.",
      evidenceWindow: (days) => `Based on the last ${days} days of logged sets.`,
      bandLabel: { fresh: "Fresh", moderate: "Moderate", fatigued: "Fatigued", unknown: "No data" },
      volume: "Recent volume",
      lastTrained: (hours) => (hours < 1 ? "Trained under an hour ago" : `Trained ${hours}h ago`),
      noEvidence: "No sets logged for this region recently.",
    };
  }

  return {
    eyebrow: "DVYNYS",
    title: "Tavo skaitmeninis dvynys",
    description:
      "Apskaičiuotas atsistatymas kiekvienam kūno regionui pagal tavo registruotas treniruotes — ne diagnozė ir ne prognozė.",
    loading: "Kraunamas tavo dvynys…",
    unavailable: "Tavo dvynys šiuo metu nepasiekiamas.",
    dataGapBanner: "Nepavyko įkelti krūvio duomenų. Rodome tai, ką jau žinome.",
    evidenceWindow: (days) => `Remiantis pastarųjų ${days} dienų registruotais setais.`,
    bandLabel: {
      fresh: "Švieži",
      moderate: "Vidutiniškai",
      fatigued: "Nuvargę",
      unknown: "Nėra duomenų",
    },
    volume: "Naujausias tūris",
    lastTrained: (hours) =>
      hours < 1 ? "Treniruota mažiau nei prieš valandą" : `Treniruota prieš ${hours} val.`,
    noEvidence: "Šiam regionui pastaruoju metu setų neregistruota.",
  };
}

function bandTone(band: TwinRegionRecoveryBand): string {
  if (band === "fresh") return "border-emerald-400/40 bg-emerald-400/10 text-emerald-400";
  if (band === "moderate") return "border-amber-400/40 bg-amber-400/10 text-amber-400";
  if (band === "fatigued") return "border-rose-500/40 bg-rose-500/10 text-rose-400";
  return "border-border bg-surface-2 text-muted-foreground";
}

function RegionCard({
  region,
  copy,
  t,
}: {
  region: TwinRegionState;
  copy: Copy;
  t: (key: TKey) => string;
}) {
  return (
    <article className={`rounded-2xl border p-4 ${bandTone(region.recoveryBand)}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-foreground">
          {regionLabel(region.region, t)}
        </span>
        <span className="text-[10px] font-bold uppercase tracking-wider">
          {copy.bandLabel[region.recoveryBand]}
        </span>
      </div>
      {region.provenance === "calculated" ? (
        <>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-2/60">
            <div
              className="h-full rounded-full bg-current transition-all duration-500"
              style={{ width: `${region.recoveryPct}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {region.recoveryPct}% · {copy.volume}: {region.volumeKg} kg
          </p>
          {region.lastTrainedHoursAgo !== null ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {copy.lastTrained(Math.round(region.lastTrainedHoursAgo))}
            </p>
          ) : null}
        </>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">{copy.noEvidence}</p>
      )}
    </article>
  );
}

export function TwinView() {
  const { lang, t } = useI18n();
  const timeZone = browserTimeZone();
  const copy = copyFor(lang);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["twin-snapshot", timeZone],
    queryFn: () => getTwinSnapshot({ data: timeZone }),
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <section className="panel p-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin text-primary" /> {copy.loading}
        </div>
      </section>
    );
  }

  if (isError || !data) {
    return <p className="text-sm text-muted-foreground">{copy.unavailable}</p>;
  }

  return (
    <div className="space-y-6">
      <GlowCard className="panel relative overflow-hidden p-6 md:p-7">
        <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-primary">
          <PersonStanding className="size-4" /> {copy.eyebrow}
        </p>
        <h1 className="mt-2 text-2xl sm:text-3xl">{copy.title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {copy.description}
        </p>
        <p className="mt-3 text-xs text-muted-foreground">
          {copy.evidenceWindow(data.evidenceWindowDays)}
        </p>
      </GlowCard>

      {!data.dataAvailable ? (
        <p className="rounded-2xl border border-amber-400/40 bg-amber-400/10 p-4 text-sm text-amber-400">
          {copy.dataGapBanner}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data.regions.map((region) => (
          <RegionCard key={region.region} region={region} copy={copy} t={t} />
        ))}
      </div>
    </div>
  );
}
