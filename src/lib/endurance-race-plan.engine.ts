import { RACE_DISTANCE_METERS, type RaceDistance } from "./endurance-activity.schema";
import type { EndurancePlanSession, RaceGoal } from "./endurance-race-goal.schema";

export type RacePlanBaseline = {
  recentWeeklyDistanceMeters: number | null;
  recentLongestRunMeters: number | null;
};

export type RacePlanWeek = {
  week: number;
  phase: "base" | "build" | "specific" | "taper" | "race";
  targetDistanceMeters: number;
  sessions: EndurancePlanSession[];
};

export type RacePlan = {
  distance: RaceDistance;
  raceDate: string;
  weeks: number;
  baseline: "measured" | "conservative_default";
  weeksPlan: RacePlanWeek[];
};

const DAY_MS = 86_400_000;
const round100 = (n: number) => Math.max(100, Math.round(n / 100) * 100);

function daysBetween(startDay: string, endDay: string): number {
  const start = Date.parse(startDay + "T00:00:00Z");
  const end = Date.parse(endDay + "T00:00:00Z");
  return Math.floor((end - start) / DAY_MS);
}

function defaultWeeklyDistance(distance: RaceDistance): number {
  return distance === "5k" ? 12_000 : distance === "10k" ? 18_000 : distance === "half_marathon" ? 24_000 : 30_000;
}

function phaseFor(week: number, weeks: number): RacePlanWeek["phase"] {
  if (week === weeks) return "race";
  if (week >= weeks - 2) return "taper";
  const ratio = week / weeks;
  if (ratio <= 0.3) return "base";
  if (ratio <= 0.65) return "build";
  return "specific";
}

function sessionMix(sessionsPerWeek: number, weeklyDistance: number, phase: RacePlanWeek["phase"], raceDistance: number, week: number): EndurancePlanSession[] {
  if (phase === "race") {
    return [{
      sessionKey: `w${week}-s1`,
      intent: "race",
      plannedDurationMinutes: null,
      plannedDistanceMeters: raceDistance,
      intensityCue: "Race effort guided by the completed preparation and current-day safety state.",
    }];
  }

  const intents: EndurancePlanSession["intent"][] =
    sessionsPerWeek === 2 ? ["easy", "long"] :
    sessionsPerWeek === 3 ? ["easy", "tempo", "long"] :
    sessionsPerWeek === 4 ? ["easy", "intervals", "easy", "long"] :
    ["easy", "intervals", "easy", "tempo", ...Array(Math.max(0, sessionsPerWeek - 5)).fill("recovery"), "long"];

  const longShare = phase === "taper" ? 0.25 : 0.35;
  const qualityShare = phase === "taper" ? 0.15 : 0.2;
  const longDistance = round100(weeklyDistance * longShare);
  const qualityCount = intents.filter((i) => i === "tempo" || i === "intervals").length;
  const fixed = longDistance + qualityCount * round100(weeklyDistance * qualityShare / Math.max(1, qualityCount));
  const easyCount = intents.filter((i) => i === "easy" || i === "recovery").length;
  const easyDistance = round100(Math.max(1_000, (weeklyDistance - fixed) / Math.max(1, easyCount)));

  return intents.map((intent, index) => ({
    sessionKey: `w${week}-s${index + 1}`,
    intent,
    plannedDurationMinutes: null,
    plannedDistanceMeters:
      intent === "long" ? longDistance :
      intent === "tempo" || intent === "intervals" ? round100(weeklyDistance * qualityShare / Math.max(1, qualityCount)) :
      easyDistance,
    intensityCue:
      intent === "easy" || intent === "recovery" ? "Conversational, controlled effort." :
      intent === "long" ? "Comfortable endurance effort; finish with control." :
      intent === "tempo" ? "Sustainably hard, never all-out." :
      "Fast repetitions with controlled recoveries.",
  }));
}

export function buildRacePlan(input: { today: string; goal: RaceGoal; baseline: RacePlanBaseline }): RacePlan {
  const days = daysBetween(input.today, input.goal.raceDate);
  if (days < 14) throw new Error("Race preparation requires at least 14 days.");
  const weeks = Math.max(2, Math.ceil(days / 7));
  const measured = input.baseline.recentWeeklyDistanceMeters !== null && input.baseline.recentWeeklyDistanceMeters > 0;
  const startingWeekly = measured ? input.baseline.recentWeeklyDistanceMeters! : defaultWeeklyDistance(input.goal.distance);
  const raceDistance = RACE_DISTANCE_METERS[input.goal.distance];

  const weeksPlan: RacePlanWeek[] = [];
  let previous = startingWeekly;
  for (let week = 1; week <= weeks; week += 1) {
    const phase = phaseFor(week, weeks);
    let target = previous;
    if (phase === "build" || phase === "specific") target = Math.min(previous * 1.08, raceDistance * 1.5);
    if (phase === "taper") target = previous * 0.72;
    if (phase === "race") target = raceDistance;
    target = round100(target);
    weeksPlan.push({
      week,
      phase,
      targetDistanceMeters: target,
      sessions: sessionMix(input.goal.sessionsPerWeek, target, phase, raceDistance, week),
    });
    previous = target;
  }

  return { distance: input.goal.distance, raceDate: input.goal.raceDate, weeks, baseline: measured ? "measured" : "conservative_default", weeksPlan };
}
