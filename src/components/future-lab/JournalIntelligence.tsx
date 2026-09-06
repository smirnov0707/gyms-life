import { useQuery } from "@tanstack/react-query";
import {
  BrainCircuit,
  CheckCircle2,
  FlaskConical,
  History,
  Microscope,
  type LucideIcon,
} from "lucide-react";
import { FutureLabEmpty, FutureLabPanel } from "./FutureLabPanel";
import { baseLang, useI18n } from "@/lib/i18n";
import { browserTimeZone } from "@/lib/local-day";
import { getLabOverview } from "@/lib/lab.functions";

const statements = {
  lt: {
    "athlete.hypothesis.trainingResponse.repeatedLowFeeling":
      "Paskutinės treniruotės pakartotinai jautėsi sunkios.",
    "athlete.hypothesis.trainingBehavior.usualDayFit":
      "Kaip baigtos treniruotės atitinka tavo įprastas treniruočių dienas.",
  },
  en: {
    "athlete.hypothesis.trainingResponse.repeatedLowFeeling":
      "Recent sessions have repeatedly felt difficult.",
    "athlete.hypothesis.trainingBehavior.usualDayFit":
      "How completed sessions fit your usual training days.",
  },
} as const;

type JournalStat = {
  value: number;
  label: string;
  icon: LucideIcon;
};

export function JournalIntelligence() {
  const { lang } = useI18n();
  const locale = baseLang(lang);
  const isEnglish = locale === "en";
  const timeZone = browserTimeZone();
  const query = useQuery({
    queryKey: ["journal-lab", timeZone],
    queryFn: () => getLabOverview({ data: timeZone }),
    staleTime: 60_000,
  });
  const data = query.data;
  const supported = data?.hypotheses.filter((item) => item.status === "supported") ?? [];
  const monitoring =
    data?.hypotheses.filter(
      (item) => item.status === "monitoring" || item.status === "insufficient_evidence",
    ) ?? [];
  const contradicted = data?.hypotheses.filter((item) => item.status === "contradicted") ?? [];
  const statement = (key: string) =>
    statements[locale][key as keyof (typeof statements)[typeof locale]] ??
    (isEnglish ? "A personal pattern is being evaluated." : "Vertinamas asmeninis dėsningumas.");
  const stats: JournalStat[] = [
    {
      value: data?.hypotheses.length ?? 0,
      label: isEnglish ? "Hypotheses" : "Hipotezės",
      icon: Microscope,
    },
    {
      value: supported.length,
      label: isEnglish ? "Discoveries" : "Atradimai",
      icon: CheckCircle2,
    },
    {
      value: monitoring.length,
      label: isEnglish ? "Active tests" : "Aktyvūs testai",
      icon: FlaskConical,
    },
    {
      value: data?.decisions.length ?? 0,
      label: isEnglish ? "Decisions" : "Sprendimai",
      icon: History,
    },
  ];

  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-[#182846] bg-[#040913] p-5 sm:p-7">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_10%,rgba(124,58,237,.17),transparent_30%),radial-gradient(circle_at_10%_90%,rgba(6,182,212,.07),transparent_28%)]"
      />
      <div className="relative">
        <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-violet-300">JOURNAL</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-5xl">
          {isEnglish ? "What GYMS.LIFE has learned" : "Ką GYMS.LIFE jau išmoko"}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-400">
          {isEnglish
            ? "An audit trail of hypotheses, supported discoveries and decisions — separated from raw workout history below."
            : "Hipotezių, patvirtintų atradimų ir sprendimų audito žurnalas — atskirtas nuo žemiau esančios žalios treniruočių istorijos."}
        </p>

        {query.isError ? (
          <div className="mt-6">
            <FutureLabEmpty>
              {isEnglish
                ? "Journal intelligence is temporarily unavailable."
                : "Journal intelligence laikinai nepasiekiamas."}
            </FutureLabEmpty>
          </div>
        ) : (
          <>
            <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {stats.map((stat) => {
                const Icon = stat.icon;
                return (
                  <div
                    key={stat.label}
                    className="rounded-2xl border border-[#17243b] bg-[#08111e]/85 p-4"
                  >
                    <Icon className="size-4 text-violet-300" />
                    <p className="mt-3 text-2xl font-semibold text-white">{stat.value}</p>
                    <p className="mt-1 text-[10px] uppercase tracking-wider text-slate-500">
                      {stat.label}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              <FutureLabPanel
                eyebrow={isEnglish ? "LATEST DISCOVERY" : "NAUJAUSIAS ATRADIMAS"}
                title={
                  supported[0]
                    ? isEnglish
                      ? "Evidence threshold reached"
                      : "Pasiekta įrodymų riba"
                    : isEnglish
                      ? "No discovery yet"
                      : "Atradimų dar nėra"
                }
                action={<BrainCircuit className="size-4 text-emerald-300" />}
              >
                {supported[0] ? (
                  <>
                    <p className="text-sm leading-relaxed text-slate-200">
                      {statement(supported[0].statementKey)}
                    </p>
                    <p className="mt-3 text-[11px] text-emerald-300">
                      {supported[0].evidenceCount}{" "}
                      {isEnglish ? "evidence points" : "įrodymų taškai"}
                    </p>
                  </>
                ) : (
                  <FutureLabEmpty>
                    {isEnglish
                      ? "Supported findings will appear only after the deterministic evidence threshold is met."
                      : "Patvirtinti atradimai atsiras tik pasiekus deterministinę įrodymų ribą."}
                  </FutureLabEmpty>
                )}
              </FutureLabPanel>

              <FutureLabPanel
                eyebrow={isEnglish ? "ACTIVE EXPERIMENTS" : "AKTYVŪS EKSPERIMENTAI"}
                title={
                  monitoring.length
                    ? isEnglish
                      ? `${monitoring.length} patterns under observation`
                      : `Stebima dėsningumų: ${monitoring.length}`
                    : isEnglish
                      ? "Nothing active"
                      : "Aktyvių testų nėra"
                }
                action={<FlaskConical className="size-4 text-amber-300" />}
              >
                {monitoring.length ? (
                  <div className="space-y-3">
                    {monitoring.slice(0, 3).map((item) => (
                      <div
                        key={item.id}
                        className="rounded-xl border border-white/[0.05] bg-white/[0.025] p-3"
                      >
                        <p className="text-xs leading-relaxed text-slate-300">
                          {statement(item.statementKey)}
                        </p>
                        <div className="mt-2 flex items-center justify-between gap-3 text-[10px] text-slate-500">
                          <span>
                            {item.evidenceCount}/{item.minimumEvidenceCount}
                          </span>
                          <span>
                            {item.status === "monitoring"
                              ? isEnglish
                                ? "Monitoring"
                                : "Stebima"
                              : isEnglish
                                ? "Gathering evidence"
                                : "Renkami įrodymai"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <FutureLabEmpty>
                    {isEnglish
                      ? "No hypothesis currently needs more evidence."
                      : "Šiuo metu nė vienai hipotezei nereikia papildomų įrodymų."}
                  </FutureLabEmpty>
                )}
              </FutureLabPanel>
            </div>

            {contradicted.length ? (
              <p className="mt-4 text-[11px] text-slate-500">
                {isEnglish
                  ? "Contradicted hypotheses retained for audit"
                  : "Audito istorijoje išsaugotos paneigtos hipotezės"}
                : {contradicted.length}
              </p>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
