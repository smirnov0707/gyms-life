import type { LabUnreadableSource } from "@/lib/lab.schema";

export type LabReadMode = "loading" | "unavailable" | "partial" | "stale" | "refreshing";

type LabReadCopy = {
  title: Record<LabReadMode, string>;
  description: Record<LabReadMode, string>;
  source: Record<LabUnreadableSource, string>;
  missingSources: string;
  retry: string;
  retrying: string;
  decisionsUnavailable: string;
  outcomeUnavailable: string;
  fitUnavailable: string;
};

/** Read availability is not a measurement, a confidence score or an empty history. */
export function labReadCopyFor(language: "lt" | "en"): LabReadCopy {
  if (language === "lt") {
    return {
      title: {
        loading: "Kraunami laboratorijos duomenys…",
        unavailable: "Laboratorija šiuo metu nepasiekiama.",
        partial: "Dalis istorijos šiuo metu nepasiekiama",
        stale: "Rodoma anksčiau įkelta laboratorijos būsena",
        refreshing: "Atnaujinami laboratorijos duomenys…",
      },
      description: {
        loading: "Laukiama duomenų. Istorijos ir rodiklių dar nevertiname.",
        unavailable: "Duomenų perskaityti nepavyko. Tai nereiškia, kad tavo istorija tuščia.",
        partial:
          "Rodome perskaitytus įrašus. Trūkstamų duomenų nelaikome nuliais ar neatliktais veiksmais.",
        stale:
          "Atnaujinti nepavyko. Žemiau liko paskutiniai sėkmingai įkelti duomenys, o ne naujos patikros rezultatas.",
        refreshing: "Anksčiau įkelti duomenys lieka matomi, kol bus gautas naujas atsakymas.",
      },
      source: {
        decisions: "sprendimų istorija",
        decision_evidence: "sprendimų pagrindimas",
        decision_outcomes: "atsakymai į sprendimus",
      },
      missingSources: "Nepavyko perskaityti",
      retry: "Pakartoti patikrą",
      retrying: "Tikrinama…",
      decisionsUnavailable:
        "Sprendimų istorijos perskaityti nepavyko. Negalime patvirtinti, kad ji tuščia.",
      outcomeUnavailable: "Atsakymo patikrinti nepavyko",
      fitUnavailable:
        "Atitikimo rodiklis nerodomas: nepavyko perskaityti visų jam reikalingų sprendimų arba atsakymų.",
    };
  }
  return {
    title: {
      loading: "Loading your Lab data…",
      unavailable: "Lab is temporarily unavailable.",
      partial: "Some history is currently unavailable",
      stale: "Showing the previously loaded Lab snapshot",
      refreshing: "Updating your Lab data…",
    },
    description: {
      loading: "Waiting for data. History and metrics have not been evaluated yet.",
      unavailable: "The data could not be read. This does not mean your history is empty.",
      partial:
        "Readable records remain visible. Missing data is not counted as zero or as an action you did not take.",
      stale:
        "The refresh failed. The last successfully loaded data remains below; it is not a newly verified result.",
      refreshing: "Previously loaded data stays visible until the new response arrives.",
    },
    source: {
      decisions: "decision history",
      decision_evidence: "decision evidence",
      decision_outcomes: "decision responses",
    },
    missingSources: "Could not be read",
    retry: "Retry check",
    retrying: "Checking…",
    decisionsUnavailable: "Decision history could not be read. We cannot confirm that it is empty.",
    outcomeUnavailable: "Response could not be verified",
    fitUnavailable:
      "The fit rate is hidden because some required decisions or responses could not be read.",
  };
}
