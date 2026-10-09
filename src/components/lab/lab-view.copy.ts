import { baseLang, type Lang } from "@/lib/i18n";
import type { LabDecision, LabUnreadableSource } from "@/lib/lab.schema";
import type {
  AthleteHypothesisStatusSchema,
  AthleteLearningDomainSchema,
} from "@/lib/athlete-hypothesis.schema";
import type { z } from "zod";

type HypothesisStatus = z.infer<typeof AthleteHypothesisStatusSchema>;
type LearningDomain = z.infer<typeof AthleteLearningDomainSchema>;

export type LabCopy = {
  eyebrow: string;
  title: string;
  description: string;
  loading: string;
  unavailable: string;
  hypothesesTitle: string;
  hypothesesEmpty: string;
  decisionsTitle: string;
  decisionsEmpty: string;
  unreadableLabel: Record<LabUnreadableSource, string>;
  unreadableNote: (sources: string) => string;
  statusLabel: Record<HypothesisStatus, string>;
  domainLabel: Record<LearningDomain, string>;
  statementLabel: Record<string, string>;
  statementFallback: string;
  basisLabel: Record<LabDecision["basis"], string>;
  actionLabel: Record<LabDecision["action"], string>;
  outcomeLabel: Record<NonNullable<LabDecision["outcome"]>, string>;
  noOutcome: string;
  evidenceCount: (count: number) => string;
  accuracyTitle: string;
  accuracyNote: string;
  accuracyPending: (needed: number) => string;
  fitRate: string;
  answeredOf: (answered: number, proposed: number) => string;
  currentInvestigation: string;
  evidenceProgress: string;
  otherInvestigations: string;
  decisionHistory: string;
};

