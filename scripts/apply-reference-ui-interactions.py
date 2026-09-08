"""Apply reviewed source edits to the exact PR55 baseline; no production operations."""
from pathlib import Path
import subprocess
import sys

root = Path(sys.argv[1]).resolve()
expected = "437cc7618ab13bf0d6917f915f37c70b0e5e824f"
if subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=root, text=True).strip() != expected:
    raise RuntimeError("Reference UI head moved; review changes before applying")
changed = []
def add(path, content):
    dest = root / path
    if dest.exists():
        raise RuntimeError(f"Refusing to replace unreviewed file {path}")
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(content.strip() + "\n")
    changed.append(path)
def replace(path, old, new):
    dest = root / path
    source = dest.read_text()
    if source.count(old) != 1:
        raise RuntimeError(f"Expected exactly one reviewed anchor in {path}: {old[:100]}")
    dest.write_text(source.replace(old, new))
    if path not in changed:
        changed.append(path)

add("src/lib/twin-navigation.ts", r'''
import { isAnatomicalRegion } from "@/components/twin/body-map.geometry";

export const TWIN_VIEWS = ["overview", "muscles", "systems"] as const;
export const TWIN_DETAIL_TABS = ["status", "history", "impact"] as const;
export type TwinViewId = (typeof TWIN_VIEWS)[number];
export type TwinDetailTab = (typeof TWIN_DETAIL_TABS)[number];
export type TwinNavigation = {
  view?: TwinViewId;
  region?: string;
  detail?: TwinDetailTab;
};

/** URL state is presentation only. It never writes an athlete measurement. */
export function parseTwinNavigation(search: Record<string, unknown>): TwinNavigation {
  const result: TwinNavigation = {};
  if (TWIN_VIEWS.some((view) => view === search.view)) result.view = search.view as TwinViewId;
  if (typeof search.region === "string" && isAnatomicalRegion(search.region)) {
    result.region = search.region;
    if (TWIN_DETAIL_TABS.some((tab) => tab === search.detail)) {
      result.detail = search.detail as TwinDetailTab;
    }
  }
  return result;
}

export function nextTwinView(active: TwinViewId, key: string): TwinViewId | null {
  if (key === "Home") return TWIN_VIEWS[0];
  if (key === "End") return TWIN_VIEWS[TWIN_VIEWS.length - 1];
  if (key !== "ArrowRight" && key !== "ArrowLeft") return null;
  const direction = key === "ArrowRight" ? 1 : -1;
  return TWIN_VIEWS[(TWIN_VIEWS.indexOf(active) + direction + TWIN_VIEWS.length) % TWIN_VIEWS.length];
}
''')
add("src/lib/twin-navigation.test.ts", r'''
import { describe, expect, it } from "vitest";
import { nextTwinView, parseTwinNavigation } from "./twin-navigation";

describe("Twin reference navigation", () => {
  it("keeps the ordinary route valid without search parameters", () => {
    expect(parseTwinNavigation({})).toEqual({});
  });
  it("round trips each muscle evidence tab", () => {
    for (const detail of ["status", "history", "impact"]) {
      const input = { view: "muscles", region: "chest", detail };
      expect(parseTwinNavigation(input)).toEqual(input);
    }
  });
  it("does not treat unknown or multi-valued inputs as muscle evidence", () => {
    expect(parseTwinNavigation({ view: ["systems"], region: "<script>", detail: "impact" })).toEqual({});
    expect(parseTwinNavigation({ region: ["chest"], detail: "status" })).toEqual({});
  });
  it("drops detached detail tabs and unrelated user data", () => {
    expect(parseTwinNavigation({ view: "systems", detail: "history", recovery: 72 })).toEqual({ view: "systems" });
  });
  it("keeps a recognized region when its detail tab is invalid", () => {
    expect(parseTwinNavigation({ region: "back", detail: "prediction" })).toEqual({ region: "back" });
  });
  it("cycles tabs in both directions", () => {
    expect(nextTwinView("overview", "ArrowLeft")).toBe("systems");
    expect(nextTwinView("systems", "ArrowRight")).toBe("overview");
    expect(nextTwinView("overview", "ArrowRight")).toBe("muscles");
  });
  it("supports Home and End without intercepting unrelated keys", () => {
    expect(nextTwinView("muscles", "Home")).toBe("overview");
    expect(nextTwinView("muscles", "End")).toBe("systems");
    expect(nextTwinView("overview", "Tab")).toBeNull();
  });
});
''')
add("src/lib/live-signal-refresh.ts", r'''
import { LIVE_SIGNAL_IDS, type LiveSignal } from "./live-signals.engine";

export type SignalRefreshOutcome = "refreshed" | "stale" | "empty" | "partial" | "unreadable";

/** A successful HTTP request is not proof that each underlying source answered. */
export function signalRefreshOutcome(signals: readonly LiveSignal[]): SignalRefreshOutcome {
  const known = new Map(signals.map((signal) => [signal.id, signal]));
  if (known.size !== signals.length) return "unreadable";
  const rows = LIVE_SIGNAL_IDS.map((id) => known.get(id));
  const readable = rows.filter((signal) => {
    if (!signal || signal.state === "unreadable") return false;
    return signal.state === "absent" || (signal.value !== null && Number.isFinite(signal.value));
  });
  if (readable.length === 0) return "unreadable";
  if (readable.length !== LIVE_SIGNAL_IDS.length) return "partial";
  if (readable.every((signal) => signal?.state === "absent")) return "empty";
  if (readable.every((signal) => signal?.state === "absent" || signal?.state === "stale")) return "stale";
  return "refreshed";
}
''')
add("src/lib/live-signal-refresh.test.ts", r'''
import { describe, expect, it } from "vitest";
import { LIVE_SIGNAL_IDS, type LiveSignal } from "./live-signals.engine";
import { signalRefreshOutcome } from "./live-signal-refresh";

const empty = (): LiveSignal[] => LIVE_SIGNAL_IDS.map((id) => ({ id, state: "absent", value: null, recordedOn: null, ageDays: null, delta: null, source: null, history: [] }));
describe("manual refresh outcome", () => {
  it("distinguishes an empty readable account from a failed read", () => {
    expect(signalRefreshOutcome(empty())).toBe("empty");
    expect(signalRefreshOutcome([])).toBe("unreadable");
    expect(signalRefreshOutcome(empty().map((row) => ({ ...row, state: "unreadable" })))).toBe("unreadable");
  });
  it("does not call an incomplete response a completed refresh", () => {
    expect(signalRefreshOutcome(empty().slice(1))).toBe("partial");
    expect(signalRefreshOutcome(empty().map((row, i) => i === 0 ? { ...row, state: "unreadable" } : row))).toBe("partial");
  });
  it("preserves a measured zero rather than inventing an empty result", () => {
    expect(signalRefreshOutcome(empty().map((row) => row.id === "steps" ? { ...row, state: "measured", value: 0 } : row))).toBe("refreshed");
  });
  it("identifies old readings instead of implying they are current", () => {
    expect(signalRefreshOutcome(empty().map((row) => row.id === "sleep" ? { ...row, state: "stale", value: 7 } : row))).toBe("stale");
  });
  it("rejects duplicate signal identities", () => {
    const rows = empty();
    expect(signalRefreshOutcome([...rows, rows[0]])).toBe("unreadable");
  });
  it("does not accept invalid measured values as readable", () => {
    expect(signalRefreshOutcome(empty().map((row) => row.id === "sleep" ? { ...row, state: "measured", value: NaN } : row))).toBe("partial");
  });
});
''')

