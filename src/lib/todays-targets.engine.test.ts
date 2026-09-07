import { describe, expect, it } from "vitest";
import { buildTodaysTargets, targetsRegion } from "./todays-targets.engine";

const bench = { slug: "bench-press", name: "Bench press", sets: 4, reps: "6" };
const row = { slug: "chest-supported-row", name: "Chest supported row", sets: 3, reps: "10" };
const flye = { slug: "cable-flye", name: "Cable flye", sets: 3, reps: "12" };

const catalogue = new Map([
  ["bench-press", "chest"],
  ["chest-supported-row", "back"],
  ["cable-flye", "chest"],
]);

describe("buildTodaysTargets", () => {
  it("groups the session's exercises onto the regions they train", () => {
    const targets = buildTodaysTargets({
      session: { title: "Upper body", exercises: [bench, row, flye] },
      muscleGroupBySlug: catalogue,
      sessionReadable: true,
    });

    expect(targets).toMatchObject({
      status: "session",
      title: "Upper body",
      // In the order the session works them, not alphabetically: the figure
      // reads top to bottom the way the athlete will train.
      regions: ["chest", "back"],
      unplaceable: [],
    });
    expect(targets.status === "session" && targets.byRegion["chest"]).toEqual([bench, flye]);
  });

  it("carries an exercise the catalogue cannot place, rather than dropping it", () => {
    // Dropped, it would leave a region clean on the figure that is about to be
    // worked — the session would look lighter than it is.
    const targets = buildTodaysTargets({
      session: {
        title: "Upper body",
        exercises: [bench, { slug: "unknown-lift", name: "Unknown lift", sets: 3, reps: "8" }],
      },
      muscleGroupBySlug: catalogue,
      sessionReadable: true,
    });

    expect(targets.status === "session" && targets.regions).toEqual(["chest"]);
    expect(targets.status === "session" && targets.unplaceable).toEqual([
      { slug: "unknown-lift", name: "Unknown lift", sets: 3, reps: "8" },
    ]);
  });

  it("tells a rest day from a programme it could not read", () => {
    expect(
      buildTodaysTargets({ session: null, muscleGroupBySlug: catalogue, sessionReadable: true }),
    ).toEqual({ status: "rest" });

    expect(
      buildTodaysTargets({ session: null, muscleGroupBySlug: catalogue, sessionReadable: false }),
    ).toEqual({ status: "unreadable" });
  });

  it("refuses to place anything when the catalogue could not be read", () => {
    // Every exercise would look unplaceable, which reads as "the session
    // trains nothing we can find" instead of "we could not look".
    expect(
      buildTodaysTargets({
        session: { title: "Upper body", exercises: [bench] },
        muscleGroupBySlug: null,
        sessionReadable: true,
      }),
    ).toEqual({ status: "unreadable" });
  });

  it("answers the figure's question without it knowing the shape", () => {
    const targets = buildTodaysTargets({
      session: { title: "Upper body", exercises: [bench] },
      muscleGroupBySlug: catalogue,
      sessionReadable: true,
    });
    expect(targetsRegion(targets, "chest")).toBe(true);
    expect(targetsRegion(targets, "back")).toBe(false);
    // Neither a rest day nor an outage marks anything on the body.
    expect(targetsRegion({ status: "rest" }, "chest")).toBe(false);
    expect(targetsRegion({ status: "unreadable" }, "chest")).toBe(false);
  });
});