export function labCopyFor(lang: Lang): LabCopy {
  if (baseLang(lang) === "en") {
    return {
      eyebrow: "LAB",
      title: "What your system is learning",
      description:
        "Patterns are treated as hypotheses until your own evidence supports or contradicts them.",
      loading: "Loading your Lab data…",
      unavailable: "Lab is temporarily unavailable.",
      hypothesesTitle: "Hypotheses",
      hypothesesEmpty:
        "No hypotheses are being tracked yet. Keep logging real training data and this will fill in.",
      decisionsTitle: "Recent decisions",
      decisionsEmpty: "No Today decisions in the last 14 days.",
      unreadableLabel: {
        decisions: "the decisions themselves",
        decision_evidence: "the evidence behind them",
        decision_outcomes: "what you did about them",
      },
      unreadableNote: (sources) =>
        `Could not be read on this request: ${sources}. What is missing below is missing because of that, not because it is not there.`,
      statusLabel: {
        insufficient_evidence: "Not enough evidence yet",
        monitoring: "Monitoring",
        supported: "Supported",
        contradicted: "Contradicted",
      },
      domainLabel: {
        training_response: "Training response",
        training_behavior: "Training behavior",
        recovery: "Recovery",
        nutrition: "Nutrition",
        performance: "Performance",
      },
      statementLabel: {
        "athlete.hypothesis.trainingResponse.repeatedLowFeeling":
          "Recent sessions have repeatedly felt difficult.",
        "athlete.hypothesis.trainingBehavior.usualDayFit":
          "How well completed sessions fit your usual training days.",
      },
      statementFallback: "A new pattern is being tracked.",
      basisLabel: {
        safety_rule: "Safety rule",
        current_day_fact: "Today's fact",
        current_checkin: "Today's check-in",
        observed_pattern: "Observed pattern",
      },
      actionLabel: {
        generate_training_plan: "Build training plan",
        complete_readiness: "Check readiness",
        recover: "Recover",
        train_adapted: "Train (adapted)",
        train_as_planned: "Train as planned",
        log_nutrition: "Log nutrition",
      },
      outcomeLabel: {
        accepted: "Accepted",
        dismissed: "Dismissed",
        completed: "Completed",
        not_helpful: "Marked not helpful",
      },
      noOutcome: "No response yet",
      evidenceCount: (count) => `${count} evidence point${count === 1 ? "" : "s"}`,
      accuracyTitle: "Decision fit",
      accuracyNote:
        "How often a proposed action was taken up. This measures fit with your day, not whether advice was medically or scientifically correct.",
      accuracyPending: (needed) =>
        `At least ${needed} answered decisions are needed before a rate is shown.`,
      fitRate: "Taken up",
      answeredOf: (answered, proposed) => `${answered} answered of ${proposed} proposed`,
      currentInvestigation: "Current investigation",
      evidenceProgress: "Evidence progress",
      otherInvestigations: "Other investigations",
      decisionHistory: "Decision history & fit",
    };
  }

  return {
    eyebrow: "LABORATORIJA",
    title: "Ką tavo sistema mokosi suprasti",
    description:
      "Dėsningumai laikomi hipotezėmis tol, kol tavo paties duomenys juos patvirtina arba paneigia.",
    loading: "Kraunami laboratorijos duomenys…",
    unavailable: "Laboratorija šiuo metu nepasiekiama.",
    hypothesesTitle: "Hipotezės",
    hypothesesEmpty:
      "Kol kas hipotezių nesekama. Toliau registruok realius treniruočių duomenis ir šis skyrius užsipildys.",
    decisionsTitle: "Naujausi sprendimai",
    decisionsEmpty: "Per pastarąsias 14 dienų šiandienos sprendimų nėra.",
    unreadableLabel: {
      decisions: "patys sprendimai",
      decision_evidence: "juos pagrindę įrodymai",
      decision_outcomes: "ką su jais padarei",
    },
    unreadableNote: (sources) =>
      `Šios užklausos metu nepavyko perskaityti: ${sources}. Ko trūksta žemiau — trūksta dėl to, o ne dėl to, kad jo nėra.`,
    statusLabel: {
      insufficient_evidence: "Kol kas nepakanka įrodymų",
      monitoring: "Stebima",
      supported: "Patvirtinta",
      contradicted: "Paneigta",
    },
    domainLabel: {
      training_response: "Reakcija į treniruotę",
      training_behavior: "Treniruočių įprotis",
      recovery: "Atsistatymas",
      nutrition: "Mityba",
      performance: "Rezultatai",
    },
    statementLabel: {
      "athlete.hypothesis.trainingResponse.repeatedLowFeeling":
        "Paskutinės treniruotės pakartotinai jautėsi sunkios.",
      "athlete.hypothesis.trainingBehavior.usualDayFit":
        "Kaip baigtos treniruotės atitinka tavo įprastas treniruočių dienas.",
    },
    statementFallback: "Sekamas naujas dėsningumas.",
    basisLabel: {
      safety_rule: "Saugumo taisyklė",
      current_day_fact: "Šios dienos faktas",
      current_checkin: "Šiandienos check-in",
      observed_pattern: "Pastebėtas dėsningumas",
    },
    actionLabel: {
      generate_training_plan: "Sukurti planą",
      complete_readiness: "Įvertinti pasiruošimą",
      recover: "Atsistatymas",
      train_adapted: "Treniruotė (adaptuota)",
      train_as_planned: "Treniruotė pagal planą",
      log_nutrition: "Registruoti mitybą",
    },
    outcomeLabel: {
      accepted: "Priimta",
      dismissed: "Atmesta",
      completed: "Atlikta",
      not_helpful: "Pažymėta kaip netinkama",
    },
    noOutcome: "Dar be atsakymo",
    evidenceCount: (count) => `${count} įrodymo taškas(-ai)`,
    accuracyTitle: "Sprendimų atitikimas",
    accuracyNote:
      "Kaip dažnai pasiūlytas veiksmas buvo priimtas. Tai matuoja atitikimą tavo dienai, o ne medicininį ar mokslinį patarimo teisingumą.",
    accuracyPending: (needed) =>
      `Reikia bent ${needed} atsakytų sprendimų, kad būtų rodomas santykis.`,
    fitRate: "Priimta",
    answeredOf: (answered, proposed) => `atsakyta ${answered} iš ${proposed} pasiūlytų`,
    currentInvestigation: "Dabartinis tyrimas",
    evidenceProgress: "Įrodymų progresas",
    otherInvestigations: "Kiti tyrimai",
    decisionHistory: "Sprendimų istorija ir atitikimas",
  };
}
