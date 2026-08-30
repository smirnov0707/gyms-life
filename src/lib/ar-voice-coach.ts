import type { TargetState } from "./ar-angles";
import type { Base, RepRecord } from "./ar-smart";

/** One spoken line with a priority: higher wins when several are due. */
type Line = { text: string; priority: number; key: string; cooldown: number };

const TXT = {
  lt: {
    count: (n: number) => `${n}`,
    clean: ["Švaru", "Puiku", "Taip ir laikyk"],
    milestone: (n: number) => `${n} pakartojimai — laikom tempą`,
    slowDown: "Lėčiau leidžiantis",
    faster: "Greičiau aukštyn",
    deeper: "Giliau",
    asym: "Suvienodink puses",
    hold: "Laikyk kūną tvirtai",
    pause: "Nesustok, dar viena serija tavęs laukia",
    push: ["Dar vienas", "Spausk", "Turim jėgų"],
  },
  en: {
    count: (n: number) => `${n}`,
    clean: ["Clean", "Great", "Keep that"],
    milestone: (n: number) => `${n} reps — hold the pace`,
    slowDown: "Slower on the way down",
    faster: "Faster up",
    deeper: "Go deeper",
    asym: "Even out both sides",
    hold: "Keep the body tight",
    pause: "Keep going, you've got more",
    push: ["One more", "Drive", "Strong"],
  },
} as const;

const pick = (arr: readonly string[], i: number) => arr[i % arr.length]!;

/**
 * Advanced live voice coaching: counts reps, calls out the dominant technique
 * error in a couple of words and keeps the tempo of the set alive.
 */
export class VoiceCoach {
  private spokenAt = new Map<string, number>();
  private lastSpeech = 0;
  private lastRepAt = 0;
  private started = 0;

  reset(now: number) {
    this.spokenAt.clear();
    this.lastSpeech = 0;
    this.lastRepAt = now;
    this.started = now;
  }

  /** Returns the line to speak right now, or null when silence is better. */
  tick(args: {
    now: number;
    lang: Base;
    states: TargetState[];
    rep: RepRecord | null;
    repCount: number;
    /** minimum gap between any two spoken lines, ms */
    gap?: number;
  }): string | null {
    const { now, lang, states, rep, repCount } = args;
    const T = TXT[lang];
    const gap = args.gap ?? 1200;
    if (now - this.lastSpeech < gap) return null;

    const candidates: Line[] = [];

    if (rep) {
      this.lastRepAt = now;
      // Rep count is the backbone of the set.
      candidates.push({ text: T.count(repCount), priority: 5, key: "count", cooldown: 0 });
      if (repCount > 0 && repCount % 5 === 0) {
        candidates.push({
          text: T.milestone(repCount),
          priority: 7,
          key: "milestone",
          cooldown: 4000,
        });
      }
      if (rep.fix) {
        candidates.push({ text: rep.fix, priority: 9, key: `fix:${rep.fix}`, cooldown: 5000 });
      } else {
        candidates.push({
          text: pick(T.clean, repCount),
          priority: 4,
          key: "clean",
          cooldown: 6000,
        });
      }
      if (rep.down < 0.6) {
        candidates.push({ text: T.slowDown, priority: 8, key: "tempoDown", cooldown: 8000 });
      }
      if (rep.up > 1.6) {
        candidates.push({ text: T.faster, priority: 8, key: "tempoUp", cooldown: 8000 });
      }
      if (rep.asymmetry >= 12) {
        candidates.push({ text: T.asym, priority: 8, key: "asym", cooldown: 9000 });
      }
    } else {
      // Between reps: correct the joint that is furthest out of range.
      const bad = states.find((s) => s.status !== "ok" && s.cue);
      if (bad) {
        candidates.push({
          text: bad.cue,
          priority: 6,
          key: `cue:${bad.id}`,
          cooldown: 6000,
        });
      }
      // Stalling in the middle of a set — push the tempo.
      const idle = now - this.lastRepAt;
      if (repCount > 0 && idle > 7000 && idle < 25000) {
        candidates.push({
          text: pick(T.push, Math.floor(idle / 7000) + repCount),
          priority: 5,
          key: "push",
          cooldown: 7000,
        });
      }
      if (repCount > 0 && idle >= 25000) {
        candidates.push({ text: T.pause, priority: 3, key: "pause", cooldown: 20000 });
      }
      if (!states.length && now - this.started > 4000) {
        candidates.push({ text: T.hold, priority: 2, key: "hold", cooldown: 15000 });
      }
    }

    const ready = candidates
      .filter((c) => now - (this.spokenAt.get(c.key) ?? -Infinity) >= c.cooldown)
      .sort((a, b) => b.priority - a.priority);

    const chosen = ready[0];
    if (!chosen || !chosen.text.trim()) return null;
    this.spokenAt.set(chosen.key, now);
    this.lastSpeech = now;
    return chosen.text;
  }
}
