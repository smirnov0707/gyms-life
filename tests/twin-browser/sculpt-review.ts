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
import { parseTwinSculptContours } from "../../src/components/twin/twin-sculpt.contours";
import { createTwinAnatomyMaterial } from "../../src/components/twin/twin-anatomy.material";

async function render() {
  const mode = new URLSearchParams(location.search).get("mode");
  const loaded = await new GLTFLoader().loadAsync("/review-source.glb");
  const scene = new Scene();
  scene.background = new Color(0x060e17);
  const renderer = new WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(1500, 1000);
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
                  contourFan: region === "chest" || region === "abs",
                }
              : {}),
            fibers: object.userData["twinFiberUV"] === true,
            regionMask: object.userData["twinRegionMask"] === true,
          });
  });
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
  document.documentElement.dataset["ready"] = "true";
  document.documentElement.dataset["triangles"] = String(renderer.info.render.triangles / 3);
  document.documentElement.dataset["height"] = String(size.y);
}
void render().catch((error) => {
  document.body.textContent = String(error);
  throw error;
});
