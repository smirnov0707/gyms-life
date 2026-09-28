// Only the persistence boundary is simulated; calculations use the production engine.
import {
  calculateReadinessScore,
  loadModifierFor,
  type DailyReadinessFactors,
} from "@/lib/readiness.engine";
import { dayInTimeZone } from "@/lib/local-day";
import { state, count, ids, delay, persist } from "./state";
export async function submitCheckin({
  data,
}: {
  data: DailyReadinessFactors & { lang: string; timeZone: string };
}) {
  count("submitCheckin");
  state.last.submitCheckin = data;
  await delay();
  if (state.fail === "save-readiness") throw new Error("Synthetic check-in save unavailable");
  const { lang: _lang, timeZone, ...factors } = data;
  const score = calculateReadinessScore(factors);
  const modifier = loadModifierFor(score);
  state.checkin = {
    id: "66666666-6666-4666-8666-666666666666",
    user_id: ids.USER,
    checkin_on: dayInTimeZone(new Date(), timeZone),
    readiness_score: score,
    load_modifier: modifier,
    advice: "Synthetic saved check-in advice.",
  };
  persist();
  return { score, modifier, advice: state.checkin.advice };
}
