"""Prepare a narrowly scoped candidate from abe7300 for exact-source acceptance.
This helper lives only on the diagnostics branch; it is not part of the application PR.
"""
from pathlib import Path


def replace_once(text, old, new):
    assert text.count(old) == 1, (old[:100], text.count(old))
    return text.replace(old, new, 1)


def write(name, text):
    p = Path(name)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text)


# Share the existing copy without importing the legacy view into the live route.
p = Path('src/components/LabView.tsx')
s = p.read_text()
a = s.index('type Copy = {')
b = s.index('\nfunction statusTone(', a)
copy = s[a:b]
copy = replace_once(copy, 'type Copy = {', 'export type LabCopy = {')
copy = replace_once(copy, 'export type { Copy as LabCopy };\n', '')
copy = replace_once(copy, 'function copyFor(lang: Lang): Copy {', 'export function labCopyFor(lang: Lang): LabCopy {')
header = '''import { baseLang, type Lang } from "@/lib/i18n";
import type { LabDecision, LabUnreadableSource } from "@/lib/lab.schema";
import type { AthleteHypothesisStatusSchema, AthleteLearningDomainSchema } from "@/lib/athlete-hypothesis.schema";
import type { z } from "zod";

type HypothesisStatus = z.infer<typeof AthleteHypothesisStatusSchema>;
type LearningDomain = z.infer<typeof AthleteLearningDomainSchema>;

'''
write('src/components/lab/lab-view.copy.ts', header + copy)
s = s[:a] + s[b:]
s = replace_once(s, 'import { baseLang, useI18n, type Lang } from "@/lib/i18n";', 'import { baseLang, useI18n } from "@/lib/i18n";\nimport { labCopyFor as copyFor, type LabCopy as Copy } from "@/components/lab/lab-view.copy";\nexport type { LabCopy } from "@/components/lab/lab-view.copy";')
s = replace_once(s, 'import { useAuth } from "@/lib/auth";\n', '')
s = replace_once(s, 'import { useLabOverview } from "@/components/future-lab/lab-overview.query";', 'import { useLabReadRecovery } from "@/components/lab/useLabReadRecovery";')
s = replace_once(s, '  AthleteLearningDomainSchema,\n', '')
s = replace_once(s, 'type LearningDomain = z.infer<typeof AthleteLearningDomainSchema>;\n', '')
s = replace_once(s, 'import type { LabDecision, LabOverview, LabUnreadableSource } from "@/lib/lab.schema";', 'import type { LabOverview } from "@/lib/lab.schema";')
a = s.index('  const { user } = useAuth();', s.index('export function LabView()'))
b = s.index('\n\n  if (!data)', a)
s = s[:a] + '''  const copy = copyFor(lang);
  const { data, isLoading, isError, isFetching, retry } = useLabReadRecovery();''' + s[b:]
s = replace_once(s, 'onRetry={user && !isLoading ? retry : undefined}', 'onRetry={retry}')
s = replace_once(s, 'onRetry={user ? retry : undefined}', 'onRetry={retry}')
s = replace_once(s, '          aria-label={copy.decisionHistory}', '          data-lab-history-toggle\n          aria-label={copy.decisionHistory}')
p.write_text(s)
p = Path('src/components/lab/LabDecisionHistory.tsx')
p.write_text(replace_once(p.read_text(), 'from "@/components/LabView"', 'from "./lab-view.copy"'))

# One authenticated retry/state policy for both presentation surfaces.
write('src/components/lab/useLabReadRecovery.ts', '''import { useAuth } from "@/lib/auth";
import { useLabOverview } from "@/components/future-lab/lab-overview.query";
import type { LabReadMode } from "./lab-read.copy";

/** Preserve the existing owner/timezone key and distinguish stale data from no data. */
export function useLabReadRecovery() {
  const { user } = useAuth();
  const query = useLabOverview();
  const readMode: LabReadMode | null = !query.data
    ? query.isLoading ? "loading" : "unavailable"
    : query.isError ? "stale"
    : query.data.unreadable.length > 0 ? "partial"
    : query.isFetching ? "refreshing"
    : null;
  const retry = user ? () => {
    if (query.isFetching) return;
    void query.refetch({ cancelRefetch: false, throwOnError: false }).catch(() => {
      console.warn("[Lab] REFRESH_UNAVAILABLE");
    });
  } : undefined;
  return { ...query, readMode, retry };
}
''')
p = Path('src/components/lab/lab-read.copy.ts')
s = replace_once(p.read_text(), 'type LabReadCopy = {', 'type LabReadCopy = {\n  label: Record<LabReadMode, string>;')
s = replace_once(s, '    return {\n      title: {', '''    return {
      label: {
        loading: "Kraunama…",
        unavailable: "Nepasiekiama",
        partial: "Daliniai duomenys",
        stale: "Ankstesni duomenys",
        refreshing: "Atnaujinama…",
      },
      title: {''')
