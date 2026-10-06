export type AdaptationOutcomeInput = {
  sessionsAfter: number;
  ratedResponsesAfter: number;
  lowResponseStreakAfter: number;
  readinessBandAfter: "low" | "moderate" | "high" | "unknown";
  daysObserved: number;
};

export type AdaptationOutcome = {
  status: "too_early" | "observed";
  association:
    | "improved_signals"
    | "mixed_signals"
    | "worse_signals"
    | "insufficient_signal";
  facts: string[];
  causalClaim: false;
};

export function assessAdaptationOutcome(
  input: AdaptationOutcomeInput,
): AdaptationOutcome {
  if (input.daysObserved < 3) {
    return {
      status: "too_early",
      association: "insufficient_signal",
      facts: ["observation_window_under_3_days"],
      causalClaim: false,
    };
  }

  const facts = [
    "sessions_after:" + input.sessionsAfter,
    "rated_responses_after:" + input.ratedResponsesAfter,
    "low_response_streak_after:" + input.lowResponseStreakAfter,
    "readiness_after:" + input.readinessBandAfter,
  ];

  const hasReadiness = input.readinessBandAfter !== "unknown";
  const hasRatedResponse = input.ratedResponsesAfter > 0;

  if (!hasReadiness && !hasRatedResponse) {
    return {
      status: "observed",
      association: "insufficient_signal",
      facts,
      causalClaim: false,
    };
  }

  if (
    input.readinessBandAfter === "high" &&
    (!hasRatedResponse || input.lowResponseStreakAfter === 0)
  ) {
    return {
      status: "observed",
      association: "improved_signals",
      facts,
      causalClaim: false,
    };
  }

  if (
    input.readinessBandAfter === "low" &&
    input.ratedResponsesAfter >= 2 &&
    input.lowResponseStreakAfter >= 2
  ) {
    return {
      status: "observed",
      association: "worse_signals",
      facts,
      causalClaim: false,
    };
  }

  return {
    status: "observed",
    association: "mixed_signals",
    facts,
    causalClaim: false,
  };
}
