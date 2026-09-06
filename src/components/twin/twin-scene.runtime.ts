import {
  ACESFilmicToneMapping,
  CanvasTexture,
  CircleGeometry,
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
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
import {
  loadTwinHuman,
  twinHumanUrl,
  type TwinBodyModel,
  type TwinHumanVariant,
} from "./twin-human.loader";
import {
  TWIN_CAMERA,
  TWIN_DISPLAY_COLORS,
  TWIN_SELECTION_GLOW,
  TWIN_TONE_GLOW,
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
  dispose: () => void;
};

/** A radial fade, black at the centre, used as the figure's contact shade. */
function contactShadow(): CanvasTexture | null {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  if (!context) return null;
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, "rgba(0,0,0,0.85)");
  gradient.addColorStop(0.45, "rgba(0,0,0,0.35)");
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  return new CanvasTexture(canvas);
}

/** Browser-only module, loaded on demand. Owns no user data or business rules. */
export function mountTwinScene(
  host: HTMLElement,
  options: {
    state: TwinSceneState;
    selectedRegion: string | null;
    label: string;
    onSelect: (region: TwinBodyRegion) => void;
    onFailure: () => void;
    /** Off switches the anatomical figure back to the generated surface. */
    human?: boolean;
    humanVariant?: TwinHumanVariant;
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
    renderer.toneMappingExposure = 1.05;
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

    // Lit for skin rather than for a matte solid: one warm key that models the
    // form, a dim cool fill so the shadow side is readable without flattening
    // it, and a mint rim behind that separates the silhouette from the dark
    // stage. The earlier setup was three near-equal lights, which washed the
    // body out until it read as plastic.
    scene.add(new HemisphereLight(0xe4eef8, 0x1b1512, 0.55));
    for (const [position, color, intensity] of [
      [[2.2, 3.2, 3.0], 0xffe9d2, 2.05],
      [[-3.0, 1.2, 1.6], 0x8fb4dc, 0.6],
      [[-0.6, 2.4, -3.2], 0xa8f0e0, 1.45],
    ] as const) {
      const light = new DirectionalLight(color, intensity);
      light.position.set(position[0], position[1], position[2]);
      scene.add(light);
    }

    // A body with nothing under it floats. There is no floor in this scene, so
    // the contact is a painted ellipse of shade rather than a shadow map the
    // low-power path cannot afford.
    const shadowTexture = contactShadow();
    const contact = new Mesh(
      new CircleGeometry(0.4, 48),
      new MeshBasicMaterial({
        map: shadowTexture,
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
      }),
    );
    contact.rotation.x = -Math.PI / 2;
    contact.position.y = 0.002;
    contact.scale.set(1, 0.62, 1);
    scene.add(contact);
    cleanups.push(() => {
      contact.geometry.dispose();
      (contact.material as MeshBasicMaterial).dispose();
      shadowTexture?.dispose();
    });
    // One root the camera sway and the raycast both address, so swapping the
    // body underneath cannot leave either of them holding the old object.
    const twinBodyRoot = new Group();
    twinBodyRoot.name = "twin-body-root";
    scene.add(twinBodyRoot);

    // The generated surface paints immediately, with no network involved, so
    // the scene is never blank. The anatomical human replaces it once it has
    // loaded; if that fetch fails, is aborted, or the file is unusable, the
    // surface simply stays. A missing asset must not cost the athlete a Twin.
    let model: TwinBodyModel | ReturnType<typeof createTwinBody> = createTwinBody();
    twinBodyRoot.add(model.body);
    const humanLoad = new AbortController();
    cleanups.push(() => {
      humanLoad.abort();
      model.dispose();
      twinBodyRoot.clear();
      scene.clear();
    });

    if (options.human !== false) {
      void loadTwinHuman(twinHumanUrl(options.humanVariant ?? "male"), humanLoad.signal)
        .then((human) => {
          if (destroyed || humanLoad.signal.aborted) {
            human.dispose();
            return;
          }
          twinBodyRoot.remove(model.body);
          model.dispose();
          model = human;
          twinBodyRoot.add(model.body);
          canvas.dataset["twinBody"] = "human";
          applyState();
        })
        .catch(() => {
          // Deliberately quiet: the surface is already on screen and correct.
          canvas.dataset["twinBody"] = "surface";
        });
    }
    let state = options.state;
    let selectedRegion = options.selectedRegion;
    let motionEnabled = true;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let inView = true;
    let lastPaint = 0;
    let frames = 0;

    function visible() {
      if (document.hidden || destroyed) return false;
      if (inView) return true;
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
        state.dataAvailable &&
        state.regions.some((region) => region.display.value !== null);
      if (moving && time - lastPaint < 1000 / 30) {
        requestRender();
        return;
      }
      lastPaint = time;
      // Visual-only micro-sway. The human surface and analytical hit-map move together.
      twinBodyRoot.rotation.z = moving ? Math.sin(time / 2700) * 0.003 : 0;
      controls.update();
      try {
        renderer.render(scene, camera);
      } catch {
        options.onFailure();
        dispose();
        return;
      }
      canvas.dataset["twinYaw"] = controls.getAzimuthalAngle().toFixed(3);
      canvas.dataset["twinDistance"] = controls.getDistance().toFixed(3);
      canvas.dataset["twinFrames"] = String(++frames);
      if (moving) requestRender();
    }
    controls.addEventListener("change", requestRender);
    cleanups.push(() => controls.removeEventListener("change", requestRender));

    function applyState() {
      canvas.dataset["twinLayer"] = state.layer;
      // A human is tinted, not repainted. Replacing skin with a solid data
      // colour turns the figure back into coloured body parts, so the data
      // colour is mixed lightly into the surface it belongs to and the rest
      // of the reading is carried by selection emphasis and the region panel.
      const base = "baseColorOf" in model ? model.baseColorOf : null;
      for (const [id, meshes] of model.regionMeshes) {
        const value = state.regions.find((region) => region.id === id);
        const tone = new Color(TWIN_DISPLAY_COLORS[value?.display.tone ?? "unknown"]);
        const selected = selectedRegion === id;
        for (const mesh of meshes) {
          const material = mesh.material as MeshStandardMaterial;
          const skin = base?.get(mesh);
          if (skin !== undefined) {
            // Skin keeps its own colour; the state is light cast over it, and
            // brighter the more it wants attention. Mixing the data colour into
            // the albedo instead painted a hard-edged amber block across the
            // torso — the coloured-body-parts look this figure exists to end.
            // Divided by the tone's own brightness so how much a region lights
            // up is set by what it means, not by how pale its colour happens to
            // be. Without it the near-white volume tone burned the pectoral
            // plate to a flat white shape that read as a garment.
            const glow =
              TWIN_TONE_GLOW[value?.display.tone ?? "unknown"] +
              (selected ? TWIN_SELECTION_GLOW : 0);
            // The palette is drawn for small marks on a dark page, so its
            // lighter tones are close to white. Laid on skin as light, white is
            // not a colour — it just bleaches the region into a flat panel — so
            // the body uses the same hue at full saturation instead, and the
            // amount of light is set by the glow alone.
            const hsl = { h: 0, s: 0, l: 0 };
            tone.getHSL(hsl);
            const lit = new Color().setHSL(hsl.h, Math.min(1, hsl.s * 1.6), 0.5);
            material.color.set(skin);
            material.emissive.copy(lit);
            material.emissiveIntensity = glow / Math.max(lit.r, lit.g, lit.b, 0.2);
            material.roughness = selected ? 0.56 : 0.64;
          } else {
            material.color.copy(new Color("#48565d").lerp(tone, 0.55));
            material.emissive.set(selected ? "#bcefe3" : "#000000");
            material.emissiveIntensity = selected ? 0.22 : 0;
            material.roughness = selected ? 0.36 : 0.48;
          }
        }
      }
      requestRender();
    }

    const command = (action: TwinCameraCommand) => {
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
      twinBodyRoot.updateMatrixWorld(true);
      // Picking always uses the stable analytical surface, even when invisible.
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
      dispose,
    };
  } catch (error) {
    dispose();
    throw error;
  }
}
