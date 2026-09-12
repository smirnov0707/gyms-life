import { FlaskConical, Gauge, ShieldCheck } from "lucide-react";
import { baseLang, useI18n } from "@/lib/i18n";
import { calibrationMaturityPercent } from "@/lib/prediction-calibration.engine";
import { LabRosterRows } from "./FutureLabRoster";
import { HypothesisEvidence } from "./HypothesisEvidence";
import { FutureLabEmpty, FutureLabPanel } from "./FutureLabPanel";
import { useLabOverview } from "./lab-overview.query";
import { useStrengthForecast } from "./forecast.query";
import { EpistemicBoundary } from "./EpistemicBoundary";
import { EvidenceAcquisitionPrompt } from "@/components/intelligence/EvidenceAcquisitionPrompt";
import { selectEvidenceAcquisitionRecommendation } from "@/lib/evidence-acquisition";
import { ExperimentLedger } from "./ExperimentLedger";
import "./reference-page-density.css";

const STATEMENTS = {
  lt: {
    "athlete.hypothesis.trainingResponse.repeatedLowFeeling":
      "Ar pasikartojantis sunkumo jausmas rodo susikaupusį treniruočių nuovargį?",
    "athlete.hypothesis.trainingBehavior.usualDayFit":
      "Kaip tavo atliktos treniruotės dera su įprastu treniruočių ritmu?",
  },
  en: {
    "athlete.hypothesis.trainingResponse.repeatedLowFeeling":
      "Does repeated session difficulty indicate accumulating training fatigue?",
    "athlete.hypothesis.trainingBehavior.usualDayFit":
      "How do completed sessions fit your usual training rhythm?",
  },
} as const;