p="src/routes/_authenticated/twin.tsx"
replace(p, 'import { TwinScreen } from "@/components/twin/TwinScreen";', 'import { TwinScreen } from "@/components/twin/TwinScreen";\nimport { parseTwinNavigation } from "@/lib/twin-navigation";')
replace(p, '  component: TwinPage,', '  validateSearch: parseTwinNavigation,\n  component: TwinPage,')
replace(p, '  return <TwinScreen />;', '''  const navigation = Route.useSearch();
  const navigate = Route.useNavigate();
  return <TwinScreen navigation={navigation} onNavigate={(search) => { void navigate({ search, resetScroll: false }); }} />;''')

p="src/components/twin/TwinScreen.tsx"
replace(p, 'import "./TwinScreen.css";', 'import "./TwinScreen.css";\nimport { nextTwinView, type TwinNavigation } from "@/lib/twin-navigation";')
replace(p, '''export function TwinScreen() {
  const { t } = useI18n();
  const [active, setActive] = useState<TabId>("overview");
  const [detailRegion, setDetailRegion] = useState<string | null>(null);''', '''export function TwinScreen({ navigation, onNavigate }: { navigation?: TwinNavigation; onNavigate?: (next: TwinNavigation) => void } = {}) {
  const { t } = useI18n();
  const [localNavigation, setLocalNavigation] = useState<TwinNavigation>({});
  const current = navigation ?? localNavigation;
  const change = onNavigate ?? setLocalNavigation;
  const active = current.view ?? "overview";
  const detailRegion = current.region ?? null;
  const setActive = (view: TabId) => change({ view });
  const setDetailRegion = (region: string | null) => change(region ? { view: active, region, detail: "status" } : { view: active });''')
