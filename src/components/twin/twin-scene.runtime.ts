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
import { createTwinStageDecor } from "./twin-stage.scene";
import {
  loadTwinHuman,
  twinHumanUrl,
  type TwinBodyModel,
  type TwinHumanVariant,
} from "./twin-human.loader";
import {
  TWIN_CAMERA,
  TWIN_DISPLAY_COLORS,
  TWIN_FIELD_OF_VIEW,
  TWIN_FRAME,
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

/**
 * How long to wait for the figure before falling back to the generated
 * surface. Generous: on a gym connection the file is worth waiting for, and
 * the athlete is looking at their real data on the 2D map meanwhile.
 */
const TWIN_BODY_TIMEOUT_MS = 20_000;

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
    /**
     * Fires once there is a body in the scene, and says which one. Until then
     * the stage has nothing to show and keeps its 2D map up.
     */
    onBodyReady?: (kind: "human" | "surface") => void;
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
    // Under one, deliberately. The data colours are saturated and the key is
    // strong, and at neutral exposure the figure came out pastel — every
    // muscle the same washed lilac rather than the deep violet the screen is
    // drawn in. Pulling the exposure down puts the range back into the colour.
    renderer.toneMappingExposure = 0.86;
    renderer.setClearColor(0x040a14, 0);
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
    const camera = new PerspectiveCamera(TWIN_FIELD_OF_VIEW, 1, 0.01, 40);
    // One height for both: the camera looks at the point the frame is
    // measured from, so what fittedTwinDistance promises to fit is what the
    // canvas actually shows.
    const target = new Vector3(0, TWIN_FRAME.eyeHeight, 0);
    let fitDistance = fittedTwinDistance(0.7);
    camera.position.set(0, TWIN_FRAME.eyeHeight, fitDistance);
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

    // Lit for a dark instrument rather than for skin: a cool ambient that keeps
    // the unlit body readable as a body, a cold key that models the form, and
    // two rims — one cyan behind and one violet from the side — that draw the
    // silhouette out of the stage. It was warm and bright while the figure was
    // skin-coloured; a warm key on a near-black body just makes it grey.
    scene.add(new HemisphereLight(0x8fb4dc, 0x080e16, 0.26));
    for (const [position, color, intensity] of [
      // The key, high and slightly to the front, which is what models a muscle
      // belly. Kept modest: the data colour is emissive, so a bright key on top
      // of it flattens the very thing it is there to shape.
      [[1.8, 2.8, 2.6], 0xdfeaff, 2.3],
      [[-2.6, 1.0, 1.6], 0x4a7bb0, 0.45],
      // The rim, hard behind and to each side. This is where the figure gets
      // its edge against the stage. A scaled-up inside-out copy of every mesh
      // was tried for that first, and on a body made of a hundred overlapping
      // muscles each copy glows over its neighbours as well as over the stage —
      // the figure came out milky and lost every muscle boundary it had.
      [[-1.6, 1.9, -3.0], 0x3fdcff, 2.2],
      [[2.2, 1.4, -2.6], 0x8f6bff, 1.5],
    ] as const) {
      const light = new DirectionalLight(color, intensity);
      light.position.set(position[0], position[1], position[2]);
      scene.add(light);
    }

    // The apparatus the figure stands in: the lit platform, the rings behind
    // it, the floor grid and the particles. Decoration only — nothing in it
    // reads the athlete's data, and it never changes with it.
    //
    // Built now and shown with the body, not before it. An empty lit platform
    // is a promise that something is about to stand on it, and while the file
    // downloads the athlete is meant to be looking at the 2D map instead.
    const decor = createTwinStageDecor(TWIN_FRAME.height);
    let stageShown = false;
    const showStage = () => {
      if (stageShown) return;
      stageShown = true;
      scene.add(decor.group);
    };
    cleanups.push(() => {
      scene.remove(decor.group);
      decor.dispose();
    });

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

    let model: TwinBodyModel | ReturnType<typeof createTwinBody> = createTwinBody();
    // The generated surface is no longer shown while the figure downloads. It
    // is a mannequin, and for the seconds a 1.2 MB glTF takes on a phone it
    // stood in the athlete's stage looking like their twin. Nothing is added
    // to the scene until the real figure lands; the stage keeps its 2D body
    // map up meanwhile, which is a true view of the same data rather than a
    // body nobody has.
    //
    // The surface remains the fallback, and only then does it carry the
    // reading: if the fetch fails, is unusable, or never arrives, it goes in
    // and is painted. A missing asset must not cost the athlete a Twin.
    let humanPending = options.human !== false;
    if (!humanPending) {
      twinBodyRoot.add(model.body);
      showStage();
    }
    canvas.dataset["twinBody"] = humanPending ? "loading" : "surface";
    const useSurface = () => {
      if (!humanPending) return;
      humanPending = false;
      twinBodyRoot.add(model.body);
      showStage();
      canvas.dataset["twinBody"] = "surface";
      applyState();
      options.onBodyReady?.("surface");
    };
    // A request that neither resolves nor rejects would otherwise leave the
    // athlete on the 2D map indefinitely.
    const surfaceTimer = window.setTimeout(useSurface, TWIN_BODY_TIMEOUT_MS);
    cleanups.push(() => window.clearTimeout(surfaceTimer));
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
          window.clearTimeout(surfaceTimer);
          // The stand-in never entered the scene; dispose it and put the real
          // figure in its place.
          twinBodyRoot.remove(model.body);
          model.dispose();
          model = human;
          twinBodyRoot.add(model.body);
          showStage();
          humanPending = false;
          canvas.dataset["twinBody"] = "human";
          applyState();
          options.onBodyReady?.("human");
        })
        .catch(() => {
          // Deliberately quiet: the surface goes in, and now that it is the
          // answer rather than the wait, it carries the reading.
          window.clearTimeout(surfaceTimer);
          useSurface();
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
      // The body is a dark instrument, so the data colour goes into the
      // surface as well as over it. The old rule — tint a human, never repaint
      // one — existed to protect a skin tone the figure no longer has, and it
      // was the thing keeping every reading off the body: on skin, colour
      // reads as clothing at any strength worth seeing.
      const base = "baseColorOf" in model ? model.baseColorOf : null;
      for (const [id, meshes] of model.regionMeshes) {
        const value = state.regions.find((region) => region.id === id);
        const tone = new Color(TWIN_DISPLAY_COLORS[value?.display.tone ?? "unknown"]);
        const selected = selectedRegion === id;
        for (const mesh of meshes) {
          const material = mesh.material as MeshStandardMaterial;
          const bodyColour = base?.get(mesh);
          if (bodyColour !== undefined) {
            const glow =
              TWIN_TONE_GLOW[value?.display.tone ?? "unknown"] +
              (selected ? TWIN_SELECTION_GLOW : 0);
            // The colour is the surface, and the glow is only a glow.
            //
            // This was the other way round — most of the brightness emissive,
            // the albedo barely tinted — and it cost the figure every muscle
            // it had: an emissive surface is lit by nothing, so the key light
            // had no shading left to do and the body came out as flat pastel
            // panels. A muscle belly reads because it is shaded, so the data
            // colour goes into the albedo and the light does its work on it.
            const lit = glow > 0;
            material.color.set(bodyColour).lerp(tone, lit ? 0.88 : 0);
            material.emissive.copy(tone);
            // Enough to lift a region off the stage and to keep the states in
            // order against each other, not enough to bleach the shading.
            // Divided by the tone's own brightness, so how much a region lights
            // up is set by what it means rather than by how pale its colour
            // happens to be.
            material.emissiveIntensity = lit
              ? ((selected ? 0.34 : 0.22) * glow) / Math.max(tone.r, tone.g, tone.b, 0.25)
              : 0;
            // Wet rather than matte: a low roughness keeps a specular highlight
            // running along each muscle belly, which is what separates one from
            // the next on a body lit from three sides.
            material.roughness = selected ? 0.3 : 0.4;
            material.metalness = 0.12;
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
      // The nearest hit that is a muscle on the side of the body facing the
      // athlete. Two things make that more than "the first intersection".
      //
      // The skin is not a closed surface any more — it is kept only where no
      // muscle lies under it — so a tap can land in a gap between muscles and
      // carry on through the body. Down the sternum it did exactly that and
      // came out on the inside of the spinal muscles, so tapping the middle of
      // the chest answered "back". Anything past the figure's own axis is the
      // far side of it, and you cannot tap what you cannot see.
      //
      // And the skin itself carries no reading, so a hit on a hand or a face
      // is skipped rather than treated as a miss.
      const reach = raycaster.ray.origin.distanceTo(controls.target);
      const region = raycaster
        .intersectObjects(model.meshes, false)
        .filter((hit) => hit.distance <= reach)
        .map((hit) => (hit.object instanceof Mesh ? model.regionOf.get(hit.object) : undefined))
        .find((candidate) => candidate !== undefined);
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