export function LabCommandDeck() {
  const { lang, t } = useI18n();
  const locale = baseLang(lang);
  const english = locale === "en";
  const query = useLabOverview();
  const forecastQuery = useStrengthForecast();
  const data = query.isError ? undefined : query.data;
  const nextEvidence = data
    ? selectEvidenceAcquisitionRecommendation(data.hypotheses, data.dataGaps)
    : null;
  const primary =
    (nextEvidence?.hypothesisId
      ? data?.hypotheses.find((item) => item.id === nextEvidence.hypothesisId)
      : undefined) ??
    data?.hypotheses.find((item) => item.status === "monitoring") ??
    data?.hypotheses[0];
  const calibration = data?.predictionCalibration;
  const maturity = calibrationMaturityPercent(calibration);
  const progress = primary
    ? Math.min(100, Math.round((primary.evidenceCount / primary.minimumEvidenceCount) * 100))
    : null;
  const copy = STATEMENTS[locale];
  const statement = primary
    ? (copy[primary.statementKey as keyof typeof copy] ??
      (english ? "A personal pattern is under investigation." : "Tiriamas asmeninis dėsningumas."))
    : null;
  const unknown = english ? "Investigation data is unavailable." : "Tyrimo duomenys nepasiekiami.";
  const statuses = english
    ? {
        monitoring: "Monitoring",
        insufficient_evidence: "Gathering evidence",
        supported: "Supported",
        contradicted: "Contradicted",
      }
    : {
        monitoring: "Stebima",
        insufficient_evidence: "Renkami įrodymai",
        supported: "Pagrįsta",
        contradicted: "Paneigta",
      };

  return (
    <section className="fl-lab-page fl-panel overflow-hidden rounded-2xl border border-border bg-surface/90 p-4 sm:p-5">
      <header className="fl-page-heading flex items-start justify-between gap-3 border-b border-border/70 pb-3">
        <div>
          <p className="fl-page-eyebrow text-[9px] uppercase tracking-[0.18em] text-violet-300 light:text-violet-700">
            GYMS.LIFE FUTURE LAB
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-foreground">{t("nav.lab")}</h1>
          <p className="fl-page-intro mt-1 text-[11px] text-muted-foreground">
            {english ? "Your evidence. Your investigations." : "Tavo duomenys. Tavo tyrimai."}
          </p>
        </div>
        <span className="rounded-full border border-border px-2.5 py-1.5 text-[9px] text-muted-foreground">
          {query.isError
            ? english
              ? "Unavailable"
              : "Nepasiekiama"
            : data
              ? english
                ? "Evidence loaded"
                : "Duomenys įkelti"
              : t("common.loading")}
        </span>
      </header>

      <div className="mt-3 grid gap-3 lg:grid-cols-[1.35fr_1fr]">
        <FutureLabPanel
          className="fl-investigation-card"
          title={english ? "Current investigation" : "Dabartinis tyrimas"}
          action={<FlaskConical className="size-4 text-cyan-300" />}
        >
          {query.isError ? (
            <FutureLabEmpty>{unknown}</FutureLabEmpty>
          ) : !data ? (
            <FutureLabEmpty>{t("common.loading")}</FutureLabEmpty>
          ) : primary ? (
            <>
              <p className="max-w-xl text-sm leading-relaxed text-foreground">{statement}</p>
              <div className="mt-3 flex items-center justify-between gap-3 text-[10px]">
                <span className="text-muted-foreground">
                  {english ? "Evidence gathered" : "Surinkta įrodymų"}
                </span>
                <span className="text-cyan-300 light:text-cyan-700">
                  {primary.evidenceCount}/{primary.minimumEvidenceCount}
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-foreground/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mt-2 text-[10px] text-muted-foreground">{statuses[primary.status]}</p>
              <HypothesisEvidence evidence={primary.evidence} />
              {nextEvidence?.hypothesisId === primary.id ? (
                <EvidenceAcquisitionPrompt
                  recommendation={nextEvidence}
                  english={english}
                  compact
                />
              ) : null}
            </>
          ) : (
            <FutureLabEmpty>
              {english
                ? "No current hypothesis. Observations will appear as evidence becomes available."
                : "Dabartinės hipotezės nėra. Stebėjimai atsiras sukaupus duomenų."}
            </FutureLabEmpty>
          )}
        </FutureLabPanel>

        <details className="fl-secondary-details self-start">
          <summary>
            {english ? "Prediction calibration" : "Prognozių kalibracija"} ·{" "}
            {calibration ? `${calibration.totalEvaluated}/${calibration.minimumEvaluated}` : "—"}
          </summary>
          <div className="fl-disclosed-content">
            <FutureLabPanel
              eyebrow={english ? "MODEL CALIBRATION" : "MODELIO KALIBRACIJA"}
              title={english ? "Evidence maturity" : "Įrodymų branda"}
              action={<Gauge className="size-4 text-violet-300" />}
            >
              <div className="flex items-center gap-4">
                <div className="relative grid size-24 shrink-0 place-items-center">
                  <svg
                    viewBox="0 0 96 96"
                    className="absolute size-24 -rotate-90"
                    aria-hidden="true"
                  >
                    <circle
                      cx="48"
                      cy="48"
                      r="38"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="5"
                      className="text-foreground/10"
                    />
                    <circle
                      cx="48"
                      cy="48"
                      r="38"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="5"
                      strokeLinecap="round"
                      pathLength="100"
                      strokeDasharray={`${maturity ?? 0} 100`}
                      className="text-cyan-400"
                    />
                  </svg>
                  <span className="font-mono text-xl text-foreground">
                    {maturity === null ? "—" : `${maturity}%`}
                  </span>
                </div>
                <div>
                  <p className="text-xs font-medium text-foreground">
                    {english ? "Workout completion" : "Treniruotės užbaigimas"}
                  </p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {calibration
                      ? `${calibration.totalEvaluated}/${calibration.minimumEvaluated} ${english ? "evaluated outcomes" : "įvertintų rezultatų"}`
                      : query.isError
                        ? unknown
                        : t("common.loading")}
                  </p>
                  <p className="mt-2 text-[9px] uppercase tracking-wider text-violet-300 light:text-violet-700">
                    Shadow
                  </p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3 text-[10px]">
                <p className="text-muted-foreground">
                  {english ? "Captured" : "Užfiksuota"}
                  <span className="ml-2 font-mono text-foreground">
                    {calibration?.totalCaptured ?? "—"}
                  </span>
                </p>
                <p className="text-muted-foreground">
                  {english ? "Pending" : "Laukia"}
                  <span className="ml-2 font-mono text-foreground">
                    {calibration?.totalPending ?? "—"}
                  </span>
                </p>
              </div>
              <p className="mt-3 flex items-start gap-2 text-[10px] leading-relaxed text-muted-foreground">
                <ShieldCheck className="mt-0.5 size-3 shrink-0 text-cyan-400" />
                {english
                  ? "Evidence maturity is not prediction confidence. These forecasts do not influence Today."
                  : "Įrodymų branda nėra prognozės tikrumas. Šios prognozės nedaro įtakos Today."}
              </p>
            </FutureLabPanel>
          </div>
        </details>
      </div>

      <div className="mt-3">
        <EpistemicBoundary
          lab={data ?? null}
          forecast={forecastQuery.isError ? null : (forecastQuery.data ?? null)}
          english={english}
        />
      </div>

      <details className="fl-secondary-details mt-3">
        <summary>{english ? "Evidence domains" : "Duomenų sritys"}</summary>
        <div className="fl-disclosed-content">
          <LabRosterRows
            data={data}
            status={query.isError ? "error" : data ? "ready" : "loading"}
            tiles
          />
          <p className="mt-2 text-[9px] text-muted-foreground">
            {english
              ? "Roles describe the evidence and rules in GYMS.LIFE."
              : "Vaidmenys apibūdina GYMS.LIFE duomenų sritis ir taisykles."}
          </p>
        </div>
      </details>

      <div className="mt-3">
        <ExperimentLedger english={english} />
      </div>
    </section>
  );
}
