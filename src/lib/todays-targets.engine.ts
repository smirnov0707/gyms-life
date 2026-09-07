/**
 * Which body regions today's session is going to train.
 *
 * The Twin already says which regions are recovered. This says which ones the
 * plan is about to load, so the figure can carry both at once: what the body
 * is ready for, and what it is being asked to do. They are different
 * questions with different evidence, and the screen must not blur them —
 * recovery is calculated from logged sets, this is simply read off the
 * programme.
 *
 * Pure and total. The mapping from exercise to region is the same
 * `exercises.muscle_group` lookup the recovery model uses, so a region can
 * never mean one thing on the figure and another in the session list.
 */

export type TodaysTargetExercise = {
  slug: string;
  name: string;
  sets: number;
  reps: string;
};

export type TodaysTargets =
  /** The programme or the exercise catalogue could not be read. */
  | { status: "unreadable" }
  /** Read successfully, and there is no session today. */
  | { status: "rest" }
  | {
      status: "session";
      title: string;
      /** Regions the session trains, in the order the session works them. */
      regions: string[];
      /** What each region is being asked to do today. */
      byRegion: Record<string, TodaysTargetExercise[]>;
      /**
       * Exercises the catalogue has no muscle group for.
       *
       * They are in the session and they will be trained; we simply cannot
       * place them on the body. Counting them as "no region" would let the
       * figure show a clean side that is about to be worked, so they are
       * carried out separately and named.
       */
      unplaceable: TodaysTargetExercise[];
    };

export type TodaysTargetsInput = {
  /** Null when the programme read failed, as opposed to finding no session. */
  session: { title: string; exercises: TodaysTargetExercise[] } | null | undefined;
  /** Null when the catalogue read failed. Empty is a real, if unusual, answer. */
  muscleGroupBySlug: ReadonlyMap<string, string> | null;
  /** False when the source said there is no session today rather than failing. */
  sessionReadable: boolean;
};

export function buildTodaysTargets(input: TodaysTargetsInput): TodaysTargets {
  if (!input.sessionReadable || input.muscleGroupBySlug === null) return { status: "unreadable" };
  if (!input.session) return { status: "rest" };

  const byRegion: Record<string, TodaysTargetExercise[]> = {};
  const regions: string[] = [];
  const unplaceable: TodaysTargetExercise[] = [];

  for (const exercise of input.session.exercises) {
    const region = input.muscleGroupBySlug.get(exercise.slug);
    if (!region) {
      unplaceable.push(exercise);
      continue;
    }
    if (!byRegion[region]) {
      byRegion[region] = [];
      regions.push(region);
    }
    byRegion[region].push(exercise);
  }

  return {
    status: "session",
    title: input.session.title,
    regions,
    byRegion,
    unplaceable,
  };
}

/** Convenience for the figure: is this region on today's list? */
export function targetsRegion(targets: TodaysTargets, region: string): boolean {
  return targets.status === "session" && region in targets.byRegion;
}
