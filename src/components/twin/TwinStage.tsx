import { useEffect, useRef, useState } from "react";
import type { TwinSnapshot } from "@/lib/digital-twin.schema";
import { BodyMap, toneForRecoveryBand } from "./BodyMap";
import { viewShowing, type BodyView } from "./body-map.geometry";
import { TWIN_BODY_REGIONS, isTwinBodyRegion, mapTwinScene, type TwinCameraCommand } from "./twin-scene.model";
import type { TwinSceneHandle } from "./twin-scene.runtime";

export type TwinStageProps = {
  snapshot: TwinSnapshot;
  selectedRegion: string | null;
  onSelectRegion: (region: string) => void;
  view: BodyView;
  onViewChange: (view: BodyView) => void;
  regionLabel: (region: string) => string;
  language: "lt" | "en";
};

const COPY = {
  en: {
    scene: "Interactive schematic body. Drag to rotate; pinch to zoom. Keyboard: left/right arrows rotate, plus/minus zoom, Home resets.",
    hint: "Drag to rotate 360° · Pinch or scroll to zoom",
    loading: "Preparing 3D… 2D remains available.",
    fallback: "3D is unavailable on this device. Your evidence is still available in 2D.",
    retry: "Try 3D again", front: "Front", back: "Back", left: "Left side", right: "Right side",
    rotateLeft: "Rotate left", rotateRight: "Rotate right", zoomIn: "Zoom in", zoomOut: "Zoom out", reset: "Reset view",
    region: "Inspect a region", choose: "Choose a region", motion: "Ambient motion", recovery: "Calculated recovery",
    note: "Schematic body, not a personal scan. Colour shows the calculated recovery band; motion is decorative, not a biometric signal.",
    unknown: "No data", fresh: "Fresh", moderate: "Moderate", fatigued: "Fatigued",
  },
  lt: {
    scene: "Interaktyvus scheminis kūnas. Tempk, kad pasuktum; suglausk pirštus, kad keistum mastelį. Klaviatūra: rodyklės suka, pliusas ir minusas keičia mastelį, Home atkuria vaizdą.",
    hint: "Tempk ir suk 360° · Mastelį keisk dviem pirštais",
    loading: "Ruošiamas 3D… 2D vaizdas lieka pasiekiamas.",
    fallback: "3D šiame įrenginyje nepasiekiamas. Tavo duomenys lieka pasiekiami 2D vaizde.",
    retry: "Bandyti 3D dar kartą", front: "Priekis", back: "Nugara", left: "Kairysis šonas", right: "Dešinysis šonas",
    rotateLeft: "Pasukti kairėn", rotateRight: "Pasukti dešinėn", zoomIn: "Priartinti", zoomOut: "Nutolinti", reset: "Atkurti vaizdą",
    region: "Apžiūrėti regioną", choose: "Pasirink regioną", motion: "Subtilus judesys", recovery: "Apskaičiuotas atsistatymas",
    note: "Scheminis kūnas, ne asmeninis skenavimas. Spalva rodo apskaičiuotą atsistatymo būseną; judesys dekoratyvus, ne biometrinis signalas.",
    unknown: "Nėra duomenų", fresh: "Švieži", moderate: "Vidutiniškai", fatigued: "Nuvargę",
  },
} as const;

