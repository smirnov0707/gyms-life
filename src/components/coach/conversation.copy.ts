import { baseLang, type Lang } from "@/lib/i18n";
import type { CoachHistoryState } from "./conversation.session";

type Copy = {
  history: Record<CoachHistoryState, string>;
  retry: string;
  sendUnconfirmed: string;
  clearUnconfirmed: string;
  preservedQuestion: string;
  sendAgain: string;
  clearConfirm: string;
  clearAccept: string;
  cancel: string;
  clearing: string;
  visit: string;
  limit: string;
};
export function conversationCopy(lang: Lang): Copy {
  if (baseLang(lang) === "lt") return {
    history: {
      signed_out: "Prisijunk, kad matytum savo pokalbį.",
      loading: "Kraunama ankstesnė pokalbio istorija. Klausimą gali rašyti jau dabar.",
      refreshing: "Tikrinama istorija. Iki šiol įkeltos žinutės lieka matomos.",
      ready: "Pokalbio istorija įkelta.",
      unavailable: "Istorijos perskaityti nepavyko. Tai nereiškia, kad pokalbis tuščias.",
      stale: "Istorijos atnaujinti nepavyko. Rodomos anksčiau įkeltos žinutės.",
      outdated: "Šios sesijos žinutės rodomos žemiau. Ankstesnę istoriją gali patikrinti atskirai.",
    },
    retry: "Patikrinti istoriją",
    sendUnconfirmed: "Atsakymo negavome. Klausimas išlaikytas, o serveris jį jau galėjo apdoroti. Pirmiausia patikrink istoriją. Pakartotinis siuntimas gali sukurti antrą pokalbį.",
    clearUnconfirmed: "Negalime patvirtinti, ar istorija išvalyta. Žinutės galėjo būti pašalintos. Patikrink istoriją; trynimo automatiškai nekartosime.",
    preservedQuestion: "Išlaikytas klausimas",
    sendAgain: "Siųsti dar kartą",
    clearConfirm: "Išvalyti išsaugotą pokalbio istoriją? Jos atkurti negalėsi. Neatsiųstas tekstas įvesties lauke liks.",
    clearAccept: "Taip, išvalyti istoriją",
    cancel: "Atšaukti",
    clearing: "Valoma istorija…",
    visit: "Šios sesijos žinutė",
    limit: "Klausimas gali būti iki 1 000 simbolių. Tekstas nebuvo išsiųstas ar nukirptas.",
  };
  return {
    history: {
      signed_out: "Sign in to see your conversation.",
      loading: "Loading earlier conversation history. You can already write your question.",
      refreshing: "Checking history. Previously loaded messages remain visible.",
      ready: "Conversation history loaded.",
      unavailable: "History could not be read. This does not mean the conversation is empty.",
      stale: "History could not be refreshed. Previously loaded messages remain visible.",
      outdated: "Messages from this visit remain below. You can check earlier history separately.",
    },
    retry: "Check history",
    sendUnconfirmed: "No reply was received. Your question is retained, and the server may already have processed it. Check history first. Sending again may create a duplicate conversation.",
    clearUnconfirmed: "We cannot confirm whether history was cleared. Messages may already have been removed. Check history; deletion will not be retried automatically.",
    preservedQuestion: "Retained question",
    sendAgain: "Send again",
    clearConfirm: "Clear saved conversation history? This cannot be undone. Unsent text in the composer will remain.",
    clearAccept: "Yes, clear history",
    cancel: "Cancel",
    clearing: "Clearing history…",
    visit: "Message from this visit",
    limit: "Questions can contain up to 1,000 characters. Your text was not sent or truncated.",
  };
}
