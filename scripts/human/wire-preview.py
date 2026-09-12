"""One-time guarded integration, removed from the final candidate by the build job."""
from pathlib import Path
import hashlib

def source(name, expected):
    p=Path(name); raw=p.read_bytes()
    sha=hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest()
    if sha != expected: raise RuntimeError('Concurrent source changed: '+name)
    return p,raw.decode()

def replace(s, old, new):
    if s.count(old)!=1: raise RuntimeError('Expected unique integration anchor: '+old[:70])
    return s.replace(old,new)

p,s=source('src/components/twin/twin-scene.runtime.ts','a1d66eb0bc1c78e5d9f64d02d82692a4fd198140')
s=replace(s,'import { createTwinBody }','import type { HumanAppearance, HumanTwinBody } from "./twin-human.asset";\nimport { createTwinBody }')
s=replace(s,'  setMotion: (enabled: boolean) => void;','  setMotion: (enabled: boolean) => void;\n  setAppearance: (appearance: HumanAppearance) => void;')
s=replace(s,'    state: TwinSceneState;','    humanBody?: HumanTwinBody;\n    appearance?: HumanAppearance;\n    state: TwinSceneState;')
s=replace(s,'    const model = createTwinBody();','''    if (options.humanBody) {
      for (const child of [...scene.children]) {
        if (child instanceof DirectionalLight || child instanceof HemisphereLight) scene.remove(child);
      }
      scene.add(new HemisphereLight(0xe8eef5, 0x6d6460, 1.6));
      for (const [x,y,z,intensity] of [[2,3,4,2.0],[-3,2,2,1.3],[1,2.7,-3,1.7]] as const) {
        const light = new DirectionalLight(0xffffff, intensity);
        light.position.set(x,y,z); scene.add(light);
      }
    }
    const model = options.humanBody ?? createTwinBody();
    let appearance: HumanAppearance = options.appearance ?? "natural";
    canvas.dataset["twinModel"] = options.humanBody ? "cc0-human" : "schematic";''')
s=replace(s,'    let lastPaint = 0;','''    let interacting = false;
    const interactionStart = () => { interacting = true; requestRender(); };
    const interactionEnd = () => { interacting = false; requestRender(); };
    controls.addEventListener("start", interactionStart);
    controls.addEventListener("end", interactionEnd);
    cleanups.push(() => {
      controls.removeEventListener("start", interactionStart);
      controls.removeEventListener("end", interactionEnd);
    });
    let lastPaint = 0;''')
s=replace(s,'        state.dataAvailable &&\n        state.regions.some((region) => region.display.value !== null);','''        !interacting &&
        (Boolean(options.humanBody) || (state.dataAvailable && state.regions.some((region) => region.display.value !== null)));''')
s=replace(s,'        renderer.render(scene, camera);','''        renderer.render(scene, camera);
        canvas.dataset["twinDrawCalls"] = String(renderer.info.render.calls);
        canvas.dataset["twinTriangles"] = String(renderer.info.render.triangles);''')
s=replace(s,'      canvas.dataset["twinLayer"] = state.layer;','''      canvas.dataset["twinLayer"] = state.layer;
      canvas.dataset["twinAppearance"] = appearance;
      if (options.humanBody) {
        options.humanBody.applyAppearance(state, selectedRegion, appearance);
        requestRender(); return;
      }''')
s=replace(s,'      setMotion(enabled) {','''      setAppearance(next) { appearance = next; applyState(); },
      setMotion(enabled) {''')
p.write_text(s)

p,s=source('src/components/twin/TwinStage.tsx','7a2868e9fcfb46bba461a930f982316c2d4a7659')
s=replace(s,'import type { TwinSceneHandle }','import type { HumanAppearance, HumanTwinBody } from "./twin-human.asset";\nimport type { TwinSceneHandle }')
s=replace(s,'  snapshot: TwinSnapshot;','  humanPreview?: boolean;\n  snapshot: TwinSnapshot;')
s=replace(s,'  const copy = COPY[language];','''  const humanEnabled = props.humanPreview ?? import.meta.env["VITE_TWIN_HUMAN_PREVIEW"] === "true";
  const [appearance, setAppearance] = useState<HumanAppearance>("natural");
  const appearanceRef = useRef(appearance);
  appearanceRef.current = appearance;
  const copy = COPY[language];''')
s=replace(s,'    let timedOut = false;','    let timedOut = false;\n    const controller = new AbortController();\n    let pendingBody: HumanTwinBody | undefined;')
s=replace(s,'      scene.current?.dispose();\n      scene.current = null;\n      setFailed(true);','      controller.abort();\n      scene.current?.dispose();\n      pendingBody?.dispose();\n      scene.current = null;\n      setFailed(true);')
s=replace(s,'      .then(({ mountTwinScene }) => {\n        if (cancelled || timedOut) return;','''      .then(async ({ mountTwinScene }) => {
        if (cancelled || timedOut) return;
        if (humanEnabled) {
          const { loadHumanTwinBody } = await import("./twin-human.asset");
          pendingBody = await loadHumanTwinBody(controller.signal);
        }
        if (cancelled || timedOut) { pendingBody?.dispose(); return; }''')
s=replace(s,'        const handle = mountTwinScene(target, {','''        const handle = mountTwinScene(target, {
          ...(pendingBody ? { humanBody: pendingBody, appearance: appearanceRef.current } : {}),''')
s=replace(s,'          label: COPY[current.language].scene,','''          label: humanEnabled
            ? current.language === "lt" ? "Bendrinis žmogus. Tempk ir suk 360 laipsnių; mastelį keisk dviem pirštais." : "Generic adult human. Drag to rotate 360 degrees; pinch to zoom."
            : COPY[current.language].scene,''')
s=replace(s,'      cancelled = true;','      cancelled = true;\n      controller.abort();\n      pendingBody?.dispose();')
s=replace(s,'  }, [mode, attempt]);','  }, [mode, attempt, humanEnabled]);\n\n  useEffect(() => { scene.current?.setAppearance(appearance); }, [appearance]);')
s=replace(s,'        <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">\n          {layerCopy.unit[layer]}\n        </p>','''        {humanEnabled && mode === "3d" && !failed ? (
          <button type="button" style={controlStyle} className={controlClass}
            aria-pressed={appearance === "evidence"}
            onClick={() => setAppearance((current) => current === "natural" ? "evidence" : "natural")}>
            {language === "lt" ? "Duomenų spalvos" : "Evidence colours"}
          </button>
        ) : (
          <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">{layerCopy.unit[layer]}</p>
        )}''')
s=replace(s,'className="relative h-[clamp(240px,calc(100svh_-_580px),540px)] w-full lg:h-[540px]"','className={`relative w-full lg:h-[540px] ${humanEnabled ? "h-[clamp(330px,calc(100svh_-_430px),540px)]" : "h-[clamp(240px,calc(100svh_-_580px),540px)]"}`}')
s=replace(s,'      {failed && mode === "3d" && (','''      {humanEnabled && !failed && mode === "3d" && (
        <p className="px-3 text-[11px] leading-relaxed text-neutral-300" data-human-disclaimer>
          {language === "lt" ? "Bendrinis žmogus, ne tavo kūno skenavimas." : "Generic human, not a scan of your body."}
        </p>
      )}
      {failed && mode === "3d" && (''')
s=replace(s,'{copy.note}','''{humanEnabled
          ? language === "lt" ? "Bendrinis suaugusio žmogaus modelis. Judesys dekoratyvus, ne biometrinis signalas." : "Generic adult human. Motion is decorative, not a biometric signal."
          : copy.note}''')
p.write_text(s)
