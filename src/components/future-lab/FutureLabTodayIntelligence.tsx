import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, BrainCircuit, FlaskConical, Radar, Sparkles } from "lucide-react";
import { FutureLabEmpty, FutureLabPanel } from "./FutureLabPanel";
import { baseLang, useI18n } from "@/lib/i18n";
import { browserTimeZone } from "@/lib/local-day";
import { getLabOverview } from "@/lib/lab.functions";
import { getTwinTrendHistory } from "@/lib/twin-trend.functions";
import { buildTwinMetricTrend } from "@/lib/twin-trend";

const statementCopy = {
  lt: {
    "athlete.hypothesis.trainingResponse.repeatedLowFeeling":
      "Paskutinės treniruotės pakartotinai jautėsi sunkios.",
    "athlete.hypothesis.trainingBehavior.usualDayFit":
      "Stebima, kaip treniruotės atitinka tavo įprastas treniruočių dienas.",
  },
  en: {
    "athlete.hypothesis.trainingResponse.repeatedLowFeeling":
      "Recent sessions have repeatedly felt difficult.",
    "athlete.hypothesis.trainingBehavior.usualDayFit":
      "Tracking how completed sessions fit your usual training days.",
  },
} as const;

function Statement({ statementKey, fallback }: { statementKey: string; fallback: string }) {
  const { lang } = useI18n();
  const copy = statementCopy[baseLang(lang)];
  return <>{copy[statementKey as keyof typeof copy] ?? fallback}</>;
}

