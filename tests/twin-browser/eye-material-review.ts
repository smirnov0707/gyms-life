import { MeshPhysicalMaterial, PerspectiveCamera, Scene, WebGLRenderer } from "three";
import { loadTwinHuman, twinHumanUrl } from "@/components/twin/twin-human.loader";

/** Render/dispose real loaded eyes twice to catch leaked reflection textures. */
export async function reviewEyeMaterialLifetime() {
  const renderer = new WebGLRenderer({ antialias: false });
  renderer.setSize(64, 64);
  const camera = new PerspectiveCamera(35, 1, 0.01, 5);
  camera.position.set(0, 1.74, 0.4);
  camera.lookAt(0, 1.738, 0.14);
  const scene = new Scene();
  const cycles = [];
  try {
    for (let cycle = 0; cycle < 2; cycle++) {
      const model = await loadTwinHuman(twinHumanUrl("male"));
      const eyes = model.meshes.find((mesh) => mesh.name === "Eyes");
      if (!eyes || !(eyes.material instanceof MeshPhysicalMaterial)) {
        model.dispose();
        throw new Error("Missing native eye material");
      }
      const reflection = eyes.material.envMap;
      if (!reflection) {
        model.dispose();
        throw new Error("Missing eye reflection texture");
      }
      let disposals = 0;
      reflection.addEventListener("dispose", () => disposals++);
      scene.add(model.body);
      try {
        renderer.render(scene, camera);
        const peak = renderer.info.memory.textures;
        scene.remove(model.body);
        model.dispose();
        model.dispose();
        cycles.push({ peak, retained: renderer.info.memory.textures, disposals });
      } finally {
        scene.remove(model.body);
        model.dispose();
      }
    }
    return cycles;
  } finally {
    renderer.dispose();
    renderer.forceContextLoss();
  }
}