export function TwinStage(props: TwinStageProps) {
  const { snapshot, selectedRegion, onSelectRegion, view, onViewChange, regionLabel, language } = props;
  const copy = COPY[language];
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<TwinSceneHandle | null>(null);
  const latest = useRef(props);
  const [mode, setMode] = useState<"3d" | "2d">("3d");
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [motion, setMotion] = useState(true);
  const mapped = mapTwinScene(snapshot);

  useEffect(() => { latest.current = props; });
  useEffect(() => {
    if (mode !== "3d" || !host.current) return;
    let cancelled = false;
    let timedOut = false;
    const target = host.current;
    setReady(false);
    setFailed(false);
    const fail = () => {
      if (cancelled) return;
      scene.current?.dispose();
      scene.current = null;
      setFailed(true);
      setReady(false);
    };
    const timeout = window.setTimeout(() => { timedOut = true; fail(); }, 15000);
    void import("./twin-scene.runtime").then(({ mountTwinScene }) => {
      if (cancelled || timedOut) return;
      const current = latest.current;
      const handle = mountTwinScene(target, {
        state: mapTwinScene(current.snapshot),
        selectedRegion: current.selectedRegion,
        label: COPY[current.language].scene,
        onSelect: (region) => latest.current.onSelectRegion(region),
        onFailure: fail,
      });
      if (cancelled) { handle.dispose(); return; }
      scene.current = handle;
      // The two-view preference seeds the initial orientation, not subsequent free orbit.
      handle.command(current.view);
      window.clearTimeout(timeout);
      setReady(true);
    }).catch(() => { window.clearTimeout(timeout); fail(); });
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      scene.current?.dispose();
      scene.current = null;
    };
  }, [mode, attempt]);

  useEffect(() => { scene.current?.setState(mapTwinScene(snapshot)); }, [snapshot, ready]);
  useEffect(() => { scene.current?.select(selectedRegion); }, [selectedRegion, ready]);
  useEffect(() => { scene.current?.setMotion(motion); }, [motion, ready]);
  useEffect(() => {
    host.current?.querySelector("canvas")?.setAttribute("aria-label", copy.scene);
  }, [copy.scene, ready]);

  const show3D = mode === "3d" && ready && !failed;
  const command = (action: TwinCameraCommand) => scene.current?.command(action);
  const selectRegion = (region: string) => {
    onSelectRegion(region);
    if (!show3D && isTwinBodyRegion(region)) onViewChange(viewShowing(region, view));
  };
  const controlClass = "min-h-11 min-w-11 rounded-xl px-3 text-xs font-medium text-neutral-200 transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-300";

  return (
    <div className="w-full min-w-0" data-twin-stage={show3D ? "3d" : "2d"}>
      <div className="flex items-center justify-between gap-2 px-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">{copy.recovery}</p>
        <div className="flex rounded-full border border-white/10 bg-black/30 p-1" aria-label="Twin renderer">
          <button type="button" className={`${controlClass} ${show3D ? "bg-white/10 text-white" : ""}`} aria-pressed={show3D} onClick={() => {
            if (mode === "2d" || failed) { setMode("3d"); setAttempt((value) => value + 1); }
          }}>3D</button>
          <button type="button" className={`${controlClass} ${mode === "2d" ? "bg-white/10 text-white" : ""}`} aria-pressed={mode === "2d"} onClick={() => setMode("2d")}>2D</button>
        </div>
      </div>
      <div className="relative w-full h-[clamp(360px,54svh,580px)]">
        {mode === "3d" && <div ref={host} className={`absolute inset-0 ${show3D ? "" : "invisible pointer-events-none"}`} />}
        {!show3D && <div className="absolute inset-0 mx-auto max-w-[370px]">
          <BodyMap regions={mapped.regions.map((region) => ({ region: region.id, tone: toneForRecoveryBand(region.band), value: region.recoveryPct === null ? null : `${region.recoveryPct}%` }))}
            view={view} selectedRegion={selectedRegion} onSelectRegion={selectRegion} regionLabel={regionLabel} showFraming />
        </div>}
        {!ready && mode === "3d" && !failed && <p role="status" className="absolute bottom-2 inset-x-3 rounded-xl bg-black/80 p-3 text-center text-xs text-neutral-300">{copy.loading}</p>}
      </div>
      {failed && mode === "3d" && <div role="status" className="mx-3 rounded-xl border border-amber-300/25 p-3 text-xs text-amber-200">
        {copy.fallback}
        <button type="button" className={`${controlClass} mt-1 block underline`} onClick={() => setAttempt((value) => value + 1)}>{copy.retry}</button>
      </div>}
      {show3D ? <>
        <p className="px-3 text-center text-[11px] leading-relaxed text-neutral-400">{copy.hint}</p>
        <div className="flex flex-wrap justify-center gap-1 p-2">
          {([
            ["rotate-left", "↶", copy.rotateLeft], ["rotate-right", "↷", copy.rotateRight],
            ["zoom-in", "+", copy.zoomIn], ["zoom-out", "−", copy.zoomOut], ["reset", "↺", copy.reset],
          ] as const).map(([action, symbol, name]) => <button key={action} type="button" onClick={() => command(action)} className={controlClass} aria-label={name} title={name}>{symbol}</button>)}
        </div>
        <div className="flex flex-wrap justify-center gap-1">
          {(["front", "back", "left", "right"] as const).map((action) => <button key={action} type="button" className={controlClass} onClick={() => command(action)}>{copy[action]}</button>)}
        </div>
      </> : <div className="flex justify-center gap-2">
        {(["front", "back"] as const).map((side) => <button key={side} type="button" className={controlClass} aria-pressed={view === side} onClick={() => onViewChange(side)}>{copy[side]}</button>)}
      </div>}
      <div className="grid gap-3 px-3 pb-4 pt-2">
        <label className="grid gap-2 text-xs text-neutral-300">
          {copy.region}
          <select value={selectedRegion && isTwinBodyRegion(selectedRegion) ? selectedRegion : ""} onChange={(event) => { if (event.target.value) selectRegion(event.target.value); }}
            className="min-h-11 min-w-0 w-full rounded-xl border border-white/15 bg-[#101615] px-3 text-sm text-white">
            <option value="">{copy.choose}</option>
            {TWIN_BODY_REGIONS.map((region) => <option key={region} value={region}>{regionLabel(region)} · {copy[mapped.regions.find((entry) => entry.id === region)?.band ?? "unknown"]}</option>)}
          </select>
        </label>
        {show3D && <label className="flex min-h-11 cursor-pointer items-center gap-3 text-xs text-neutral-400">
          <input type="checkbox" checked={motion} onChange={(event) => setMotion(event.target.checked)} className="size-4 accent-emerald-400" />{copy.motion}
        </label>}
        <p className="text-[11px] leading-relaxed text-neutral-400">{copy.note}</p>
      </div>
    </div>
  );
}
