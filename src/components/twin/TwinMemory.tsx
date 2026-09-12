import { BrainCircuit, ShieldCheck } from "lucide-react";
import { baseLang, useI18n } from "@/lib/i18n";
import { useLabOverview } from "@/components/future-lab/lab-overview.query";

const STATEMENT = {
  en: {
    "athlete.hypothesis.trainingResponse.repeatedLowFeeling":
      "Repeated difficult sessions may signal accumulating training fatigue.",
    "athlete.hypothesis.trainingBehavior.usualDayFit":
      "Your completed sessions are being compared with your usual training rhythm.",
  },
  lt: {
    "athlete.hypothesis.trainingResponse.repeatedLowFeeling":
      "Pasikartojančios sunkios treniruotės gali rodyti besikaupiantį treniruočių nuovargį.",
    "athlete.hypothesis.trainingBehavior.usualDayFit":
      "Atliktos treniruotės lyginamos su tavo įprastu treniruočių ritmu.",
  },
} as const;

export function TwinMemory() {
  const { lang } = useI18n();
  const english = baseLang(lang) === "en";
  const query = useLabOverview();
  const hypotheses = query.isError ? [] : (query.data?.hypotheses ?? []);
  const labels = english
    ? {
        supported: "Learned pattern",
        monitoring: "Still learning",
        insufficient_evidence: "Not enough evidence",
        contradicted: "Evidence contradicted",
      }
    : {
        supported: "Išmoktas dėsningumas",
        monitoring: "Vis dar mokomasi",
        insufficient_evidence: "Įrodymų nepakanka",
        contradicted: "Duomenys prieštarauja",
      };
  return (
    <section
      className="rounded-3xl border border-border bg-surface p-4 md:p-5"
      aria-label="Twin Memory"
    >
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-violet-300">
            TWIN MEMORY
          </p>
          <h2 className="mt-1 text-lg font-semibold text-foreground">
            {english ? "What GYMS.LIFE has learned about you" : "Ką GYMS.LIFE apie tave išmoko"}
          </h2>
        </div>
        <BrainCircuit aria-hidden="true" className="size-5 text-violet-300" />
      </header>
      {query.isLoading ? (
        <p className="mt-3 text-xs text-muted-foreground">
          {english ? "Reading longitudinal evidence…" : "Skaitomi ilgalaikiai įrodymai…"}
        </p>
      ) : null}
      {query.isError ? (
        <p role="alert" className="mt-3 text-xs text-muted-foreground">
          {english
            ? "Longitudinal evidence is unavailable. Nothing is inferred."
            : "Ilgalaikiai įrodymai nepasiekiami. Nieko nespėjama."}
        </p>
      ) : null}
      {!query.isLoading && !query.isError && hypotheses.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">
          {english
            ? "No stable personal pattern is available yet."
            : "Stabilaus asmeninio dėsningumo dar nėra."}
        </p>
      ) : null}
      {hypotheses.length ? (
        <div className="mt-4 grid gap-2">
          {hypotheses.slice(0, 4).map((hypothesis) => {
            const copy = STATEMENT[english ? "en" : "lt"];
            const statement =
              copy[hypothesis.statementKey as keyof typeof copy] ??
              (english
                ? "A personal pattern is under evaluation."
                : "Vertinamas asmeninis dėsningumas.");
            return (
              <article
                key={hypothesis.id}
                className="rounded-2xl border border-border/70 bg-surface-2/50 p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[10px] font-medium text-foreground">
                    {labels[hypothesis.status]}
                  </span>
                  <span className="text-[9px] text-muted-foreground">
                    {hypothesis.evidenceCount}/{hypothesis.minimumEvidenceCount} evidence
                  </span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-foreground">{statement}</p>
                <p className="mt-2 flex items-center gap-1.5 text-[9px] text-muted-foreground">
                  <ShieldCheck aria-hidden="true" className="size-3 text-violet-300" />
                  {english
                    ? "Deterministic evidence · decision authority"
                    : "Deterministiniai įrodymai · sprendimo teisė"}
                  :{" "}
                  {hypothesis.canInfluenceDecision
                    ? english
                      ? "allowed"
                      : "leidžiama"
                    : english
                      ? "not allowed"
                      : "neleidžiama"}
                </p>
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
