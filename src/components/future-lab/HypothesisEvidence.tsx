import { baseLang, useI18n } from "@/lib/i18n";
import type { AthleteHypothesis } from "@/lib/athlete-hypothesis.schema";
import { WhyThisDisclosure } from "@/components/intelligence/WhyThisDisclosure";

function metricLabel(key: string, english: boolean) {
  switch (key) {
    case "rated_sessions_28d":
      return english ? "Rated sessions · 28 days" : "Įvertintos sesijos · 28 dienos";
    case "recent_low_feeling_streak":
      return english ? "Consecutive difficult sessions" : "Sunkios sesijos iš eilės";
    case "usual_training_days_28d":
      return english ? "Usual training days · 28 days" : "Įprastos treniruočių dienos · 28 dienos";
    case "usual_day_completion_rate_28d":
      return english ? "Completion on usual days" : "Atlikimas įprastomis dienomis";
    default:
      return english ? "Additional observation" : "Papildomas stebėjimas";
  }
}

export function HypothesisEvidence({ evidence }: { evidence: AthleteHypothesis["evidence"] }) {
  const { lang } = useI18n();
  const english = baseLang(lang) === "en";
  return (
    <WhyThisDisclosure
      summary={english ? "Why this? · Evidence" : "Kodėl taip? · Įrodymai"}
      className="mt-3 bg-violet-500/[0.03]"
    >
      <dl className="space-y-2 p-3">
        {evidence.map((item) => (
          <div key={item.key} className="flex items-start justify-between gap-3 text-[10px]">
            <dt className="text-muted-foreground">
              {metricLabel(item.key, english)}
              <span className="mt-0.5 block text-[9px]">
                {item.source === "user_reported"
                  ? english
                    ? "Self-reported"
                    : "Paties nurodyta"
                  : item.source === "measured"
                    ? english
                      ? "Measured"
                      : "Išmatuota"
                    : english
                      ? "Calculated"
                      : "Apskaičiuota"}
              </span>
            </dt>
            <dd className="shrink-0 font-mono text-foreground">
              {new Intl.NumberFormat(
                lang,
                item.unit === "ratio"
                  ? { style: "percent", maximumFractionDigits: 1 }
                  : { maximumFractionDigits: 1 },
              ).format(item.value)}
            </dd>
          </div>
        ))}
      </dl>
    </WhyThisDisclosure>
  );
}
