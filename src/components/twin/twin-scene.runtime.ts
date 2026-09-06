import {
  ACESFilmicToneMapping,
  Color,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Raycaster,
  Scene,
  Spherical,
  SRGBColorSpace,
  TOUCH,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createTwinBody } from "./twin-body.geometry";
import { HUMAN_ASSET_CANDIDATE } from "./human-asset.config";
import type { HumanBodyHandle } from "./human-body.loader";

export type HumanAppearanceStatus = "schematic" | "loading" | "ready" | "failed";
import {
  TWIN_CAMERA,
  TWIN_DISPLAY_COLORS,
  fittedTwinDistance,
  isTwinTap,
  moveTwinCamera,
  shouldAnimateTwin,
  type TwinBodyRegion,
  type TwinCameraCommand,
  type TwinSceneState,
} from "./twin-scene.model";

export type TwinSceneHandle = {
  setState: (state: TwinSceneState) => void;
  select: (region: string | null) => void;
  command: (command: TwinCameraCommand) => void;
  setMotion: (enabled: boolean) => void;
  setAppearance: (human: boolean) => void;
  setNatural: (natural: boolean) => void;
  dispose: () => void;
};

/** Browser-only module, loaded on demand. Owns no user data or business rules. */
export function mountTwinScene(
  host: HTMLElement,
  options: {
    state: TwinSceneState;
    selectedRegion: string | null;
    label: string;
    onSelect: (region: TwinBodyRegion) => void;
    onFailure: () => void;
    onAppearanceStatus?: (status: HumanAppearanceStatus) => void;
  },
): TwinSceneHandle {
  const cleanups: Array<() => void> = [];
  let destroyed = false;
  let frameId = 0;
  const dispose = () => {
    if (destroyed) return;
    destroyed = true;
    cancelAnimationFrame(frameId);
    for (const cleanup of cleanups.reverse()) cleanup();
  };
  try {
    const renderer = new WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "low-power",
    });
    cleanups.push(() => {
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    });
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.setClearColor(0x050706, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    const canvas = renderer.domElement;
    canvas.style.cssText =
      "width:100%;height:100%;display:block;touch-action:none;cursor:grab;outline-offset:-3px";
    canvas.tabIndex = 0;
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", options.label);
    canvas.dataset["twinRenderer"] = "three";
    host.append(canvas);

    const scene = new Scene();
    const camera = new PerspectiveCamera(35, 1, 0.01, 40);
    const target = new Vector3(0, 0.95, 0);
    let fitDistance = fittedTwinDistance(0.7);
    camera.position.set(0, 1.15, fitDistance);
    const controls = new OrbitControls(camera, canvas);
    cleanups.push(() => controls.dispose());
    controls.target.copy(target);
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.12;
    controls.rotateSpeed = 0.65;
    controls.zoomSpeed = 0.75;
    controls.minPolarAngle = TWIN_CAMERA.minPitch;
    controls.maxPolarAngle = TWIN_CAMERA.maxPitch;
    // No azimuth limits: horizontal orbit stays genuinely 360 degrees.
    controls.touches = { ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_PAN };

    const ambient = new HemisphereLight(0xf1f7ff, 0x14201c, 1.6);
    scene.add(ambient);
    const studioLights: DirectionalLight[] = [];
    for (const [position, color, intensity] of [
      [[2, 3, 4], 0xfff1db, 2.2],
      [[-3, 1.7, 1], 0x9ccbe7, 0.9],
      [[0, 2.8, -3], 0xc4f0dd, 2.0],
    ] as const) {
      const light = new DirectionalLight(color, intensity);
      light.position.set(position[0], position[1], position[2]);
      scene.add(light);
      studioLights.push(light);
    }
    let model: ReturnType<typeof createTwinBody> | HumanBodyHandle = createTwinBody();
    let humanModel: HumanBodyHandle | null = null;
    let humanRequest: AbortController | null = null;
    let humanTimer: number | null = null;
    let natural = true;
    cleanups.push(() => {
      humanRequest?.abort();
      if (humanTimer !== null) window.clearTimeout(humanTimer);
    });
    cleanups.push(() => {
      model.dispose();
      scene.clear();
    });
    scene.add(model.body);
    let state = options.state;
    let selectedRegion = options.selectedRegion;
    let motionEnabled = true;
    let inspecting = false;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let inView = true;
    let lastPaint = 0;
    let frames = 0;

    function visible() {
      if (document.hidden || destroyed) return false;
      if (inView) return true;
      // IntersectionObserver is asynchronous. Disclosure/scroll transitions
      // can leave its last report behind the layout when a user gives a
      // camera command. Recheck only the negative cache before rejecting it.
      const bounds = host.getBoundingClientRect();
      return (
        bounds.width > 0 &&
        bounds.height > 0 &&
        bounds.bottom > 0 &&
        bounds.right > 0 &&
        bounds.top < window.innerHeight &&
        bounds.left < window.innerWidth
      );
    }
    function requestRender() {
      if (!frameId && visible()) frameId = requestAnimationFrame(paint);
    }
    function paint(time: number) {
      frameId = 0;
      if (!visible()) return;
      const moving =
        shouldAnimateTwin(true, reducedMotion.matches, motionEnabled) &&
        (humanModel
          ? !inspecting && selectedRegion === null
          : state.dataAvailable && state.regions.some((region) => region.display.value !== null));
      if (moving && time - lastPaint < 1000 / 30) {
        requestRender();
        return;
      }
      lastPaint = time;
      // Decorative micro-sway only. Never synced to heart rate or breathing.
      model.body.rotation.z = moving ? Math.sin(time / 2700) * 0.003 : 0;
      controls.update();
      try {
        renderer.render(scene, camera);
      } catch {
        options.onFailure();
        dispose();
        return;
      }
      canvas.dataset["twinDrawCalls"] = String(renderer.info.render.calls);
      canvas.dataset["twinTriangles"] = String(renderer.info.render.triangles);
      canvas.dataset["twinYaw"] = controls.getAzimuthalAngle().toFixed(3);
      canvas.dataset["twinDistance"] = controls.getDistance().toFixed(3);
      canvas.dataset["twinFrames"] = String(++frames);
      if (moving) requestRender();
    }
    const inspectStart = () => {
      inspecting = true;
      requestRender();
    };
    const inspectEnd = () => {
      inspecting = false;
      requestRender();
    };
    controls.addEventListener("start", inspectStart);
    controls.addEventListener("end", inspectEnd);
    cleanups.push(() => {
      controls.removeEventListener("start", inspectStart);
      controls.removeEventListener("end", inspectEnd);
    });
    controls.addEventListener("change", requestRender);
    cleanups.push(() => controls.removeEventListener("change", requestRender));

    function applyState() {
      canvas.dataset["twinLayer"] = state.layer;
      ambient.color.set(humanModel ? 0xf3f4f7 : 0xf1f7ff);
      ambient.groundColor.set(humanModel ? 0x625950 : 0x14201c);
      ambient.intensity = humanModel ? 1.15 : 1.6;
      studioLights.forEach((light, index) => {
        light.color.set(
          humanModel
            ? [0xfff6ed, 0xe8f1ff, 0xf2f5ff][index]!
            : [0xfff1db, 0x9ccbe7, 0xc4f0dd][index]!,
        );
        light.intensity = humanModel ? [1.8, 1.05, 1.6][index]! : [2.2, 0.9, 2.0][index]!;
      });
      canvas.dataset["twinAppearance"] = humanModel ? "human" : "schematic";
      canvas.dataset["twinNatural"] = String(Boolean(humanModel && natural));
      if (humanModel) {
        humanModel.applyDisplay(state, selectedRegion, natural);
        requestRender();
        return;
      }
      for (const [id, meshes] of model.regionMeshes) {
        const value = state.regions.find((region) => region.id === id);
        const color = new Color("#48565d").lerp(
          new Color(TWIN_DISPLAY_COLORS[value?.display.tone ?? "unknown"]),
          0.55,
        );
        for (const mesh of meshes) {
          const material = mesh.material as MeshStandardMaterial;
          material.color.copy(color);
          const selected = selectedRegion === id;
          material.emissive.set(selected ? "#bcefe3" : "#000000");
          material.emissiveIntensity = selected ? 0.22 : 0;
          material.roughness = selected ? 0.36 : 0.48;
        }
      }
      requestRender();
    }
    const setAppearance = (human: boolean) => {
      humanRequest?.abort();
      if (humanTimer !== null) window.clearTimeout(humanTimer);
      humanTimer = null;
      humanRequest = null;
      if (destroyed) return;
      if (!human) {
        if (humanModel) {
          scene.remove(model.body);
          model.dispose();
          model = createTwinBody();
          humanModel = null;
          scene.add(model.body);
        }
        options.onAppearanceStatus?.("schematic");
        applyState();
        return;
      }
      if (humanModel) {
        options.onAppearanceStatus?.("ready");
        return;
      }
      const request = new AbortController();
      humanRequest = request;
      options.onAppearanceStatus?.("loading");
      const timer = window.setTimeout(() => {
        if (humanRequest !== request || destroyed) return;
        request.abort();
        humanRequest = null;
        options.onAppearanceStatus?.("failed");
      }, 15000);
      humanTimer = timer;
      void import("./human-body.loader")
        .then(({ loadHumanBody }) => loadHumanBody(HUMAN_ASSET_CANDIDATE, request.signal))
        .then((loaded) => {
          if (destroyed || request.signal.aborted || humanRequest !== request) {
            loaded.dispose();
            return;
          }
          scene.remove(model.body);
          model.dispose();
          model = loaded;
          humanModel = loaded;
          humanRequest = null;
          scene.add(loaded.body);
          canvas.dataset["humanTriangles"] = String(loaded.metrics.triangles);
          canvas.dataset["humanBytes"] = String(loaded.metrics.bytes);
          options.onAppearanceStatus?.("ready");
          applyState();
        })
        .catch(() => {
          if (!destroyed && !request.signal.aborted && humanRequest === request) {
            humanRequest = null;
            options.onAppearanceStatus?.("failed");
          }
        })
        .finally(() => {
          window.clearTimeout(timer);
          if (humanTimer === timer) humanTimer = null;
        });
    };
    const command = (action: TwinCameraCommand) => {
      // Clear residual damping so a preset never keeps drifting afterwards.
      controls.enableDamping = false;
      controls.update();
      const next = moveTwinCamera(
        {
          yaw: controls.getAzimuthalAngle(),
          pitch: controls.getPolarAngle(),
          distance: controls.getDistance(),
        },
        action,
        fitDistance,
      );
      camera.position
        .copy(controls.target)
        .add(new Vector3().setFromSpherical(new Spherical(next.distance, next.pitch, next.yaw)));
      controls.update();
      controls.enableDamping = !reducedMotion.matches;
      requestRender();
    };
    const resize = () => {
      if (destroyed || host.clientWidth < 1 || host.clientHeight < 1) return;
      const relativeDistance = controls.getDistance() / fitDistance;
      camera.aspect = host.clientWidth / host.clientHeight;
      fitDistance = fittedTwinDistance(camera.aspect);
      controls.minDistance = fitDistance * TWIN_CAMERA.minDistanceRatio;
      controls.maxDistance = fitDistance * TWIN_CAMERA.maxDistanceRatio;
      camera.position
        .sub(controls.target)
        .setLength(fitDistance * relativeDistance)
        .add(controls.target);
      camera.updateProjectionMatrix();
      renderer.setSize(host.clientWidth, host.clientHeight, false);
      controls.update();
      requestRender();
    };
    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(resize);
      observer.observe(host);
      cleanups.push(() => observer.disconnect());
    } else {
      window.addEventListener("resize", resize);
      cleanups.push(() => window.removeEventListener("resize", resize));
    }
    if (typeof IntersectionObserver !== "undefined") {
      const observer = new IntersectionObserver((entries) => {
        const entry = entries
          .filter((candidate) => candidate.target === host)
          .sort((left, right) => right.time - left.time)[0];
        if (!entry) return;
        inView = entry.isIntersecting;
        if (!visible()) {
          cancelAnimationFrame(frameId);
          frameId = 0;
        } else requestRender();
      });
      observer.observe(host);
      cleanups.push(() => observer.disconnect());
    }
    const visibilityChange = () => {
      if (document.hidden) {
        cancelAnimationFrame(frameId);
        frameId = 0;
      } else requestRender();
    };
    const motionChange = () => {
      controls.enableDamping = !reducedMotion.matches;
      requestRender();
    };
    document.addEventListener("visibilitychange", visibilityChange);
    reducedMotion.addEventListener("change", motionChange);
    cleanups.push(() => document.removeEventListener("visibilitychange", visibilityChange));
    cleanups.push(() => reducedMotion.removeEventListener("change", motionChange));
    motionChange();

    const pointers = new Map<number, { x: number; y: number }>();
    let maxTravel = 0;
    let multiplePointers = false;
    const down = (event: PointerEvent) => {
      if (pointers.size === 0) {
        maxTravel = 0;
        multiplePointers = false;
      }
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.size > 1) multiplePointers = true;
      canvas.focus({ preventScroll: true });
    };
    const move = (event: PointerEvent) => {
      const start = pointers.get(event.pointerId);
      if (start)
        maxTravel = Math.max(
          maxTravel,
          Math.hypot(event.clientX - start.x, event.clientY - start.y),
        );
    };
    const raycaster = new Raycaster();
    const up = (event: PointerEvent) => {
      move(event);
      const start = pointers.get(event.pointerId);
      pointers.delete(event.pointerId);
      if (!start || event.button !== 0 || !isTwinTap(maxTravel, multiplePointers)) return;
      const rect = canvas.getBoundingClientRect();
      raycaster.setFromCamera(
        new Vector2(
          ((event.clientX - rect.left) / rect.width) * 2 - 1,
          -((event.clientY - rect.top) / rect.height) * 2 + 1,
        ),
        camera,
      );
      model.body.updateMatrixWorld(true);
      // Test the nearest surface, including neutral geometry. Never select through the body.
      const first = raycaster.intersectObjects(model.meshes, false)[0];
      const region = first?.object instanceof Mesh ? model.regionOf.get(first.object) : undefined;
      if (region) options.onSelect(region);
    };
    const cancel = (event: PointerEvent) => {
      pointers.delete(event.pointerId);
      multiplePointers = true;
    };
    const key = (event: KeyboardEvent) => {
      const action: TwinCameraCommand | undefined = (
        {
          ArrowLeft: "rotate-left",
          ArrowRight: "rotate-right",
          "+": "zoom-in",
          "=": "zoom-in",
          "-": "zoom-out",
          Home: "reset",
        } as Record<string, TwinCameraCommand>
      )[event.key];
      if (action) {
        event.preventDefault();
        command(action);
      }
    };
    const lost = (event: Event) => {
      event.preventDefault();
      options.onFailure();
      dispose();
    };
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", cancel);
    canvas.addEventListener("keydown", key);
    canvas.addEventListener("webglcontextlost", lost);
    cleanups.push(() => {
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", cancel);
      canvas.removeEventListener("keydown", key);
      canvas.removeEventListener("webglcontextlost", lost);
    });
    resize();
    command("reset");
    applyState();
    return {
      setState(next) {
        state = next;
        applyState();
      },
      select(region) {
        selectedRegion = region;
        applyState();
      },
      command,
      setMotion(enabled) {
        motionEnabled = enabled;
        requestRender();
      },
      setAppearance,
      setNatural(value) {
        natural = value;
        applyState();
      },
      dispose,
    };
  } catch (error) {
    dispose();
    throw error;
  }
}