s = replace_once(s, '  return {\n    title: {', '''  return {
    label: {
      loading: "Loading…",
      unavailable: "Unavailable",
      partial: "Partial data",
      stale: "Previous data",
      refreshing: "Refreshing…",
    },
    title: {''')
p.write_text(s)

# This is the component actually rendered by src/routes/_authenticated/lab.tsx.
p = Path('src/components/future-lab/LabCommandDeck.tsx')
s = p.read_text()
s = 'import { useId } from "react";\n' + s
s = replace_once(s, 'import { useLabOverview } from "./lab-overview.query";', '''import { useLabReadRecovery } from "@/components/lab/useLabReadRecovery";
import { LabReadNotice } from "@/components/lab/LabReadNotice";
import { LabDecisionHistory } from "@/components/lab/LabDecisionHistory";
import { labCopyFor } from "@/components/lab/lab-view.copy";
import { labReadCopyFor } from "@/components/lab/lab-read.copy";''')
s = replace_once(s, '  const query = useLabOverview();', '  const query = useLabReadRecovery();\n  const historyId = useId();')
s = replace_once(s, '  const data = query.isError ? undefined : query.data;', '  const data = query.data;\n  const historyCopy = labCopyFor(lang);\n  const readCopy = labReadCopyFor(locale);')
s = replace_once(s, '''  const investigationState = query.isError
    ? "unavailable"
    : !data
      ? "loading"
      : (primary?.status ?? "idle");''', '''  const investigationState = !data
    ? query.readMode === "loading" ? "loading" : "unavailable"
    : (primary?.status ?? "idle");''')
s = replace_once(s, '      data-investigation-state={investigationState}', '      data-lab-command-deck\n      data-lab-overview={data ? true : undefined}\n      data-investigation-state={investigationState}')
s = replace_once(s, '''        <span className="rounded-full border border-border px-2.5 py-1.5 text-[9px] text-muted-foreground">
          {query.isError
            ? english
              ? "Unavailable"
              : "Nepasiekiama"
            : data
              ? english
                ? "Evidence loaded"
                : "Duomenys įkelti"
              : t("common.loading")}
        </span>''', '''        <span className="rounded-full border border-border px-2.5 py-1.5 text-[9px] text-muted-foreground" data-lab-read-label>
          {query.readMode
            ? readCopy.label[query.readMode]
            : english ? "Evidence loaded" : "Duomenys įkelti"}
        </span>''')
s = replace_once(s, '      </header>\n', '''      </header>
      {query.readMode ? (
        <div className="mt-3">
          <LabReadNotice
            mode={query.readMode}
            language={locale}
            sources={data?.unreadable ?? []}
            onRetry={query.retry}
            retrying={query.isFetching}
          />
        </div>
      ) : null}
''')
s = replace_once(s, '          {query.isError ? (', '          {!data && query.readMode !== "loading" ? (')
s = replace_once(s, '{nextEvidence?.hypothesisId === primary.id ? (', '{!query.isError && nextEvidence?.hypothesisId === primary.id ? (')
s = replace_once(s, 'status={query.isError ? "error" : data ? "ready" : "loading"}', 'status={data ? "ready" : query.readMode === "loading" ? "loading" : "error"}')
s = replace_once(s, '''                      : query.isError
                        ? unknown
                        : t("common.loading")}''', '''                      : query.readMode === "loading"
                        ? t("common.loading")
                        : unknown}''')
s = replace_once(s, '    </section>\n', '''      {data ? (
        <details className="fl-secondary-details mt-3" data-lab-command-history>
          <summary
            data-lab-history-toggle
            aria-label={historyCopy.decisionHistory}
            aria-describedby={`${historyId}-description`}
            aria-controls={historyId}
          >
            {historyCopy.decisionHistory}
          </summary>
          <div className="fl-disclosed-content" id={historyId}>
            <p id={`${historyId}-description`} className="mb-3 text-xs leading-relaxed text-muted-foreground">
              {historyCopy.accuracyNote}
            </p>
            <LabDecisionHistory data={data} copy={historyCopy} language={locale} />
          </div>
        </details>
      ) : null}
    </section>
''')
p.write_text(s)

