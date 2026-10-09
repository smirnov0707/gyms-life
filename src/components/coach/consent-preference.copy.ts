import { AI_CONTEXT_WINDOW_LABEL, OTHER_PERSONALIZED_AI_TASK_COUNT } from "@/lib/ai-task-context";
import { ACTIVE_MEMORY_FACT_LIMIT } from "@/lib/user-memory.schema";
import { COACH_HISTORY_TURNS } from "@/lib/coach-message.schema";
import { baseLang, type Lang } from "@/lib/i18n";
import type { ConsentPreferenceState } from "./consent-preference.session";

export function consentPreferenceCopy(lang: Lang) {
  const english = baseLang(lang) === "en";
  return {
    eyebrow: english ? "AI PRIVACY" : "AI PRIVATUMAS",
    title: english ? "Personal context" : "Asmeninis kontekstas",
    description: english
      ? `Coach, Daily Brief and ${OTHER_PERSONALIZED_AI_TASK_COUNT} other features that adapt to you — plans, meals, scans, suggestions — can send only ${AI_CONTEXT_WINDOW_LABEL}-day summaries and up to ${ACTIVE_MEMORY_FACT_LIMIT} active facts, preferences, and patterns. The last ${COACH_HISTORY_TURNS} messages of this conversation are sent too, so Coach does not answer as if it never happened. Raw records and your account name are never sent.`
      : `Coach, Daily Brief ir dar ${OTHER_PERSONALIZED_AI_TASK_COUNT} funkcijos, kurios prie tavęs prisitaiko (planai, mityba, skenavimai, pasiūlymai), AI tiekėjui gali perduoti tik ${AI_CONTEXT_WINDOW_LABEL} dienų suvestines bei iki ${ACTIVE_MEMORY_FACT_LIMIT} aktyvių faktų, pirmenybių ir dėsningumų. Kad Coach neatsakinėtų taip, tarsi pokalbio nebūtų buvę, perduodami ir paskutiniai ${COACH_HISTORY_TURNS} šio pokalbio pranešimų. Neperduodami žali įrašai ir paskyros vardas.`,
    active: english ? "Personal context enabled" : "Asmeninis kontekstas įjungtas",
    inactive: english
      ? "Using basic training preferences only"
      : "Naudojami tik baziniai treniruočių nustatymai",
    enable: english ? "Enable" : "Įjungti",
    disable: english ? "Disable" : "Išjungti",
    retry: english ? "Check current preference" : "Patikrinti dabartinį pasirinkimą",
    status: {
      loading: english ? "Checking your privacy preference…" : "Tikrinamas privatumo pasirinkimas…",
      signed_out: english
        ? "Sign in to view your privacy preference."
        : "Prisijunk, kad matytum savo privatumo pasirinkimą.",
      saving: english ? "Confirming your choice…" : "Patvirtinamas pasirinkimas…",
      read: english
        ? "Your privacy preference could not be read. Its current state is unknown."
        : "Privatumo pasirinkimo perskaityti nepavyko. Dabartinė būsena nežinoma.",
      save: english
        ? "The change could not be confirmed. It may already be saved. Check the current preference before changing it again."
        : "Pakeitimo patvirtinti nepavyko. Jis jau galėjo būti išsaugotas. Prieš keisdamas dar kartą patikrink dabartinį pasirinkimą.",
    },
  };
}

export function consentPreferenceStatus(state: ConsentPreferenceState, lang: Lang): string {
  const copy = consentPreferenceCopy(lang);
  switch (state.status) {
    case "ready":
      return state.enabled ? copy.active : copy.inactive;
    case "unavailable":
      return copy.status[state.reason];
    case "loading":
      return copy.status.loading;
    case "saving":
      return copy.status.saving;
    case "signed_out":
      return copy.status.signed_out;
  }
}
