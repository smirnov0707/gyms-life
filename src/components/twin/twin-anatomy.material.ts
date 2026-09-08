import { MeshStandardMaterial, type MeshStandardMaterialParameters } from "three";

/**
 * A cool edge on the existing surface keeps the dark anatomical silhouette
 * readable. This is constant studio lighting, independent of every data layer.
 * Opaque depth testing preserves the atlas's overlapping muscle boundaries;
 * additional translucent shells would wash those boundaries out.
 */
export function createTwinAnatomyMaterial(
  parameters: MeshStandardMaterialParameters,
): MeshStandardMaterial {
  const material = new MeshStandardMaterial(parameters);
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <emissivemap_fragment>",
      `#include <emissivemap_fragment>
      float twinRim = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 4.0);
      totalEmissiveRadiance += vec3(0.12, 0.53, 0.68) * twinRim * 0.42;`,
    );
  };
  material.customProgramCacheKey = () => "twin-anatomy-rim-v1";
  return material;
}