# Run the same recovery matrix against the legacy overview and the active route component.
p = Path('tests/lab-browser/fixture.tsx')
s = replace_once(p.read_text(), 'import { LabView } from "@/components/LabView";', 'import { LabView } from "@/components/LabView";\nimport { LabCommandDeck } from "@/components/future-lab/LabCommandDeck";')
s = replace_once(s, '<LabView />', '{query.get("view") === "deck" ? <LabCommandDeck /> : <LabView />}')
p.write_text(s)
p = Path('tests/lab-browser/services.ts')
s = p.read_text() + '''
// Independent live-route panels use synthetic read boundaries. Writes are forbidden.
export async function forecastProgress() { return null; }
export async function listPersonalExperimentHistory() { return { experiments: [], outcomes: [] }; }
export async function transitionPersonalExperiment(): Promise<never> {
  throw new Error("Unexpected experiment mutation in read-only Lab acceptance");
}
export async function addPersonalExperimentOutcome(): Promise<never> {
  throw new Error("Unexpected experiment mutation in read-only Lab acceptance");
}
'''
p.write_text(s)
p = Path('scripts/test-lab-availability-browser.mjs')
s = p.read_text()
s = replace_once(s, '      { find: "@", replacement: path.join(root, "src") },', '''      { find: "@/lib/forecast.functions", replacement: path.join(root, "tests/lab-browser/services.ts") },
      { find: "@/lib/personal-experiment.functions", replacement: path.join(root, "tests/lab-browser/services.ts") },
      { find: "@", replacement: path.join(root, "src") },''')
s = replace_once(s, '  const open = async (query, width = 390) => {', '  let activeView = "overview";\n  const record = (result) => results.push({ surface: activeView, ...result });\n  const open = async (query, width = 390) => {')
s = replace_once(s, 'await page.goto(`${origin}/index.html?${query}`);', 'await page.goto(`${origin}/index.html?view=${activeView}&${query}`);')
s = replace_once(s, '    return { context, page };', '''    if (activeView === "deck") await expect(page.locator("[data-lab-command-deck]")).toBeVisible();
    return { context, page };''')
s = replace_once(s, '  for (const lang of ["lt", "en", "de"]) {', '  for (const view of ["overview", "deck"]) {\n    activeView = view;\n  for (const lang of ["lt", "en", "de"]) {')
s = replace_once(s, '`${engine}-${lang}-${theme}-${width}`', '`${engine}-${activeView}-${lang}-${theme}-${width}`')
s = replace_once(s, 'await expect(page.locator("[data-lab-history]")).toHaveCount(0);', 'await expect(page.locator("[data-lab-history]")).toBeHidden();')
s = replace_once(s, 'await page.getByRole("button", { name: historyName(lt), exact: true }).click();', '''await expect(page.locator("[data-lab-history-toggle]")).toHaveAccessibleName(historyName(lt));
          await page.locator("[data-lab-history-toggle]").click();''')
s = replace_once(s, 'await page.getByRole("button", { name: historyName(false), exact: true }).click();', 'await page.locator("[data-lab-history-toggle]").click();')
assert s.count('results.push({') == 5
s = s.replace('results.push({\n', 'record({\n')
s = replace_once(s, 'results.push({ name: "initial failure to successful explicit retry", status: "passed" });', 'record({ name: "initial failure to successful explicit retry", status: "passed" });')
s = replace_once(s, '  assert.equal(results.length, 15);', '  }\n  assert.equal(results.length, 30);')
s = replace_once(s, 'expectedGroups: 15,', 'expectedGroups: 30,')
p.write_text(s)

