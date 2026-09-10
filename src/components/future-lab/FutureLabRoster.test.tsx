import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { LabRosterRows } from "./FutureLabRoster";

vi.mock("./lab-overview.query", () => ({ useLabOverview: vi.fn() }));
vi.mock("@/lib/i18n", () => ({
  baseLang: () => "en",
  useI18n: () => ({ lang: "en", t: (key: string) => key }),
}));

describe("Lab evidence roster", () => {
  it("does not show available sources from stale data after a failed refresh", () => {
    const html = renderToStaticMarkup(
      <LabRosterRows status="error" data={{ dataGaps: [], hypotheses: [] }} />,
    );
    expect(html.match(/Unknown/g)).toHaveLength(10);
    expect(html).not.toContain("Source available");
    expect(html).not.toContain("Rules defined");
  });

  it("keeps a loading roster unknown rather than claiming every scientist is online", () => {
    const html = renderToStaticMarkup(<LabRosterRows status="loading" data={undefined} />);
    expect(html.match(/Unknown/g)).toHaveLength(10);
    expect(html).not.toContain("Source available");
  });

  it("shows absent evidence as waiting while static rules keep their own label", () => {
    const html = renderToStaticMarkup(
      <LabRosterRows
        status="ready"
        data={{
          dataGaps: [
            "no_completed_workouts_28d",
            "no_recovery_checkins_7d",
            "no_nutrition_logs_14d",
          ],
          hypotheses: [],
        }}
      />,
    );
    expect(html.match(/Awaiting evidence/g)).toHaveLength(7);
    expect(html.match(/Rules defined/g)).toHaveLength(3);
    expect(html).not.toContain("Source available");
  });

  it.each(["personalization_consent_required", "personalization_consent_unavailable"] as const)(
    "does not claim evidence is available when %s",
    (gap) => {
      const html = renderToStaticMarkup(
        <LabRosterRows status="ready" data={{ dataGaps: [gap], hypotheses: [] }} />,
      );
      expect(html.match(/Awaiting evidence/g)).toHaveLength(10);
      expect(html).not.toContain("Source available");
    },
  );
});