replace(p, '''    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const index = TABS.findIndex((tab) => tab.id === active);
    const next = TABS[(index + step + TABS.length) % TABS.length]!;
    setActive(next.id);
    tabRefs.current.get(next.id)?.focus();''', '''    const next = nextTwinView(active, event.key);
    if (!next) return;
    event.preventDefault();
    setActive(next);
    tabRefs.current.get(next)?.focus();''')
replace(p, '''        <TwinMuscleDetail
          regionId={detailRegion}''', '''        <TwinMuscleDetail
          key={detailRegion}
          activeTab={current.detail ?? "status"}
          onTabChange={(detail) => change({ ...current, detail })}
          regionId={detailRegion}''')

p="src/components/twin/TwinMuscleDetail.tsx"
replace(p, 'import { useState } from "react";', 'import { useState } from "react";\nimport { Link } from "@tanstack/react-router";\nimport { TWIN_DETAIL_TABS, type TwinDetailTab } from "@/lib/twin-navigation";')
replace(p, 'const TABS = ["status", "history", "impact"] as const;', 'const TABS = TWIN_DETAIL_TABS;')
replace(p, '''  backLabel,
}: {''', '''  backLabel,
  activeTab,
  onTabChange,
}: {''')
replace(p, '''  backLabel?: string;
}) {''', '''  backLabel?: string;
  activeTab?: TwinDetailTab;
  onTabChange?: (tab: TwinDetailTab) => void;
}) {''')
replace(p, '''  const [tab, setTab] = useState<(typeof TABS)[number]>("status");''', '''  const [localTab, setLocalTab] = useState<TwinDetailTab>("status");
  const tab = activeTab ?? localTab;
  const setTab = onTabChange ?? setLocalTab;''')
replace(p, '        snapshot.isError ? (', '        snapshot.isError || snapshot.data?.dataAvailable === false ? (')
replace(p, '''              </dl>
              <details>''', '''                <div><dt>{language === "lt" ? "Augimo signalas" : "Growth signal"}</dt><dd>{language === "lt" ? "Nemodeliuojama" : "Not modelled"}</dd></div>
                <div><dt>{language === "lt" ? "Traumos rizika" : "Injury risk"}</dt><dd>{language === "lt" ? "Nevertinta" : "Not assessed"}</dd></div>
                <div><dt>{language === "lt" ? "Būsimas jėgos pokytis" : "Future strength impact"}</dt><dd>{language === "lt" ? "Nemodeliuojama" : "Not modelled"}</dd></div>
              </dl>
              <p className="twin-detail-note">{language === "lt" ? "Registruotas krūvis nėra išmatuotas raumens augimas ar klinikinis traumos rizikos vertinimas." : "Logged load is not measured muscle growth or a clinical injury-risk assessment."}</p>
              <Link to="/training" className="fl-card-action inline-flex min-h-11 items-center justify-center rounded-lg border border-border px-4 text-sm">{language === "lt" ? "Atidaryti treniruotes" : "Open training"}</Link>
              <details>''')

p="src/components/twin/TwinHome.tsx"
replace(p, '''      <p className="twin-cockpit-source">{copy.unit[layer]}</p>
    </section>''', '''      <p className="twin-cockpit-source">{copy.unit[layer]}</p>
      <Link to="/twin" search={{ view: "muscles" }} className="fl-text-link inline-flex min-h-11 items-center">{language === "lt" ? "Tyrinėti raumenis" : "Explore muscles"} →</Link>
    </section>''')
replace(p, '''                  <span>{layerCopy.band[reading.display.tone]}</span>
                </div>''', '''                  <span>{layerCopy.band[reading.display.tone]}</span>
                  <Link to="/twin" search={{ view: "muscles", region: reading.id, detail: "status" }} className="fl-text-link inline-flex min-h-11 items-center">{language === "lt" ? "Peržiūrėti detales" : "View details"} →</Link>
                </div>''')