export function FutureLabTodayIntelligence() {
  const { lang, t } = useI18n();
  const isEnglish = baseLang(lang) === "en";
  const timeZone = browserTimeZone();
  const labQuery = useQuery({
    queryKey: ["future-lab-overview", timeZone],
    queryFn: () => getLabOverview({ data: timeZone }),
    staleTime: 60_000,
  });
  const trendQuery = useQuery({
    queryKey: ["future-lab-trend"],
    queryFn: () => getTwinTrendHistory(),
    staleTime: 60_000,
  });

  const lab = labQuery.data;
  const monitoring = lab?.hypotheses.find(
    (hypothesis) =>
      hypothesis.status === "monitoring" || hypothesis.status === "insufficient_evidence",
  );
  const discovery = lab?.hypotheses.find((hypothesis) => hypothesis.status === "supported");
  const calibration = lab?.predictionCalibration;
  const readinessTrend = trendQuery.data
    ? buildTwinMetricTrend(trendQuery.data, "readiness")
    : null;
  const volumeTrend = trendQuery.data
    ? buildTwinMetricTrend(trendQuery.data, "totalVolumeLast28Days")
    : null;
  const notEnough = isEnglish
    ? "Not enough verified data yet."
    : "Dar nepakanka patikrintų duomenų.";

  return (
    <div>
      <div className="mb-3 flex flex-col gap-2 rounded-2xl border border-[#182846] bg-[#07111d]/70 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">
          {t("dash.welcomeBack")} · FUTURE LAB
        </p>
        <div className="flex flex-wrap gap-1.5">
          <Link
            to="/twin"
            className="inline-flex min-h-8 items-center rounded-lg border border-violet-400/20 bg-violet-500/[0.07] px-2.5 text-[9px] font-bold uppercase tracking-wider text-violet-200 transition-colors hover:border-violet-400/40 hover:bg-violet-500/[0.12]"
          >
            {t("nav.twin")}
          </Link>
          <Link
            to="/progress"
            className="inline-flex min-h-8 items-center rounded-lg border border-cyan-400/15 bg-cyan-500/[0.05] px-2.5 text-[9px] font-bold uppercase tracking-wider text-cyan-200 transition-colors hover:border-cyan-400/35 hover:bg-cyan-500/[0.1]"
          >
            {t("pr.title")}
          </Link>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <FutureLabPanel
          eyebrow={isEnglish ? "RECENT WORKOUT EFFECT" : "NAUJAUSIAS TRENIRUOTĖS EFEKTAS"}
          title={isEnglish ? "Observed training load" : "Užfiksuotas treniruočių krūvis"}
          action={<Radar className="size-4 text-cyan-300" />}
        >
          {volumeTrend?.latestValue != null ? (
            <div>
              <p className="text-2xl font-semibold text-white">
                {Math.round(volumeTrend.latestValue).toLocaleString()} kg
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {isEnglish ? "28-day recorded volume" : "Užregistruotas 28 d. tūris"}
              </p>
              <p className="mt-3 text-[11px] text-slate-500">
                {volumeTrend.availability === "available" && volumeTrend.netChange != null
                  ? `${volumeTrend.netChange >= 0 ? "+" : ""}${Math.round(volumeTrend.netChange)} kg ${isEnglish ? "across the observed window" : "stebėtame lange"}`
                  : notEnough}
              </p>
            </div>
          ) : (
            <FutureLabEmpty>{notEnough}</FutureLabEmpty>
          )}
          <Link
            to="/progress"
            className="mt-4 inline-flex items-center gap-1 text-[11px] font-bold text-violet-300 hover:text-violet-200"
          >
            {isEnglish ? "VIEW EVOLUTION" : "ŽIŪRĖTI EVOLIUCIJĄ"}{" "}
            <ArrowUpRight className="size-3" />
          </Link>
        </FutureLabPanel>

        <FutureLabPanel
          eyebrow="FUTURE ME"
          title={isEnglish ? "Current trajectory" : "Dabartinė trajektorija"}
          action={<Sparkles className="size-4 text-violet-300" />}
        >
          {readinessTrend?.latestValue != null ? (
            <div>
              <p className="text-2xl font-semibold text-white">
                {Math.round(readinessTrend.latestValue)}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {isEnglish ? "Latest stored readiness" : "Naujausias išsaugotas readiness"}
              </p>
              <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
                {readinessTrend.availability === "available" && readinessTrend.direction
                  ? isEnglish
                    ? `Observed direction: ${readinessTrend.direction}. This is not a forecast.`
                    : `Stebėta kryptis: ${readinessTrend.direction}. Tai nėra prognozė.`
                  : notEnough}
              </p>
            </div>
          ) : (
            <FutureLabEmpty>{notEnough}</FutureLabEmpty>
          )}
          <Link
            to="/progress"
            className="mt-4 inline-flex items-center gap-1 text-[11px] font-bold text-violet-300 hover:text-violet-200"
          >
            {isEnglish ? "OPEN FUTURE ME" : "ATIDARYTI FUTURE ME"}{" "}
            <ArrowUpRight className="size-3" />
          </Link>
        </FutureLabPanel>

        <FutureLabPanel
          eyebrow={isEnglish ? "TODAY'S HYPOTHESIS" : "ŠIANDIENOS HIPOTEZĖ"}
          title={isEnglish ? "Testing, not assuming" : "Tikrinama, o ne spėjama"}
          action={<FlaskConical className="size-4 text-amber-300" />}
        >
          {labQuery.isError ? (
            <FutureLabEmpty>
              {isEnglish
                ? "Lab data is temporarily unavailable."
                : "Laboratorijos duomenys laikinai nepasiekiami."}
            </FutureLabEmpty>
          ) : monitoring ? (
            <div>
              <p className="text-sm leading-relaxed text-slate-200">
                <Statement
                  statementKey={monitoring.statementKey}
                  fallback={
                    isEnglish ? "A new pattern is being monitored." : "Stebimas naujas dėsningumas."
                  }
                />
              </p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round(
                        (monitoring.evidenceCount / monitoring.minimumEvidenceCount) * 100,
                      ),
                    )}%`,
                  }}
                />
              </div>
              <p className="mt-2 text-[11px] text-slate-500">
                {monitoring.evidenceCount}/{monitoring.minimumEvidenceCount}{" "}
                {isEnglish ? "evidence points" : "įrodymų taškų"}
              </p>
            </div>
          ) : (
            <FutureLabEmpty>
              {isEnglish
                ? "No active hypothesis needs testing right now."
                : "Šiuo metu nėra aktyvios hipotezės, kurią reikėtų tikrinti."}
            </FutureLabEmpty>
          )}
          <Link
            to="/lab"
            className="mt-4 inline-flex items-center gap-1 text-[11px] font-bold text-violet-300 hover:text-violet-200"
          >
            {isEnglish ? "VIEW LAB" : "ATIDARYTI LAB"} <ArrowUpRight className="size-3" />
          </Link>
        </FutureLabPanel>

        <FutureLabPanel
          eyebrow={isEnglish ? "LATEST DISCOVERY" : "NAUJAUSIAS ATRADIMAS"}
          title={
            discovery
              ? isEnglish
                ? "Supported by your data"
                : "Patvirtinta tavo duomenimis"
              : isEnglish
                ? "Learning in progress"
                : "Mokymasis vyksta"
          }
          action={<BrainCircuit className="size-4 text-emerald-300" />}
        >
          {discovery ? (
            <div>
              <p className="text-sm leading-relaxed text-slate-200">
                <Statement
                  statementKey={discovery.statementKey}
                  fallback={
                    isEnglish
                      ? "A personal pattern has reached the evidence threshold."
                      : "Asmeninis dėsningumas pasiekė reikiamą įrodymų ribą."
                  }
                />
              </p>
              <p className="mt-3 text-[11px] text-emerald-300">
                {discovery.evidenceCount}{" "}
                {isEnglish ? "evidence points · deterministic" : "įrodymų taškai · deterministinis"}
              </p>
            </div>
          ) : (
            <FutureLabEmpty>{notEnough}</FutureLabEmpty>
          )}
          {calibration ? (
            <p className="mt-3 border-t border-white/[0.05] pt-3 text-[10px] text-slate-500">
              {isEnglish ? "Prediction shadow ledger" : "Prognozių shadow registras"}:{" "}
              {calibration.totalEvaluated}/{calibration.minimumEvaluated}{" "}
              {isEnglish ? "evaluated" : "įvertinta"}
            </p>
          ) : null}
          <Link
            to="/history"
            className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-violet-300 hover:text-violet-200"
          >
            {isEnglish ? "OPEN JOURNAL" : "ATIDARYTI JOURNAL"}
            <ArrowUpRight className="size-3" />
          </Link>
        </FutureLabPanel>
      </div>
    </div>
  );
}
