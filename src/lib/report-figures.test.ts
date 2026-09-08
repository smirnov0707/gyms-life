import { describe, expect, it } from "vitest";
import { REPORT_SOURCES, type ReportSource } from "./medical-report.schema";
import {
  FIGURE_SOURCES,
  formatReportFigure,
  reportFigure,
  unreadableSources,
  type ReportFigureKey,
} from "./report-figures";

/**
 * The report becomes a document a physician reads, so the difference between
 * "this athlete logged nothing" and "we could not read their log" is the one
 * thing on it that must never blur. These check that it does not.
 */

const MARKS = { absent: "—", unreadable: "not read" };

function stats(over: Partial<Record<ReportFigureKey, number | null>> & { unreadable?: string[] }) {
  const { unreadable = [], ...figures } = over;
  return { unreadable: unreadable as ReportSource[], ...figures };
}

describe("report figures", () => {
  it("names a real source for every figure it can print", () => {
    // A typo here would silently make a figure permanently readable: the
    // unreadable list would never contain the name it is checked against.
    for (const source of Object.values(FIGURE_SOURCES)) {
      expect(REPORT_SOURCES).toContain(source);
    }
  });

  it("reports a measured figure with its value", () => {
    expect(reportFigure(stats({ sessions: 12 }), "sessions")).toEqual({
      state: "measured",
      value: 12,
    });
  });

  it("keeps a real zero, because a month with no sessions is a finding", () => {
    // The whole point of the distinction cuts both ways. A successful read
    // that returns nothing is the athlete's month, and softening it to "—"
    // would hide the single most actionable thing on the page.
    expect(reportFigure(stats({ sessions: 0 }), "sessions")).toEqual({
      state: "measured",
      value: 0,
    });
    expect(reportFigure(stats({ totalVolumeKg: 0 }), "totalVolumeKg")).toEqual({
      state: "measured",
      value: 0,
    });
  });

  it("reports an average with nothing to average as absent", () => {
    expect(reportFigure(stats({ avgReadiness: null }), "avgReadiness")).toEqual({
      state: "absent",
    });
    expect(reportFigure(stats({}), "avgSleepHours")).toEqual({ state: "absent" });
  });

  it("never reports a figure whose source could not be read", () => {
    // The failure this file exists for: the query fails, the count stays at
    // its zero initial value, and the document says the athlete did not train.
    const failed = stats({ unreadable: ["training sessions"], sessions: 0, trainingMinutes: 0 });
    expect(reportFigure(failed, "sessions")).toEqual({
      state: "unreadable",
      source: "training sessions",
    });
    expect(reportFigure(failed, "trainingMinutes")).toEqual({
      state: "unreadable",
      source: "training sessions",
    });
  });

  it("only withholds the figures that failed read covers", () => {
    // Sets and sessions are two different reads, and one failing is not the
    // other failing. Blanking the whole page for one bad query would throw
    // away evidence the physician does have.
    const failed = stats({ unreadable: ["logged sets"], sessions: 9, totalVolumeKg: 0 });
    expect(reportFigure(failed, "sessions")).toEqual({ state: "measured", value: 9 });
    expect(reportFigure(failed, "totalVolumeKg")).toEqual({
      state: "unreadable",
      source: "logged sets",
    });
  });

  it("does not print a value that is not a number", () => {
    expect(reportFigure(stats({ avgKcal: Number.NaN }), "avgKcal")).toEqual({ state: "absent" });
    expect(
      reportFigure(stats({ weightDeltaKg: Number.POSITIVE_INFINITY }), "weightDeltaKg"),
    ).toEqual({ state: "absent" });
  });

  describe("formatting", () => {
    it("renders a measured figure and nothing else", () => {
      const figure = reportFigure(stats({ avgProtein: 148 }), "avgProtein");
      expect(formatReportFigure(figure, (value) => `${value} g`, MARKS)).toBe("148 g");
    });

    it("marks absent and unreadable differently", () => {
      // An em dash reads as "nothing here", and nothing here is not what a
      // failed query means. If these two ever printed the same mark, the
      // distinction the rest of this file protects would be invisible.
      const absent = formatReportFigure(reportFigure(stats({}), "avgKcal"), String, MARKS);
      const unread = formatReportFigure(
        reportFigure(stats({ unreadable: ["nutrition log"] }), "avgKcal"),
        String,
        MARKS,
      );
      expect(absent).toBe("—");
      expect(unread).toBe("not read");
      expect(absent).not.toBe(unread);
    });
  });

  describe("the list of what could not be read", () => {
    it("keeps the report's own order and drops anything it does not know", () => {
      const listed = unreadableSources(
        stats({ unreadable: ["profile", "nutrition log", "invented source"] }),
        REPORT_SOURCES,
      );
      expect(listed).toEqual(["nutrition log", "profile"]);
    });

    it("is empty when every source answered", () => {
      expect(unreadableSources(stats({}), REPORT_SOURCES)).toEqual([]);
    });
  });
});