p="src/components/DataSourcesStrip.tsx"
replace(p, 'import { PencilLine, Watch } from "lucide-react";', 'import { PencilLine, Watch, RefreshCw } from "lucide-react";\nimport { useRef, useState } from "react";\nimport { signalRefreshOutcome, type SignalRefreshOutcome } from "@/lib/live-signal-refresh";')
replace(p, 'import { useI18n, type TKey } from "@/lib/i18n";', 'import { baseLang, useI18n, type TKey } from "@/lib/i18n";')
replace(p, '''export function DataSourcesStrip() {
  const { t } = useI18n();''', '''export function DataSourcesStrip() {
  const { t, lang } = useI18n();
  const english = baseLang(lang) === "en";
  const lock = useRef(false);
  const [refresh, setRefresh] = useState<{ userId: string; outcome: SignalRefreshOutcome | "refreshing" } | null>(null);''')
replace(p, '  const { data } = useQuery({', '  const query = useQuery({')
replace(p, '''  const signals = data ?? [];
  const newest = newestReading(signals);
  const readable = anythingReadable(signals);''', '''  const signals = query.isError ? [] : query.data ?? [];
  const checking = query.isPending || query.isError;
  const newest = newestReading(signals);
  const readable = anythingReadable(signals);
  const outcome = refresh?.userId === user?.id ? refresh?.outcome : null;
  const messages = english ? {
    refreshing: "Refreshing received records…",
    refreshed: "Received records refreshed.",
    stale: "Records checked. Available readings are still old.",
    empty: "Records checked. No readings have arrived yet.",
    partial: "Only some sources could be read. Refresh is incomplete.",
    unreadable: "Records could not be refreshed. No successful sync is claimed.",
  } : {
    refreshing: "Atnaujinami gauti įrašai…",
    refreshed: "Gauti įrašai atnaujinti.",
    stale: "Įrašai patikrinti. Turimi matavimai vis dar seni.",
    empty: "Įrašai patikrinti. Matavimų dar negauta.",
    partial: "Perskaityta tik dalis šaltinių. Atnaujinimas nepilnas.",
    unreadable: "Įrašų atnaujinti nepavyko. Sinchronizavimas nepatvirtintas.",
  };
  const refreshRecords = async () => {
    if (!user || lock.current) return;
    const userId = user.id;
    lock.current = true;
    setRefresh({ userId, outcome: "refreshing" });
    try {
      const result = await query.refetch({ throwOnError: true });
      setRefresh({ userId, outcome: signalRefreshOutcome(result.data ?? []) });
    } catch {
      setRefresh({ userId, outcome: "unreadable" });
    } finally {
      lock.current = false;
    }
  };''')
replace(p, 'state={sourceState(signals, DEVICE_SIGNALS)}', 'state={checking ? "unknown" : sourceState(signals, DEVICE_SIGNALS)}')
replace(p, 'state={sourceState(signals, MANUAL_SIGNALS)}', 'state={checking ? "unknown" : sourceState(signals, MANUAL_SIGNALS)}')
replace(p, '''      <Link
        to="/me"''', '''      <button type="button" data-testid="refresh-received-data" onClick={() => void refreshRecords()} disabled={!user || query.isFetching || outcome === "refreshing"} title={english ? "Refresh records already received by GYMS.LIFE; this does not request a sync from your watch." : "Atnaujina GYMS.LIFE jau gautus įrašus; neužsako laikrodžio sinchronizavimo."} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 text-[11px] font-semibold text-foreground disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
        <RefreshCw aria-hidden="true" className={`size-3.5 ${outcome === "refreshing" ? "animate-spin motion-reduce:animate-none" : ""}`} />{english ? "Refresh data" : "Atnaujinti duomenis"}
      </button>
      <Link
        to="/me"''')
replace(p, '''        {t("hs.connect")}
      </Link>
    </section>''', '''        {t("hs.connect")}
      </Link>
      {outcome ? <p role="status" data-testid="received-data-refresh-status" className="w-full text-[11px] text-muted-foreground">{messages[outcome]}</p> : null}
    </section>''')

# The isolated router must exercise the same search-state transitions. It is
# not production code and never grants authenticated access to a real account.
p="tests/today-browser/router-stub.tsx"
replace(p, 'export function fixtureHref(to: string, params: Record<string, unknown> = {}) {', 'export function fixtureHref(to: string, params: Record<string, unknown> = {}, search?: Record<string, unknown>) {')
replace(p, '''  query.set("route", resolved);
  return `/index.html?${query}`;''', '''  query.set("route", resolved);
  for (const key of ["view", "region", "detail"]) query.delete(key);
  for (const [key, value] of Object.entries(search ?? {})) if (value !== undefined) query.set(key, String(value));
  return `/index.html?${query}`;''')
