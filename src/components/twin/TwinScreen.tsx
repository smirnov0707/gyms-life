import { useRef, useState } from "react";
import { Activity, HeartPulse, PersonStanding } from "lucide-react";
import { TwinView } from "@/components/TwinView";
import { BodyCompositionCard } from "@/components/BodyCompositionCard";
import { BodyMetricsPanel } from "@/components/BodyMetricsPanel";
import { BodyCompositionScanner } from "@/components/BodyCompositionScanner";
import { TwinMuscleTable } from "@/components/twin/TwinMuscleTable";
import { TwinMuscleDetail } from "@/components/twin/TwinMuscleDetail";
import { TwinRewind } from "@/components/twin/TwinRewind";
import { TwinTimeline } from "@/components/twin/TwinTimeline";
import { TwinTrendLens } from "@/components/twin/TwinTrendLens";
import { LiveSignals } from "@/components/LiveSignals";
import { useI18n, type TKey } from "@/lib/i18n";
import "./TwinScreen.css";
import { nextTwinView, type TwinNavigation } from "@/lib/twin-navigation";

/**
 * The Twin screen's three views, the way the design splits them.
 *
 * The split is by what the reading comes from, not by decoration:
 * Overview is the figure and the body it stands for, Muscles is everything
 * derived from logged sets, and Systems is everything a device measured.
 * Nothing crosses between them, so no panel can borrow another's evidence.
 */

const TABS = [
  { id: "overview", label: "tw.tabOverview", icon: PersonStanding },
  { id: "muscles", label: "tw.tabMuscles", icon: Activity },
  { id: "systems", label: "tw.tabSystems", icon: HeartPulse },
] as const satisfies readonly { id: string; label: TKey; icon: typeof PersonStanding }[];

type TabId = (typeof TABS)[number]["id"];

export function TwinScreen({
  navigation,
  onNavigate,
}: { navigation?: TwinNavigation; onNavigate?: (next: TwinNavigation) => void } = {}) {
  const { t } = useI18n();
  const [localNavigation, setLocalNavigation] = useState<TwinNavigation>({});
  const current = navigation ?? localNavigation;
  const change = onNavigate ?? setLocalNavigation;
  const active = current.view ?? "overview";
  const detailRegion = current.region ?? null;
  const setActive = (view: TabId) => change({ view });
  const setDetailRegion = (region: string | null) =>
    change(region ? { view: active, region, detail: "status" } : { view: active });
  const tabRefs = useRef(new Map<TabId, HTMLButtonElement>());

  const onKeyDown = (event: React.KeyboardEvent) => {
    const next = nextTwinView(active, event.key);
    if (!next) return;
    event.preventDefault();
    setActive(next);
    tabRefs.current.get(next)?.focus();
  };

  return (
    <div className="twin-screen mx-auto grid w-full max-w-6xl gap-4">
      {detailRegion ? (
        <TwinMuscleDetail
          key={detailRegion}
          activeTab={current.detail ?? "status"}
          onTabChange={(detail) => change({ ...current, detail })}
          regionId={detailRegion}
          onRegionChange={setDetailRegion}
          onBack={() => setDetailRegion(null)}
          backLabel={t(active === "muscles" ? "tw.tabMuscles" : "tw.tabOverview")}
        />
      ) : (
        <>
          <div
            role="tablist"
            aria-label={t("tw.views")}
            onKeyDown={onKeyDown}
            className="flex gap-1 overflow-x-auto rounded-full border border-border bg-surface-2 p-1"
          >
            {TABS.map((tab) => {
              const selected = tab.id === active;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  ref={(node) => {
                    if (node) tabRefs.current.set(tab.id, node);
                    else tabRefs.current.delete(tab.id);
                  }}
                  type="button"
                  role="tab"
                  id={`twin-tab-${tab.id}`}
                  aria-selected={selected}
                  aria-controls={`twin-panel-${tab.id}`}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setActive(tab.id)}
                  // `flex-1` only once there is room for it. At 320px in
                  // Lithuanian, forcing three nowrap labels into a third of the
                  // width each made them overlap into an unreadable smear — the
                  // row scrolled, so nothing overflowed the page and the layout
                  // check passed while the words sat on top of one another.
                  className={`flex min-h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full px-3 text-[11px] font-bold uppercase tracking-[0.12em] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary sm:flex-1 sm:px-4 sm:tracking-[0.16em] ${
                    selected
                      ? "bg-surface text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon aria-hidden="true" className="size-3.5" />
                  {t(tab.label)}
                </button>
              );
            })}
          </div>

          {/* Each panel stays mounted only while selected: the figure is a WebGL
          scene, and three of them holding contexts open is not free. */}
          <div
            role="tabpanel"
            id={`twin-panel-${active}`}
            aria-labelledby={`twin-tab-${active}`}
            className="grid gap-4"
          >
            {active === "overview" ? (
              <>
                <TwinView onInspectRegion={setDetailRegion} />
                <div className="twin-body-composition">
                  <BodyCompositionCard />
                </div>
                <details className="rounded-2xl border border-border bg-surface/75">
                  <summary className="cursor-pointer list-none px-4 py-3 text-xs font-medium text-foreground">
                    {t("tw.measurementTools")}
                  </summary>
                  <div className="space-y-4 border-t border-border p-4">
                    <BodyMetricsPanel compact />
                    <BodyCompositionScanner />
                  </div>
                </details>
                <TwinTimeline />
              </>
            ) : active === "muscles" ? (
              <>
                <TwinMuscleTable onSelectRegion={setDetailRegion} />
                <TwinTrendLens />
                <TwinRewind />
              </>
            ) : (
              <>
                <section className="rounded-3xl border border-border bg-surface p-4 md:p-5">
                  <h2 className="text-[11px] font-bold uppercase tracking-[0.22em] text-foreground">
                    {t("tw.systemsTitle")}
                  </h2>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    {t("tw.systemsNote")}
                  </p>
                </section>
                <LiveSignals />
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
