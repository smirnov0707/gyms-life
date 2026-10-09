import type { MeshStandardMaterialParameters } from "three";
import { createTwinAnatomyMaterial } from "./twin-anatomy.material";
import { TWIN_SKIN_MATERIAL } from "./twin-surface.style";
import type { TwinBoundaryField } from "./twin-region-boundary";

const replaceOnce = (source: string, from: string, to: string) => {
  if (source.split(from).length !== 2) throw new Error("TWIN_BOUNDARY_SHADER_CONTRACT");
  return source.replace(from, to);
};

/** Owns one field texture; other anatomy material paths stay unchanged. */
export function createTwinBoundaryMaterial(
  parameters: MeshStandardMaterialParameters,
  field: TwinBoundaryField,
) {
  const material = createTwinAnatomyMaterial(parameters, { regionMask: true });
  const compile = material.onBeforeCompile;
  const cacheKey = material.customProgramCacheKey.bind(material);
  let disposed = false;
  material.addEventListener("dispose", () => {
    if (disposed) return;
    disposed = true;
    field.texture.dispose();
  });
  material.onBeforeCompile = (shader, renderer) => {
    compile.call(material, shader, renderer);
    shader.uniforms["twinBoundaryTexture"] = { value: field.texture };
    shader.uniforms["twinBoundaryBounds"] = { value: field.bounds };
    shader.uniforms["twinBoundaryNeutralRoughness"] = { value: TWIN_SKIN_MATERIAL.roughness };
    shader.vertexShader = replaceOnce(
      shader.vertexShader,
      "attribute float _twin_mask;",
      "uniform vec4 twinBoundaryBounds;",
    );
    shader.vertexShader = replaceOnce(
      shader.vertexShader,
      "varying float vTwinMask;",
      "varying vec2 vTwinBoundaryUv;",
    );
    shader.vertexShader = replaceOnce(
      shader.vertexShader,
      "vTwinMask = _twin_mask;",
      "vTwinBoundaryUv = (position.xy - twinBoundaryBounds.xy) / twinBoundaryBounds.zw;",
    );
    shader.fragmentShader = replaceOnce(
      shader.fragmentShader,
      "varying float vTwinMask;",
      "varying vec2 vTwinBoundaryUv;\nuniform sampler2D twinBoundaryTexture;\nuniform float twinBoundaryNeutralRoughness;",
    );
    shader.fragmentShader = replaceOnce(
      shader.fragmentShader,
      "clamp(vTwinMask, 0.0, 1.0)",
      "texture2D(twinBoundaryTexture, vTwinBoundaryUv).r",
    );
    shader.fragmentShader = replaceOnce(
      shader.fragmentShader,
      "#include <roughnessmap_fragment>",
      "#include <roughnessmap_fragment>\nroughnessFactor = mix(twinBoundaryNeutralRoughness, roughnessFactor, twinSurfaceMask);",
    );
  };
  material.customProgramCacheKey = () => cacheKey() + "-boundary-field-v1";
  return material;
}