replace(p, '''  params?: Record<string, unknown>;
  children?: ReactNode;''', '''  params?: Record<string, unknown>;
  search?: Record<string, unknown>;
  children?: ReactNode;''')
replace(p, 'export function Link({ to = "/app", params, children, ...rest }: LinkProps)', 'export function Link({ to = "/app", params, search, children, ...rest }: LinkProps)')
replace(p, 'href={fixtureHref(to, params)}', 'href={fixtureHref(to, params, search)}')
replace(p, 'const navigate = (options: { to?: string; params?: Record<string, unknown> } | string) => {', 'const navigate = (options: { to?: string; params?: Record<string, unknown>; search?: Record<string, unknown> } | string) => {')
replace(p, 'const target = typeof options === "string" ? options : (options.to ?? "/app");', 'const target = typeof options === "string" ? options : (options.to ?? useLocation().pathname);')
replace(p, 'fixtureHref(target, typeof options === "string" ? undefined : options.params),', 'fixtureHref(target, typeof options === "string" ? undefined : options.params, typeof options === "string" ? undefined : options.search),')
replace(p, '''  () => (options: { component: ComponentType; [key: string]: unknown }) => ({ options });''', '''  () => (options: { component: ComponentType; validateSearch?: (search: Record<string, unknown>) => Record<string, unknown>; [key: string]: unknown }) => ({
    options,
    useSearch: () => options.validateSearch?.(Object.fromEntries(new URLSearchParams(window.location.search))) ?? {},
    useNavigate: () => navigate,
  });''')

# Empty is a valid domain response, not null. These functions do not recurse:
# reference.getLabOverview and reference.forecastProgress never call legacy.
p="tests/today-browser/functions-stub.ts"
replace(p, 'export const getLabOverview = async () => null;', 'export const getLabOverview = async () => (await import("./reference-functions")).getLabOverview();')
replace(p, 'export const forecastProgress = async () => null;', 'export const forecastProgress = async () => (await import("./reference-functions")).forecastProgress();')

p="scripts/test-today-browser.mjs"
replace(p, '''  const body = await first.page.locator("body").innerText();
  expect(body).toContain("Not enough verified data yet.");''', '''  await expect(first.page.getByText("No pattern has reached its evidence threshold yet.", { exact: true })).toBeVisible();
  await expect(first.page.getByText("No hypothesis is awaiting more evidence.", { exact: true })).toBeVisible();
  const body = await first.page.locator("body").innerText();
  expect(body).not.toContain("Not enough verified data yet."); // obsolete copy must not mask a stuck loading state
''')
replace(p, '''  record("full-shell empty data and source failures remain visibly distinct");''', '''  record("full-shell empty data and source failures remain visibly distinct");

  // Real UI controls, not direct calls to state setters. Search values survive
  // page reload and browser history; the fixture still has no live backend.
  const linked = await openPanel("?shell=1&screen=today&scenario=reference", { viewport: { width: 390, height: 844 }, locale: "en-US" });
  await linked.page.getByRole("link", { name: "Explore muscles", exact: false }).click();
  await expect(linked.page.getByRole("tab", { name: "Muscles", exact: true })).toHaveAttribute("aria-selected", "true");
  await linked.page.getByRole("button", { name: /^Chest(?:\\s|$)/ }).first().click();
  await expect(linked.page.locator('[data-twin-muscle-detail="chest"]')).toBeVisible();
  await linked.page.getByRole("button", { name: "Impact", exact: true }).click();
  await expect(linked.page).toHaveURL(/detail=impact/);
  await expect(linked.page.getByText("Latest completed session", { exact: true })).toBeVisible();
  await linked.page.reload();
  await expect(linked.page.getByRole("button", { name: "Impact", exact: true })).toHaveAttribute("aria-pressed", "true");
  await linked.page.goBack();
  await expect(linked.page.getByRole("button", { name: "Status", exact: true })).toHaveAttribute("aria-pressed", "true");
  await linked.page.getByRole("button", { name: "History", exact: true }).click();
  await expect(linked.page).toHaveURL(/detail=history/);
  expect(linked.errors).toEqual([]);
  await linked.page.context().close();
  record("Today opens muscle evidence; status, impact and history survive URL navigation and reload");

  for (const [scenario, expected] of [["reference", "Received records refreshed."], ["empty", "Records checked. No readings have arrived yet."], ["failure", "Records could not be refreshed. No successful sync is claimed."]]) {
    const checked = await openPanel(`?shell=1&screen=today&scenario=${scenario}`, { locale: "en-US", viewport: { width: 390, height: 844 } });
    const button = checked.page.getByTestId("refresh-received-data");
    await expect(button).toBeEnabled({ timeout: 30000 });
    await button.click();
    await expect(checked.page.getByTestId("received-data-refresh-status")).toHaveText(expected);
    await expect(button).toBeEnabled();
    expect(checked.errors).toEqual([]);
    await checked.page.context().close();
  }
  record("manual data refresh distinguishes received, empty and failed records without claiming watch sync");''')