# Rendered unit coverage includes the actual route component, not only the old view.
p = Path('src/components/lab/lab-availability.test.tsx')
s = p.read_text()
s = 'import { LabCommandDeck } from "@/components/future-lab/LabCommandDeck";\n' + s
s = replace_once(s, 'useI18n: () => ({ lang: mocks.language })', 'useI18n: () => ({ lang: mocks.language, t: (key: string) => key })')
s += '''
vi.mock("@/components/future-lab/forecast.query", () => ({ useStrengthForecast: () => ({ data: null, isError: false }) }));
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
      mocks.query.mockReturnValue({ data: makeLabData(), isLoading: false, isError: true, isFetching: false, refetch: mocks.refetch });
      const html = renderToStaticMarkup(<LabCommandDeck />);
      expect(html).toContain('data-lab-read-state="stale"');
      expect(html).toContain(labReadCopyFor(baseLang(language)).label.stale);
      expect(html).toContain("data-lab-overview");
      expect(html.match(/\\sdata-lab-decision=/g)).toHaveLength(4);
      expect(html).not.toContain("Evidence loaded");
      expect(html).not.toContain("Duomenys įkelti");
    });
  }
  it.each(combinations.map(unreadable => ({ unreadable })))("keeps each source-failure combination truthful in the live deck: $unreadable", ({ unreadable }) => {
    const html = renderToStaticMarkup(<LabCommandDeck />);
    expect(html).toContain('data-lab-read-state="unavailable"');
    mocks.query.mockReturnValue({ data: makeLabData(unreadable), isLoading: false, isError: false, isFetching: false, refetch: mocks.refetch });
    const loaded = renderToStaticMarkup(<LabCommandDeck />);
    expect(loaded.includes('data-lab-read-state="partial"')).toBe(unreadable.length > 0);
    expect(loaded.includes("data-lab-fit-rate")).toBe(!unreadable.includes("decisions") && !unreadable.includes("decision_outcomes"));
    for (const source of unreadable) expect(loaded).toContain(labReadCopyFor("en").source[source]);
    expect(loaded.match(/<details[^>]*data-lab-command-history[^>]*>/)?.[0]).not.toContain(" open");
  });
  it("exposes loading without an enabled retry or prior-owner records", () => {
    mocks.query.mockReturnValue({ data: undefined, isLoading: true, isError: false, isFetching: true, refetch: mocks.refetch });
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
    mocks.query.mockReturnValue({ data: makeLabData(), isLoading: false, isError: false, isFetching: true, refetch: mocks.refetch });
    const html = renderToStaticMarkup(<LabCommandDeck />);
    expect(html).toContain('data-lab-read-state="refreshing"');
    expect(html).toContain(labReadCopyFor("en").label.refreshing);
    expect(html.match(/\\sdata-lab-decision=/g)).toHaveLength(4);
  });
});
'''
p.write_text(s)

# The permanent browser workflow must follow the live route and all shared inputs.
p = Path('.github/workflows/lab-availability-browser.yml')
s = p.read_text()
old = '      - "src/components/future-lab/lab-overview.query.ts"'
assert s.count(old) == 2
s = s.replace(old, '''      - "src/components/future-lab/**"
      - "src/components/intelligence/**"
      - "src/routes/_authenticated/lab.tsx"
      - "src/lib/i18n*"
      - "src/lib/theme.tsx"
      - "src/lib/evidence-acquisition.ts"
      - "src/lib/prediction-calibration*"
      - ".github/playwright-image.json"
      - "scripts/verify-ci-browser-runtime.mjs"''')
p.write_text(s)

p = Path('docs/lab-read-state-recovery.md')
p.write_text(p.read_text() + '''

## Active route integration

`src/routes/_authenticated/lab.tsx` renders `LabCommandDeck`, not `LabView`.
The first candidate's 45 rendered unit cases and 15 browser groups per engine
covered the legacy overview only. They did not prove the active route had recovery.
This increment corrects that reachability gap rather than replacing the live route
with the old layout.

The live deck and legacy overview now share the authenticated retry/state hook and
copy definitions. The live deck preserves cached data after a failed refresh,
labels partial/stale/refreshing states instead of saying all evidence was loaded,
and exposes the same truthful decision journal in a closed-by-default disclosure.
A failed refresh does not propose a fresh evidence-acquisition action. Independent
experiment and forecast panels retain their own query boundaries.

The browser suite now runs the same 15 groups on each surface in each engine
(30 groups per engine). Real components and query hooks are used; only service
boundaries return synthetic data. This is not live-account, live-DB or physical
mobile-device acceptance. Main, release markers, dependencies and user data are
not changed by preparing this candidate.
''')
print('Prepared the active Lab route candidate; no commit or branch has been changed by this script.')
