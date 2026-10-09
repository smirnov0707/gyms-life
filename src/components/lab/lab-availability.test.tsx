import { LabCommandDeck } from "@/components/future-lab/LabCommandDeck";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { baseLang } from "@/lib/i18n";
import { LabView, LabOverviewView, labCopyFor } from "@/components/LabView";
import { LabDecisionHistory } from "./LabDecisionHistory";
import { LabReadNotice } from "./LabReadNotice";
import { labReadCopyFor } from "./lab-read.copy";
import { LabOverviewSchema, type LabDecision, type LabUnreadableSource } from "@/lib/lab.schema";
import { buildDecisionAccuracy } from "@/lib/decision-accuracy.engine";

/** Synthetic fixtures only. No user identity, actual workout or live service data. */
function makeLabData(unreadable: LabUnreadableSource[] = [], empty = false) {
  const decisions: LabDecision[] = empty
    ? []
    : Array.from({ length: 4 }, (_, index) => ({
        id: `20000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
        decisionOn: "2026-10-01",
        action: "train_as_planned",
        basis: "current_checkin",
        status: index < 3 ? "completed" : "active",
        evidence: [],
        outcome: index < 3 ? "completed" : null,
        createdAt: "2026-10-01T09:00:00.000Z",
      }));
  return LabOverviewSchema.parse({
    hypotheses: [],
    hypothesisHistory: [],
    decisions,
    decisionAccuracy: buildDecisionAccuracy(decisions),
    predictionCalibration: {
      target: "workout_completion",
      maturity: "shadow",
      totalCaptured: 0,
      totalEvaluated: 0,
      totalPending: 0,
      minimumEvaluated: 8,
      models: [],
    },
    proactiveMemoryChanges: [],
    dataGaps: [],
    unreadable,
  });
}

const mocks = vi.hoisted(() => ({
  language: "en",
  signedIn: true,
  query: vi.fn(),
  refetch: vi.fn(async () => undefined),
}));
vi.mock("@/components/future-lab/lab-overview.query", () => ({ useLabOverview: mocks.query }));
vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ user: mocks.signedIn ? { id: "synthetic-owner" } : null }),
}));
vi.mock("@/lib/i18n", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/i18n")>();
  return { ...actual, useI18n: () => ({ lang: mocks.language, t: (key: string) => key }) };
});
const sources: LabUnreadableSource[] = ["decisions", "decision_evidence", "decision_outcomes"];
const combinations = Array.from({ length: 8 }, (_, mask) =>
  sources.filter((_, index) => Boolean(mask & (1 << index))),
);

beforeEach(() => {
  mocks.language = "en";
  mocks.signedIn = true;
  mocks.refetch.mockClear();
  mocks.query.mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: true,
    isFetching: false,
    refetch: mocks.refetch,
  });
});

describe("Lab history distinguishes failed reads from absent records", () => {
  for (const language of ["lt", "en"] as const) {
    it.each(combinations.map((unreadable) => ({ unreadable })))(
      `${language}: preserves readable records and withholds unsafe rates: $unreadable`,
      ({ unreadable }) => {
        const data = makeLabData(unreadable);
        const before = JSON.stringify(data);
        const copy = labCopyFor(language),
          read = labReadCopyFor(language);
        const html = renderToStaticMarkup(
          <LabDecisionHistory data={data} copy={copy} language={language} />,
        );
        expect(html.match(/\sdata-lab-decision=/g)).toHaveLength(4);
        expect(html).toContain(copy.outcomeLabel.completed);
        expect(html).toContain(
          unreadable.includes("decision_outcomes") ? read.outcomeUnavailable : copy.noOutcome,
        );
        if (unreadable.includes("decision_outcomes")) expect(html).not.toContain(copy.noOutcome);
        const incomplete =
          unreadable.includes("decisions") || unreadable.includes("decision_outcomes");
        expect(html.includes("data-lab-fit-rate")).toBe(!incomplete);
        expect(html.includes("data-lab-fit-unavailable")).toBe(incomplete);
        if (incomplete) {
          expect(html).not.toContain("100%");
          expect(html).not.toContain(copy.answeredOf(3, 4));
        }
        expect(JSON.stringify(data)).toBe(before);
      },
    );
    it.each(combinations.map((unreadable) => ({ unreadable })))(
      `${language}: only a readable empty history may say empty: $unreadable`,
      ({ unreadable }) => {
        const copy = labCopyFor(language),
          read = labReadCopyFor(language);
        const html = renderToStaticMarkup(
          <LabDecisionHistory
            data={makeLabData(unreadable, true)}
            copy={copy}
            language={language}
          />,
        );
        expect(html.includes(copy.decisionsEmpty)).toBe(!unreadable.includes("decisions"));
        if (unreadable.includes("decisions")) expect(html).toContain(read.decisionsUnavailable);
        expect(html).not.toContain("data-lab-fit-rate");
      },
    );
  }
  it("does not replace genuinely insufficient answered evidence with a zero rate", () => {
    const data = makeLabData();
    for (const entry of data.decisionAccuracy.byBasis) entry.fitRate = null;
    const copy = labCopyFor("en");
    const html = renderToStaticMarkup(<LabDecisionHistory data={data} copy={copy} language="en" />);
    expect(html).toContain(copy.accuracyPending(data.decisionAccuracy.minimumAnswered));
    expect(html).not.toContain("data-lab-fit-rate");
  });
});

describe("Lab availability and recovery surfaces", () => {
  it.each(["lt", "en", "de"] as const)("shows loading, not empty or success, in %s", (language) => {
    mocks.language = language;
    mocks.query.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      isFetching: true,
      refetch: mocks.refetch,
    });
    const html = renderToStaticMarkup(<LabView />);
    expect(html).toContain('data-lab-read-state="loading"');
    expect(html).toContain(labReadCopyFor(baseLang(language)).title.loading);
    expect(html).not.toContain(labCopyFor(language).hypothesesEmpty);
    expect(html).not.toContain("<button");
    expect(mocks.refetch).not.toHaveBeenCalled();
  });
  it.each(["lt", "en", "de"] as const)(
    "offers an explicit unavailable-state retry in %s",
    (language) => {
      mocks.language = language;
      const html = renderToStaticMarkup(<LabView />);
      expect(html).toContain('data-lab-read-state="unavailable"');
      expect(html).toContain(labReadCopyFor(baseLang(language)).retry);
      expect(html).not.toContain("data-lab-overview");
      expect(mocks.refetch).not.toHaveBeenCalled();
    },
  );
  it("never offers a manual read to a signed-out visitor", () => {
    mocks.signedIn = false;
    const html = renderToStaticMarkup(<LabView />);
    expect(html).not.toContain("<button");
    expect(mocks.refetch).not.toHaveBeenCalled();
  });
  it("preserves cached data with an explicit failed-refresh warning", () => {
    mocks.query.mockReturnValue({
      data: makeLabData(),
      isLoading: false,
      isError: true,
      isFetching: false,
      refetch: mocks.refetch,
    });
    const html = renderToStaticMarkup(<LabView />);
    expect(html).toContain('data-lab-read-state="stale"');
    expect(html).toContain("data-lab-overview");
    expect(html).toContain(labCopyFor("en").title);
  });
  it("names partial sources even when history is collapsed", () => {
    const html = renderToStaticMarkup(
      <LabOverviewView
        data={makeLabData(["decision_evidence", "decision_outcomes"])}
        copy={labCopyFor("en")}
      />,
    );
    expect(html).toContain('data-lab-read-state="partial"');
    expect(html).toContain(labReadCopyFor("en").source.decision_outcomes);
    expect(html).not.toMatch(/\sdata-lab-history=/);
  });
  it("keeps a single, more important stale notice when cached history is also partial", () => {
    const html = renderToStaticMarkup(
      <LabOverviewView
        data={makeLabData(["decisions"])}
        copy={labCopyFor("en")}
        refreshFailed
        refreshing
      />,
    );
    expect(html.match(/data-lab-read-state=/g)).toHaveLength(1);
    expect(html).toContain('data-lab-read-state="stale"');
    expect(html).toContain(labReadCopyFor("en").source.decisions);
  });
  it("disables a retry while preserving the actual failure explanation", () => {
    const html = renderToStaticMarkup(
      <LabReadNotice
        mode="partial"
        language="en"
        sources={["decisions"]}
        onRetry={() => undefined}
        retrying
      />,
    );
    expect(html).toContain("disabled");
    expect(html).toContain(labReadCopyFor("en").retrying);
    expect(html).toContain(labReadCopyFor("en").description.partial);
  });
  it("renders no permanent success or invented progress on a readable snapshot", () => {
    const html = renderToStaticMarkup(
      <LabOverviewView data={makeLabData()} copy={labCopyFor("en")} />,
    );
    expect(html).not.toContain("data-lab-read-state");
  });
});

vi.mock("@/components/future-lab/forecast.query", () => ({
  useStrengthForecast: () => ({ data: null, isError: false }),
}));
vi.mock("@/components/future-lab/ExperimentLedger", () => ({ ExperimentLedger: () => null }));

describe("the actual Lab route command deck", () => {
  for (const language of ["lt", "en", "de"] as const) {
    it(`${language}: distinguishes unavailable data from an empty investigation`, () => {
      mocks.language = language;
      const html = renderToStaticMarkup(<LabCommandDeck />);
      expect(html).toContain('data-lab-read-state="unavailable"');
      expect(html).toContain(labReadCopyFor(baseLang(language)).retry);
      expect(html).not.toContain("data-lab-overview");
      expect(html).not.toContain(labCopyFor(language).decisionsEmpty);
    });
    it(`${language}: does not discard the cached snapshot after refresh failure`, () => {
      mocks.language = language;
      mocks.query.mockReturnValue({
        data: makeLabData(),
        isLoading: false,
        isError: true,
        isFetching: false,
        refetch: mocks.refetch,
      });
      const html = renderToStaticMarkup(<LabCommandDeck />);
      expect(html).toContain('data-lab-read-state="stale"');
      expect(html).toContain(labReadCopyFor(baseLang(language)).label.stale);
      expect(html).toContain("data-lab-overview");
      expect(html.match(/\sdata-lab-decision=/g)).toHaveLength(4);
      expect(html).not.toContain("Evidence loaded");
      expect(html).not.toContain("Duomenys įkelti");
    });
  }
  it.each(combinations.map((unreadable) => ({ unreadable })))(
    "keeps each source-failure combination truthful in the live deck: $unreadable",
    ({ unreadable }) => {
      const html = renderToStaticMarkup(<LabCommandDeck />);
      expect(html).toContain('data-lab-read-state="unavailable"');
      mocks.query.mockReturnValue({
        data: makeLabData(unreadable),
        isLoading: false,
        isError: false,
        isFetching: false,
        refetch: mocks.refetch,
      });
      const loaded = renderToStaticMarkup(<LabCommandDeck />);
      expect(loaded.includes('data-lab-read-state="partial"')).toBe(unreadable.length > 0);
      expect(loaded.includes("data-lab-fit-rate")).toBe(
        !unreadable.includes("decisions") && !unreadable.includes("decision_outcomes"),
      );
      for (const source of unreadable)
        expect(loaded).toContain(labReadCopyFor("en").source[source]);
      expect(loaded.match(/<details[^>]*data-lab-command-history[^>]*>/)?.[0]).not.toContain(
        " open",
      );
    },
  );
  it("exposes loading without an enabled retry or prior-owner records", () => {
    mocks.query.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      isFetching: true,
      refetch: mocks.refetch,
    });
    const html = renderToStaticMarkup(<LabCommandDeck />);
    expect(html).toContain('data-lab-read-state="loading"');
    expect(html).not.toContain("data-lab-overview");
    expect(html).not.toContain(labReadCopyFor("en").retry);
  });
  it("never offers a manual read after sign-out", () => {
    mocks.signedIn = false;
    const html = renderToStaticMarkup(<LabCommandDeck />);
    expect(html).not.toContain(labReadCopyFor("en").retry);
    expect(mocks.refetch).not.toHaveBeenCalled();
  });
  it("labels a background refresh without hiding its cached rows", () => {
    mocks.query.mockReturnValue({
      data: makeLabData(),
      isLoading: false,
      isError: false,
      isFetching: true,
      refetch: mocks.refetch,
    });
    const html = renderToStaticMarkup(<LabCommandDeck />);
    expect(html).toContain('data-lab-read-state="refreshing"');
    expect(html).toContain(labReadCopyFor("en").label.refreshing);
    expect(html.match(/\sdata-lab-decision=/g)).toHaveLength(4);
  });
});
