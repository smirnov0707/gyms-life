import { Link } from "@tanstack/react-router";
import type { EvidenceAcquisitionRecommendation } from "@/lib/evidence-acquisition";

function message(recommendation: EvidenceAcquisitionRecommendation, english: boolean): string {
  const remaining = recommendation.evidenceRemaining;
  switch (recommendation.action) {
    case "rate_next_workout":
      return english
        ? `Rate your next completed workout${remaining ? ` · ${remaining} more observation(s) to the current evidence threshold` : ""}.`
        : `Įvertink kitą užbaigtą treniruotę${remaining ? ` · iki dabartinės įrodymų ribos trūksta ${remaining}` : ""}.`;
    case "complete_next_workout":
      return english
        ? "Complete the next planned workout so the Twin has another observed training point."
        : "Užbaik kitą suplanuotą treniruotę, kad Twin gautų dar vieną stebėtą treniruotės tašką.";
    case "record_recovery_checkin":
      return english
        ? "Record a recovery check-in; recent recovery evidence is currently missing."
        : "Įrašyk atsistatymo check-in — šiuo metu trūksta naujausių atsistatymo duomenų.";
    case "log_nutrition":
      return english
        ? "Log nutrition to restore a recent nutrition evidence window."
        : "Įrašyk mitybą, kad būtų atkurtas naujausias mitybos įrodymų langas.";
    case "record_body_metric":
      return english
        ? "Record a body measurement to refresh the longitudinal body baseline."
        : "Įrašyk kūno matavimą, kad būtų atnaujinta ilgalaikė kūno atskaita.";
    case "enable_personalization":
      return english
        ? "Enable AI personalization before context-dependent intelligence can use those sources."
        : "Įjunk AI personalizavimą, kad kontekstinis intelligence galėtų naudoti šiuos šaltinius.";
  }
}
export function EvidenceAcquisitionPrompt({
  recommendation,
  english,
  compact = false,
}: {
  recommendation: EvidenceAcquisitionRecommendation;
  english: boolean;
  compact?: boolean;
}) {
  return (
    <div
      className={
        compact
          ? "mt-3 border-t border-border/70 pt-3"
          : "mt-4 rounded-2xl border border-border/70 bg-surface-2/40 p-3"
      }
    >
      <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-violet-300">
        {english ? "WHAT WOULD REDUCE UNCERTAINTY" : "KAS SUMAŽINTŲ NEŽINOMYBĘ"}
      </p>
      <p className="mt-2 text-xs leading-relaxed text-foreground">
        {message(recommendation, english)}
      </p>
      <div className="mt-2 flex items-center justify-between gap-3">
        <span className="text-[9px] text-muted-foreground">
          {english ? "Decision authority: none" : "Sprendimo teisė: nėra"}
        </span>
        <Link
          to={recommendation.route}
          className="inline-flex min-h-11 items-center text-xs font-medium text-violet-300"
        >
          {english ? "Add evidence" : "Pridėti įrodymą"} →
        </Link>
      </div>
    </div>
  );
}
