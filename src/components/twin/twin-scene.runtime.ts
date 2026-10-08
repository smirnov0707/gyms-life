import {
  ACESFilmicToneMapping,
  Box3,
  CanvasTexture,
  CircleGeometry,
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
  clampTwinTargetY,
  moveTwinTargetY,
  twinCameraKey,
  twinNearSideReach,
  twinPresetDistance,
} from "./twin-camera.navigation";
import { TWIN_SKIN_COLOR, twinSurfaceStyle } from "./twin-surface.style";
import { setTwinAnatomySelection } from "./twin-anatomy.material";
import { createTwinStageDecor } from "./twin-stage.scene";
import { createTwinCameraFrame } from "./twin-camera.framing";
import type { TwinBodyProvenance } from "./twin-body.provenance";
import { loadTwinIdentityShell, type TwinIdentityShellModel } from "./twin-identity-shell.loader";
import {
  loadTwinHuman,
  twinHumanUrl,
  type TwinBodyModel,
  type TwinHumanVariant,
  type TwinVisualAppearance,
} from "./twin-human.loader";
import {
  TWIN_CAMERA,
  TWIN_FIELD_OF_VIEW,
  TWIN_FRAME,
  fittedTwinDistance,
  isTwinBodyRegion,
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
  focus: (region: string | null) => void;
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
    visualAppearance?: TwinVisualAppearance;
    /** Short-lived private URL for a visual Identity Shell. Never carries evidence regions. */
    identityModelUrl?: string | null;
    /**
     * Fires once there is a body in the scene, and says which one. Until then
     * the stage has nothing to show and keeps its 2D map up.
     */
    onBodyReady?: (
      kind: "human" | "identity" | "surface",
      provenance: TwinBodyProvenance | null,
    ) => void;
    onIdentityShellFallback?: (reason: "load_failed" | "invalid_geometry" | "expired_url") => void;
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
    // Neutral studio exposure keeps skin readable in both UI themes.
    const appearance = options.visualAppearance ?? "analysis";
    renderer.toneMappingExposure = 1.02;
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
    // Start with the fallback frame. Once the actual GLB arrives, measure
    // that geometry and replace both the target and fit distance together.
    const target = new Vector3(0, TWIN_FRAME.eyeHeight, 0);
    let fitDistance = fittedTwinDistance(0.7);
    let bodyFrame: ReturnType<typeof createTwinCameraFrame> | null = null;
    camera.position.set(0, TWIN_FRAME.eyeHeight, fitDistance);
    const controls = new OrbitControls(camera, canvas);
    cleanups.push(() => controls.dispose());
    controls.target.copy(target);
    controls.enablePan = true;
    controls.screenSpacePanning = true;
    controls.panSpeed = 0.75;
    controls.enableDamping = true;
    controls.dampingFactor = 0.12;
    controls.rotateSpeed = 0.65;
    controls.zoomSpeed = 0.75;
    controls.minPolarAngle = TWIN_CAMERA.minPitch;
    controls.maxPolarAngle = TWIN_CAMERA.maxPitch;
    // No azimuth limits: horizontal orbit stays genuinely 360 degrees.
    controls.touches = { ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_PAN };

    // Broad neutral key and fill preserve warm skin on front AND back views.
    // The apparatus stays cool; it no longer dictates the body's colour.
    scene.add(new HemisphereLight(0xfff1e5, 0x44322d, 1.1));
    const lights = [
      [[1.8, 2.8, 2.6], 0xfff3e8, 2.1],
      [[-2.4, 1.25, 1.8], 0xe6f4ff, 1.0],
      [[-1.8, 1.9, -3.0], 0xe4f1ff, 1.5],
      [[2.2, 1.4, -2.6], 0xffe8d8, 1.05],
    ] as const;
    for (const [position, color, intensity] of lights) {
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

    let model: TwinBodyModel | TwinIdentityShellModel | ReturnType<typeof createTwinBody> =
      createTwinBody();
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
    canvas.dataset["twinAppearance"] = appearance;
    const useSurface = () => {
      // An aborted fetch may reject after unmount. Never revive a disposed scene.
      if (destroyed || !humanPending) return;
      humanPending = false;
      twinBodyRoot.add(model.body);
      frameBody(createTwinCameraFrame(model.body));
      showStage();
      canvas.dataset["twinBody"] = "surface";
      canvas.dataset["twinSource"] = "generated";
      applyState();
      options.onBodyReady?.("surface", null);
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
      const identityUrl = appearance === "realistic" ? options.identityModelUrl : null;
      const humanPromise = identityUrl
        ? loadTwinIdentityShell(identityUrl, humanLoad.signal).catch(() =>
            loadTwinHuman(
              twinHumanUrl(options.humanVariant ?? "male", appearance),
              humanLoad.signal,
              appearance,
            ),
          )
        : loadTwinHuman(
            twinHumanUrl(options.humanVariant ?? "male", appearance),
            humanLoad.signal,
            appearance,
          );
      void humanPromise
        .then((human) => {
          if (destroyed || humanLoad.signal.aborted) {
            human.dispose();
            return;
          }
          let nextFrame: ReturnType<typeof createTwinCameraFrame>;
          try {
            nextFrame = createTwinCameraFrame(human.body);
          } catch {
            human.dispose();
            window.clearTimeout(surfaceTimer);
            useSurface();
            return;
          }
          window.clearTimeout(surfaceTimer);
          // The stand-in never entered the scene; dispose it and put the real
          // figure in its place.
          twinBodyRoot.remove(model.body);
          model.dispose();
          model = human;
          twinBodyRoot.add(model.body);
          // Preserve the orbit/zoom when replacing a late fallback; only the
          // frame changes. The geometry itself and its proportions do not.
          frameBody(nextFrame);
          showStage();
          humanPending = false;
          if ("provenance" in human) {
            canvas.dataset["twinBody"] = "human";
            canvas.dataset["twinSource"] = human.provenance.source;
            canvas.dataset["twinAssetSha256"] = human.provenance.sha256;
            options.onBodyReady?.("human", human.provenance);
          } else {
            canvas.dataset["twinBody"] = "identity";
            canvas.dataset["twinSource"] = "personalized_identity";
            delete canvas.dataset["twinAssetSha256"];
            options.onBodyReady?.("identity", null);
          }
          applyState();
        })
        .catch((error) => {
          if (options.identityModelUrl && appearance === "realistic") {
            const reason =
              error instanceof Error && error.message.includes("camera frame")
                ? "invalid_geometry"
                : error instanceof Error && /401|403/.test(error.message)
                  ? "expired_url"
                  : "load_failed";
            options.onIdentityShellFallback?.(reason);
          }
          // Keep the canonical fallback visible; identity-shell failure must
          // never remove the athlete's evidence view.
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
      canvas.dataset["twinPitch"] = controls.getPolarAngle().toFixed(3);
      canvas.dataset["twinTargetY"] = controls.target.y.toFixed(4);
      canvas.dataset["twinTargetX"] = controls.target.x.toFixed(4);
      canvas.dataset["twinTargetZ"] = controls.target.z.toFixed(4);
      canvas.dataset["twinHomeY"] = target.y.toFixed(4);
      canvas.dataset["twinFitDistance"] = fitDistance.toFixed(4);
      canvas.dataset["twinFrames"] = String(++frames);
      if (moving) requestRender();
    }
    function constrainTarget() {
      // Vertical-only pan: retain the body's orbit axis and move the camera by
      // the same correction. Never let a two-finger gesture lose the body.
      const y = clampTwinTargetY(
        controls.target.y,
        bodyFrame?.height ?? TWIN_FRAME.height,
        target.y,
      );
      const correction = new Vector3(
        target.x - controls.target.x,
        y - controls.target.y,
        target.z - controls.target.z,
      );
      controls.target.add(correction);
      camera.position.add(correction);
    }
    const controlsChanged = () => {
      constrainTarget();
      requestRender();
    };
    controls.addEventListener("change", controlsChanged);
    cleanups.push(() => controls.removeEventListener("change", controlsChanged));

    function applyState() {
      canvas.dataset["twinLayer"] = state.layer;
      const base = "baseColorOf" in model ? model.baseColorOf : null;
      for (const [id, meshes] of model.regionMeshes) {
        const value = state.regions.find((region) => region.id === id);
        const selected = selectedRegion === id;
        for (const mesh of meshes) {
          const material = mesh.material as MeshStandardMaterial;
          const style = twinSurfaceStyle({
            tone: value?.display.tone ?? "unknown",
            selected,
            hasSelection: isTwinBodyRegion(selectedRegion ?? ""),
            appearance,
            baseColor: base?.get(mesh) ?? TWIN_SKIN_COLOR,
          });
          material.color.copy(style.color);
          material.emissive.copy(style.emissive);
          material.emissiveIntensity = style.emissiveIntensity;
          material.roughness = style.roughness;
          material.metalness = style.metalness;
          setTwinAnatomySelection(material, selected);
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
      const nextY = moveTwinTargetY(
        controls.target.y,
        action,
        bodyFrame?.height ?? TWIN_FRAME.height,
        target.y,
      );
      if (action === "reset" || action === "upper-body" || action === "lower-body")
        controls.target.copy(target);
      controls.target.y = nextY;
      const presetDistance = twinPresetDistance(action, fitDistance);
      if (presetDistance !== undefined) next.distance = presetDistance;
      camera.position
        .copy(controls.target)
        .add(new Vector3().setFromSpherical(new Spherical(next.distance, next.pitch, next.yaw)));
      controls.update();
      controls.enableDamping = !reducedMotion.matches;
      requestRender();
    };
    const focus = (region: string | null) => {
      if (!region || !isTwinBodyRegion(region)) return;
      const surfaces = model.regionMeshes.get(region);
      if (!surfaces?.length) return;
      twinBodyRoot.updateMatrixWorld(true);
      const bounds = new Box3();
      for (const surface of surfaces) bounds.union(new Box3().setFromObject(surface));
      if (bounds.isEmpty()) return;
      const size = bounds.getSize(new Vector3());
      const centre = bounds.getCenter(new Vector3());
      controls.enableDamping = false;
      controls.update();
      // Keep the orbit axis inside the body, so the near-side picking cutoff
      // still rejects hits through a gap onto the opposite side.
      controls.target.set(
        target.x,
        clampTwinTargetY(centre.y, bodyFrame?.height ?? TWIN_FRAME.height, target.y),
        target.z,
      );
      const tangent = Math.tan((TWIN_FIELD_OF_VIEW * Math.PI) / 360);
      const distance = (Math.max(size.y, size.x / camera.aspect) * 0.68) / tangent + size.z;
      const yaw = region === "back" || region === "glutes" ? Math.PI : 0;
      controls.enableDamping = false;
      camera.position
        .copy(controls.target)
        .add(
          new Vector3().setFromSpherical(
            new Spherical(
              Math.max(controls.minDistance, Math.min(fitDistance, distance)),
              Math.PI / 2,
              yaw,
            ),
          ),
        );
      controls.update();
      controls.enableDamping = !reducedMotion.matches;
      requestRender();
    };
    const resize = () => {
      if (destroyed || host.clientWidth < 1 || host.clientHeight < 1) return;
      const relativeDistance = controls.getDistance() / fitDistance;
      camera.aspect = host.clientWidth / host.clientHeight;
      fitDistance = bodyFrame?.fitDistance(camera.aspect) ?? fittedTwinDistance(camera.aspect);
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
    function frameBody(nextFrame: ReturnType<typeof createTwinCameraFrame>) {
      const offset = camera.position.clone().sub(controls.target);
      bodyFrame = nextFrame;
      target.copy(nextFrame.target);
      controls.target.copy(target);
      camera.position.copy(target).add(offset);
      canvas.dataset["twinBodyHeight"] = nextFrame.height.toFixed(6);
      resize();
    }
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
      const reach = twinNearSideReach(raycaster.ray, camera.position, target);
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
      const action = twinCameraKey(event);
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
      focus,
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
