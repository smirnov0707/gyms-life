import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { AthleteHypothesis } from "@/lib/athlete-hypothesis.schema";
import { HypothesisEvidence } from "@/components/future-lab/HypothesisEvidence";

const mocks = vi.hoisted(() => ({ language: "en" }));
vi.mock("@/lib/i18n", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/i18n")>();
  return { ...actual, useI18n: () => ({ lang: mocks.language }) };
});

const evidence = [
  { key: "rated_sessions_28d", value: 12, unit: "sessions", source: "user_reported" },
  { key: "usual_day_completion_rate_28d", value: 0.625, unit: "ratio", source: "calculated" },
  { key: "synthetic_observation", value: 120.5, unit: "count", source: "measured" },
] satisfies AthleteHypothesis["evidence"];

describe("readable hypothesis evidence preserves meaning", () => {
  it.each(["lt", "en", "de"])("keeps sources and numeric formatting in %s", (language) => {
    mocks.language = language;
    const before = JSON.stringify(evidence);
    const html = renderToStaticMarkup(<HypothesisEvidence evidence={evidence} />);
    expect(html.match(/data-lab-evidence-row=/g)).toHaveLength(3);
    for (const label of language === "lt"
      ? ["Paties nurodyta", "Apskaičiuota", "Išmatuota"]
      : ["Self-reported", "Calculated", "Measured"])
      expect(html).toContain(label);
    const ratio = new Intl.NumberFormat(language, {
      style: "percent",
      maximumFractionDigits: 1,
    }).format(0.625);
    expect(html).toContain(ratio);
    expect(html).toContain(new Intl.NumberFormat(language, { maximumFractionDigits: 1 }).format(120.5));
    expect(JSON.stringify(evidence)).toBe(before);
    expect(html.match(/<details[^>]*>/)?.[0]).not.toContain(" open");
  });

  it("does not invent a value or source for an empty evidence array", () => {
    mocks.language = "en";
    const html = renderToStaticMarkup(<HypothesisEvidence evidence={[]} />);
    expect(html).not.toContain("data-lab-evidence-row");
    expect(html).not.toContain("<dd");
  });

  it("labels an unfamiliar metric as an observation rather than guessing its meaning", () => {
    mocks.language = "en";
    const html = renderToStaticMarkup(<HypothesisEvidence evidence={evidence} />);
    expect(html).toContain("Additional observation");
    expect(html).not.toContain("medical certainty");
  });
});
