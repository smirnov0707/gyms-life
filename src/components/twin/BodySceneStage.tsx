import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ChevronDown, Minus, Plus, RotateCcw, RotateCw, Settings2, Undo2 } from "lucide-react";
import { BodyMap } from "./BodyMap";
import { viewShowing, type BodyView } from "./body-map.geometry";
import {
  TWIN_BODY_REGIONS,
  TWIN_DISPLAY_COLORS,
  twinDisplayToneFor2D,
  isTwinBodyRegion,
  type TwinSceneState,
  type TwinSceneRegion,
  type TwinCameraCommand,
} from "./twin-scene.model";
import type { TwinSceneHandle } from "./twin-scene.runtime";
import type { TwinBodyProvenance } from "./twin-body.provenance";
import type { TwinBodyVariant } from "@/lib/digital-twin.schema";

export type BodySceneStageProps = {
  state: TwinSceneState;
  selectedRegion: string | null;
  onSelectRegion: (region: string) => void;
  view: BodyView;
  onViewChange: (view: BodyView) => void;
  regionLabel: (region: string) => string;
  language: "lt" | "en";
  /** Which shipped base mesh to draw. Omitted where no profile is in scope. */
  bodyVariant?: TwinBodyVariant;
  layerControls: ReactNode;
  unitLabel: string;
  formatValue: (value: number | null) => string;
  formatRegion: (region: TwinSceneRegion) => string;
  extraNote?: string;
  /**
   * Let the scene take the whole height its container gives it.
   *
   * The canvas was capped at 540px on every large screen, so on a full-height
   * layout the figure sat in the middle of a wide, short letterbox with half
   * the page empty around it — a small figure on a big screen, which is the
   * opposite of what this screen is for.
   */
  fill?: boolean;
  /** Bounded overview stage; the full Twin keeps its existing flexible frame. */
  presentation?: "full" | "cockpit" | "detail";
  sidePanel?: ReactNode;
  focusRegion?: string | null;
  /** Live mobile screens keep view/layer options in the existing disclosure. */
  compactMobileControls?: boolean;
};
const COPY = {
  en: {
    scene:
      "Interactive human body. Drag to rotate; pinch to zoom. Keyboard: left/right arrows rotate, plus/minus zoom, Home resets.",
    hint: "Drag to rotate 360° · Pinch or scroll to zoom",
    loading: "Preparing 3D… 2D remains available.",
    fallback: "3D is unavailable on this device. Your evidence is still available in 2D.",
    retry: "Try 3D again",
    front: "Front",
    back: "Back",
    left: "Left side",
    right: "Right side",
    rotateLeft: "Rotate left",
    rotateRight: "Rotate right",
    zoomIn: "Zoom in",
    zoomOut: "Zoom out",
    reset: "Reset view",
    region: "Inspect a region",
    choose: "Choose a region",
    motion: "Ambient motion",
    note: "Schematic body, not a personal scan. Motion is decorative, not a biometric signal.",
    controls: "View controls",
    renderer: "Twin renderer",
    candidate: "Review candidate · Not released",
    simplified: "Simplified 3D body · The model asset could not be loaded or verified.",
  },
  lt: {
    scene:
      "Interaktyvus žmogaus kūnas. Tempk, kad pasuktum; suglausk pirštus, kad keistum mastelį. Klaviatūra: rodyklės suka, pliusas ir minusas keičia mastelį, Home atkuria vaizdą.",
    hint: "Tempk ir suk 360° · Mastelį keisk dviem pirštais",
    loading: "Ruošiamas 3D… 2D vaizdas lieka pasiekiamas.",
    fallback: "3D šiame įrenginyje nepasiekiamas. Tavo duomenys lieka pasiekiami 2D vaizde.",
    retry: "Bandyti 3D dar kartą",
    front: "Priekis",
    back: "Nugara",
    left: "Kairysis šonas",
    right: "Dešinysis šonas",
    rotateLeft: "Pasukti kairėn",
    rotateRight: "Pasukti dešinėn",
    zoomIn: "Priartinti",
    zoomOut: "Nutolinti",
    reset: "Atkurti vaizdą",
    region: "Apžiūrėti regioną",
    choose: "Pasirink regioną",
    motion: "Subtilus judesys",
    note: "Bendrinis kūnas, ne tavo skenavimas. Judesys dekoratyvus, ne biometrinis signalas.",
    controls: "Vaizdo valdymas",
    renderer: "Dvynio vaizdas",
    candidate: "Peržiūros kandidatas · Dar neįdiegtas",
    simplified: "Supaprastintas 3D kūnas · Modelio failo nepavyko įkelti arba patikrinti.",
  },
} as const;