add("docs/FUTURE_LAB_REFERENCE_IMPLEMENTATION.md", r'''
# Future Lab reference implementation — application, not an image

The supplied September 8 desktop and six-phone references define the layout.
No new concept image is needed. Continue the actual application in PR #55;
keep the separate V10 human-authoring experiments out of this app change.

## Screen / data / action map

| Screen | Existing real implementation in the reference UI branch | Source and limits |
| --- | --- | --- |
| Today `/app` | Five-column cockpit, signals/plan, readiness/brief/decision, interactive Twin, Lab roster, prediction evidence/recovery/sleep, four lower cards, source strip | Existing authenticated reads. Missing values stay missing. Refresh re-reads received records, not a vendor sync. |
| My Twin `/twin` | Overview, Muscles, Systems; body composition, region picker, timeline, trend and rewind | Canonical Twin snapshot and observations. Search state survives reload/back/forward. |
| Muscle detail `/twin?view=muscles&region=chest&detail=status` | Status / History / Impact, selected anatomical region, load, recovery estimate, last trained, evidence, training link | Region detail is linked directly from Today. Growth signal, clinical injury risk and future region strength slots explicitly say not modelled/not assessed; logged volume cannot prove them. |
| Future Me `/progress` | Horizon and exercise selection, athlete illustration, current/projected estimated 1RM, change, evidence, recalculation | Existing deterministic 4/12-week model. 180D/1Y unavailable; 4W is not relabelled as exactly 30D. Illustration is not a personalized body prediction. |
| Lab `/lab` | Ten-domain roster, investigation/evidence and hypothesis retrospectives | Real data availability, not ten fictitious people or continuous live jobs. |
| Journal `/history` | Filtered hypotheses, discoveries, active investigations and decisions, training history | Stored records only; hypothesis support is not medical certainty. |

Top and bottom primary navigation remains Today / My Twin / Lab / Future Me /
Journal. Training and other existing tools remain accessible. Athlete context,
AI orchestration, auth, RLS, programme writes and analytics are not replaced.
The figures printed in the design reference are NOT defaults for a real account.

## This continuation

Adds validated optional Twin URL state and true links from the cockpit into
muscle evidence; all three detail tabs persist. Invalid region/tab inputs are
ignored without inventing data. Keyboard arrows/Home/End work on Twin views.

Adds a real manual refresh action to the source strip, sharing the exact live
signal query used by the rail. Duplicate submissions are locked while pending.
Empty, stale, partial and unreadable sources receive different feedback. A
successful request is not reported as a successful watch sync.

Repairs the old browser fixture's null Lab/forecast answers to valid empty
schemas, rather than treating null as a real empty account. Browser checks wait
for specific resolved empty states; existing tests are not disabled. Adds
interaction coverage for Today-to-muscle navigation, reload/back behavior and
refresh success/empty/error.

## Acceptance boundary

This document is not a claim of 1:1 pixel parity, final visual approval or a
production deployment. CI screenshots render actual route components with
conspicuously synthetic records. The supplied reference has muscle fibre detail
and muscular proportions the current atlas does not yet reproduce exactly.
Predicted muscle gain/fat loss, clinical injury probabilities, long-horizon body
simulations and continuous specialist activity require implemented, validated
models rather than copying their mockup labels and numbers.

Review the new commit's CI/browser evidence and Netlify preview separately from
production. Keep PR #55 draft until remaining visual/integration gates pass.
''')
(root / "reference-patch-files.txt").write_text("\n".join(changed) + "\n")
print("Changed application paths:")
print("\n".join(changed))
