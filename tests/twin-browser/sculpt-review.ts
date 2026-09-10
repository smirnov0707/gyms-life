// Authoring-only GPU turntable. Synthetic colors, not athlete evidence or an app route.
import {
  Scene,
  Color,
  OrthographicCamera,
  WebGLRenderer,
  AmbientLight,
  DirectionalLight,
  Mesh,
  MeshStandardMaterial,
  Box3,
  Vector3,
  SRGBColorSpace,
  ACESFilmicToneMapping,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  parseTwinSculptContours,
  parseTwinSculptCompetition,
} from "../../src/components/twin/twin-sculpt.contours";
import { createTwinAnatomyMaterial } from "../../src/components/twin/twin-anatomy.material";

async function render() {
  const params = new URLSearchParams(location.search);
  const mode = params.get("mode");
  const torso = params.get("framing") === "torso";
  const loaded = await new GLTFLoader().loadAsync("/review-source.glb");
  const scene = new Scene();
  scene.background = new Color(0x060e17);
  const renderer = new WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(1500, torso ? 750 : 1000);
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  document.body.append(renderer.domElement);
  const bounds = new Box3().setFromObject(loaded.scene),
    size = bounds.getSize(new Vector3());
  const centreY = (bounds.min.y + bounds.max.y) / 2;
  const camera = new OrthographicCamera(-1.56, 1.56, 1.04, -1.04, 0.01, 20);
  camera.position.set(0, centreY, 5);
  camera.lookAt(0, centreY, 0);
  scene.add(new AmbientLight(0xaabdd0, 0.85));
  for (const [x, y, z, intensity] of [
    [2, 3, 3, 2.4],
    [-2, 1, 2, 1.1],
    [-1, 2, -2, 1.3],
  ]) {
    const light = new DirectionalLight(0xd4e8ff, intensity);
    light.position.set(x, y, z);
    scene.add(light);
  }
  const colors: Record<string, number> = {
    chest: 0x9938ee,
    arms: 0x21b3e9,
    shoulders: 0x9938ee,
    legs: 0x21b3e9,
    back: 0x9938ee,
    core: 0xd38443,
    glutes: 0x9938ee,
    abs: 0x21b3e9,
  };
  loaded.scene.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const old = Array.isArray(object.material) ? object.material[0] : object.material;
    const region = old?.name.replace("twin-region:", "") ?? "neutral";
    const parameters = {
      color: mode === "neutral" ? 0x647b8c : (colors[region] ?? 0x354956),
      roughness: 0.58,
      metalness: 0.1,
    };
    object.material =
      mode === "neutral"
        ? new MeshStandardMaterial(parameters)
        : createTwinAnatomyMaterial(parameters, {
            ...(object.userData["twinSculptContours"]
              ? {
                  contours: parseTwinSculptContours(object.userData["twinSculptContours"]),
                  ...(object.userData["twinSculptCompetition"]
                    ? {
                        competition: parseTwinSculptCompetition(
                          object.userData["twinSculptCompetition"],
                        ),
                      }
                    : {}),
                  contourFan: region === "chest" || region === "abs",
                }
              : {}),
            fibers: object.userData["twinFiberUV"] === true,
            regionMask: object.userData["twinRegionMask"] === true,
          });
  });
  let triangleCount = 0;
  if (torso) {
    // Deliberate close-ups: a separate equal viewport per angle, not a crop
    // of a previously rendered screenshot or a claim of whole-body framing.
    const closeup = new OrthographicCamera(-0.32, 0.32, 0.48, -0.48, 0.01, 20);
    closeup.position.set(0, 1.31, 5);
    closeup.lookAt(0, 1.31, 0);
    const model = loaded.scene;
    scene.add(model);
    renderer.setScissorTest(true);
    [0, Math.PI / 2, Math.PI].forEach((yaw, column) => {
      model.rotation.y = yaw;
      renderer.setViewport(column * 500, 0, 500, 750);
      renderer.setScissor(column * 500, 0, 500, 750);
      renderer.render(scene, closeup);
      triangleCount = renderer.info.render.triangles;
    });
  } else {
    for (const [x, yaw] of [
      [-1.02, 0],
      [0, Math.PI / 2],
      [1.02, Math.PI],
    ]) {
      const model = loaded.scene.clone(true);
      model.position.x = x;
      model.rotation.y = yaw;
      scene.add(model);
    }
    renderer.render(scene, camera);
    triangleCount = renderer.info.render.triangles / 3;
  }
  document.documentElement.dataset["ready"] = "true";
  document.documentElement.dataset["triangles"] = String(triangleCount);
  document.documentElement.dataset["framing"] = torso ? "torso" : "full";
  document.documentElement.dataset["height"] = String(size.y);
}
void render().catch((error) => {
  document.body.textContent = String(error);
  throw error;
});