/** Shared renderer lifecycle and accessible controls. No queries or physiological inference. */
export function BodySceneStage(props: BodySceneStageProps) {
  const {
    state,
    selectedRegion,
    onSelectRegion,
    view,
    onViewChange,
    regionLabel,
    language,
    layerControls,
    fill = false,
    presentation = "full",
    sidePanel,
    focusRegion,
    compactMobileControls = false,
    unitLabel,
    formatValue,
    formatRegion,
    extraNote,
    bodyVariant,
  } = props;
  const copy = COPY[language];
  const controlsId = useId();
  const controlToggle = useRef<HTMLButtonElement>(null);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [mobileViewport, setMobileViewport] = useState(false);
  const mobileDisclosure = compactMobileControls && mobileViewport;
  useEffect(() => {
    if (!compactMobileControls) return;
    const query = window.matchMedia("(max-width: 639px)");
    const update = () => setMobileViewport(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, [compactMobileControls]);
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<TwinSceneHandle | null>(null);
  const latest = useRef(props);
  const [mode, setMode] = useState<"3d" | "2d">("3d");
  const [ready, setReady] = useState(false);
  const [provenance, setProvenance] = useState<TwinBodyProvenance | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [motion, setMotion] = useState(true);
  useEffect(() => {
    latest.current = props;
  });
  useEffect(() => {
    if (mode !== "3d" || !host.current) return;
    let cancelled = false;
    let invalidated = false;
    let owned: TwinSceneHandle | null = null;
    const target = host.current;
    setReady(false);
    setProvenance(null);
    setFailed(false);
    const fail = () => {
      if (cancelled) return;
      invalidated = true;
      owned?.dispose();
      if (scene.current === owned) scene.current = null;
      setFailed(true);
      setReady(false);
      setProvenance(null);
    };
    const timeout = window.setTimeout(fail, 15000);
    void import("./twin-scene.runtime")
      .then(({ mountTwinScene }) => {
        if (cancelled || invalidated) return;
        const current = latest.current;
        const handle = mountTwinScene(target, {
          state: current.state,
          selectedRegion: current.selectedRegion,
          label: COPY[current.language].scene,
          onSelect: (region) => latest.current.onSelectRegion(region),
          onFailure: fail,
          // The stage is not ready when the renderer mounts, it is ready when
          // there is a body in it. Between the two the scene is empty, and
          // showing an empty stage — or the mannequin that used to fill it —
          // is worse than keeping the 2D map, which is the same data.
          onBodyReady: (_kind, loadedProvenance) => {
            if (!cancelled && !invalidated) {
              setProvenance(loadedProvenance);
              setReady(true);
            }
          },
          ...(current.bodyVariant ? { humanVariant: current.bodyVariant } : {}),
        });
        window.clearTimeout(timeout);
        if (cancelled || invalidated) {
          handle.dispose();
          return;
        }
        owned = handle;
        scene.current = handle;
        // The two-view preference seeds orientation only; updates preserve free orbit.
        handle.command(current.view);
      })
      .catch(() => {
        window.clearTimeout(timeout);
        fail();
      });
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      owned?.dispose();
      if (scene.current === owned) scene.current = null;
    };
  }, [mode, attempt, bodyVariant]);
  useEffect(() => {
    scene.current?.setState(state);
  }, [state, ready]);
  useEffect(() => {
    scene.current?.select(selectedRegion);
  }, [selectedRegion, ready]);
  useEffect(() => {
    if (ready && focusRegion !== undefined) scene.current?.focus(focusRegion);
  }, [focusRegion, ready]);
  useEffect(() => {
    scene.current?.setMotion(motion);
  }, [motion, ready]);
  useEffect(() => {
    host.current?.querySelector("canvas")?.setAttribute("aria-label", copy.scene);
  }, [copy.scene, ready]);
  const show3D = mode === "3d" && ready && !failed;
  const command = (action: TwinCameraCommand) => scene.current?.command(action);
  const selectRegion = (region: string) => {
    onSelectRegion(region);
    if (!show3D && isTwinBodyRegion(region)) onViewChange(viewShowing(region, view));
  };
  // Explicit local touch targets survive the legacy unlayered global min-width reset.
  const controlStyle = { minWidth: 44, minHeight: 44, flexShrink: 0 };
  const controlClass =
    "min-h-11 min-w-11 rounded-xl px-3 text-xs font-medium text-neutral-200 transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-300";
  const rendererControls = (
    <div data-twin-toolbar className="flex items-center justify-between gap-2 px-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
        {unitLabel}
      </p>
      <div
        className="flex rounded-full border border-white/10 bg-black/30 p-1"
        aria-label={copy.renderer}
      >
        <button
          type="button"
          style={controlStyle}
          className={`${controlClass} ${show3D ? "bg-white/10 text-white" : ""}`}
          aria-pressed={show3D}
          onClick={() => {
            if (mode === "2d" || failed) {
              setMode("3d");
              setAttempt((value) => value + 1);
            }
          }}
        >
          3D
        </button>
        <button
          type="button"
          style={controlStyle}
          className={`${controlClass} ${mode === "2d" ? "bg-white/10 text-white" : ""}`}
          aria-pressed={mode === "2d"}
          onClick={() => setMode("2d")}
        >
          2D
        </button>
      </div>
    </div>
  );
  return (
    <div
      // In fill mode the stage is a column that takes its container's height,
      // so the viewport below can flex into whatever is left. Without it the
      // viewport's own `h-full` resolves against an auto-height parent and
      // silently falls back to its minimum, which on a laptop left a third of
      // the page as black margin around a figure that could have filled it.
      className={fill ? "flex h-full min-h-0 w-full min-w-0 flex-col" : "w-full min-w-0"}
      data-twin-stage={show3D ? "3d" : "2d"}
      data-twin-source={show3D ? (provenance?.source ?? "generated") : "2d"}
      data-twin-layer={state.layer}
      data-twin-presentation={presentation}
      data-twin-mobile-compact={mobileDisclosure || undefined}
    >
      {presentation !== "cockpit" && !mobileDisclosure && (
        <>
          {layerControls}
          {rendererControls}
        </>
      )}
      {mobileDisclosure ? <p data-twin-mobile-unit>{unitLabel}</p> : null}
      <div className={presentation === "cockpit" ? "twin-cockpit-scene" : "contents"}>
        <div
          data-twin-viewport
          className={
            presentation === "cockpit"
              ? "relative min-h-0 min-w-0"
              : presentation === "detail"
                ? "relative h-[340px] w-full sm:h-[440px]"
                : fill
                  ? // Capped rather than edge to edge. A standing body is roughly
                    // twice as tall as it is wide, so on a desktop a full-width
                    // canvas is mostly empty black with a small figure in the middle
                    // of it — the camera can only fill the shorter axis. Holding the
                    // canvas near the figure's own proportion lets it fill the frame.
                    "relative mx-auto min-h-[clamp(320px,52svh,900px)] w-full max-w-[38rem] flex-1"
                  : "relative h-[clamp(240px,calc(100svh_-_580px),540px)] w-full lg:h-[540px]"
          }
        >
          {mode === "3d" && (
            <div
              ref={host}
              className={`absolute inset-0 ${show3D ? "" : "invisible pointer-events-none"}`}
            />
          )}
          {!show3D && (
            <div className="absolute inset-0 mx-auto max-w-[370px]">
              <BodyMap
                regions={state.regions.map((region) => ({
                  region: region.id,
                  tone: twinDisplayToneFor2D(region.display.tone),
                  displayColor: TWIN_DISPLAY_COLORS[region.display.tone],
                  value: formatValue(region.display.value),
                }))}
                view={view}
                selectedRegion={selectedRegion}
                onSelectRegion={selectRegion}
                regionLabel={regionLabel}
                showFraming
              />
            </div>
          )}
          {!ready && mode === "3d" && !failed && (
            <p
              role="status"
              className="absolute bottom-2 inset-x-3 rounded-xl bg-black/80 p-3 text-center text-xs text-neutral-300"
            >
              {copy.loading}
            </p>
          )}
        </div>
        {sidePanel}
      </div>
      {show3D && provenance ? (
        <p
          data-twin-credit
          title={provenance.credit}
          className="mt-2 px-3 text-[9px] leading-relaxed text-neutral-400"
        >
          {provenance.credit}
          {provenance.candidate ? (
            <span data-twin-candidate-status className="block">
              {copy.candidate}
            </span>
          ) : null}
        </p>
      ) : show3D ? (
        <p
          data-twin-model-fallback
          role="status"
          className="mt-2 px-3 text-[10px] leading-relaxed text-neutral-400"
        >
          {copy.simplified}
        </p>
      ) : null}
      {presentation === "cockpit" && layerControls}
      {failed && mode === "3d" && (
        <div
          role="status"
          className="mx-3 rounded-xl border border-amber-300/25 p-3 text-xs text-amber-200"
        >
          <p>{copy.fallback}</p>
          <button
            type="button"
            style={controlStyle}
            className={`${controlClass} mt-1 block underline`}
            onClick={() => setAttempt((value) => value + 1)}
          >
            {copy.retry}
          </button>
        </div>
      )}
      <div data-twin-selection className="mx-3 mb-3 flex min-w-0 items-center gap-2">
        <label className="relative block min-w-0 flex-1">
          <span className="sr-only">{copy.region}</span>
          <select
            aria-label={copy.region}
            value={selectedRegion && isTwinBodyRegion(selectedRegion) ? selectedRegion : ""}
            onChange={(event) => {
              if (event.target.value) selectRegion(event.target.value);
            }}
            className="min-h-11 w-full min-w-0 appearance-none rounded-xl border border-white/15 bg-[#101615] py-2 pl-3 pr-10 text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-300"
          >
            <option value="">{copy.choose}</option>
            {TWIN_BODY_REGIONS.map((region) => {
              const entry = state.regions.find((item) => item.id === region);
              return (
                <option key={region} value={region}>
                  {regionLabel(region)} · {entry ? formatRegion(entry) : "—"}
                </option>
              );
            })}
          </select>
          <ChevronDown
            aria-hidden="true"
            className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400"
          />
        </label>
        <button
          ref={controlToggle}
          type="button"
          aria-label={copy.controls}
          title={copy.controls}
          aria-expanded={controlsOpen}
          aria-controls={controlsId}
          onClick={() => setControlsOpen((value) => !value)}
          style={
            presentation === "cockpit"
              ? { minWidth: 32, minHeight: 32, flexShrink: 0 }
              : controlStyle
          }
          className={`${controlClass} ${controlsOpen ? "bg-white/10" : ""}`}
        >
          <Settings2 aria-hidden="true" className="size-4" />
        </button>
      </div>
      <div
        id={controlsId}
        hidden={!controlsOpen}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setControlsOpen(false);
            controlToggle.current?.focus();
          }
        }}
        className="mx-3 mb-3 rounded-2xl border border-white/10 bg-black/30 p-3"
      >
        {mobileDisclosure && layerControls}
        {(presentation === "cockpit" || mobileDisclosure) && rendererControls}
        <p className="text-xs leading-relaxed text-neutral-300">{copy.hint}</p>
        <div className="flex flex-wrap justify-center gap-1 pt-2">
          {show3D &&
            (
              [
                ["rotate-left", RotateCcw, copy.rotateLeft],
                ["rotate-right", RotateCw, copy.rotateRight],
                ["zoom-in", Plus, copy.zoomIn],
                ["zoom-out", Minus, copy.zoomOut],
                ["reset", Undo2, copy.reset],
              ] as const
            ).map(([action, Icon, name]) => (
              <button
                key={action}
                type="button"
                onClick={() => command(action)}
                style={controlStyle}
                className={controlClass}
                aria-label={name}
                title={name}
              >
                <Icon aria-hidden="true" className="size-4" />
              </button>
            ))}
        </div>
        <div className="mt-2 flex flex-wrap justify-center gap-1">
          {(show3D
            ? (["front", "back", "left", "right"] as const)
            : (["front", "back"] as const)
          ).map((action) => (
            <button
              key={action}
              type="button"
              style={controlStyle}
              className={controlClass}
              onClick={() => {
                if (show3D) command(action);
                else if (action === "front" || action === "back") onViewChange(action);
              }}
            >
              {copy[action]}
            </button>
          ))}
        </div>
        {show3D && (
          <label className="mt-2 flex min-h-11 cursor-pointer items-center gap-3 text-xs text-neutral-300">
            <input
              type="checkbox"
              checked={motion}
              onChange={(event) => setMotion(event.target.checked)}
              className="size-4 accent-emerald-400"
            />
            {copy.motion}
          </label>
        )}
        <p className="mt-2 text-xs leading-relaxed text-neutral-300">{copy.note}</p>
        {extraNote && <p className="mt-2 text-xs leading-relaxed text-neutral-300">{extraNote}</p>}
      </div>
    </div>
  );
}
