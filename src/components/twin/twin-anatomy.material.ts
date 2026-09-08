import { Color, MeshStandardMaterial, type MeshStandardMaterialParameters } from "three";

/**
 * A cool edge on the existing surface keeps the dark anatomical silhouette
 * readable. This is constant studio lighting, independent of every data layer.
 * Opaque depth testing preserves the atlas's overlapping muscle boundaries;
 * additional translucent shells would wash those boundaries out.
 */
export function createTwinAnatomyMaterial(
  parameters: MeshStandardMaterialParameters,
  { fibers = false, regionMask = false }: { fibers?: boolean; regionMask?: boolean } = {},
): MeshStandardMaterial {
  const material = new MeshStandardMaterial(parameters);
  material.onBeforeCompile = (shader) => {
    if (regionMask) {
      shader.uniforms.twinNeutral = { value: new Color(0x354956) };
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nattribute float _twin_mask;\nvarying float vTwinMask;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvTwinMask = _twin_mask;");
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", "#include <common>\nuniform vec3 twinNeutral;\nvarying float vTwinMask;")
        .replace("#include <color_fragment>", "#include <color_fragment>\ndiffuseColor.rgb = mix(twinNeutral, diffuseColor.rgb, clamp(vTwinMask, 0.0, 1.0));")
        .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance *= clamp(vTwinMask, 0.0, 1.0);");
    }
    // Only the authoring build's explicit directional coordinates enable this
    // detail. Arbitrary atlas UVs would draw lines across unrelated anatomy.
    if (fibers) {
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec2 vTwinFiberUv;")
        .replace("#include <uv_vertex>", "#include <uv_vertex>\nvTwinFiberUv = uv;");
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", "#include <common>\nvarying vec2 vTwinFiberUv;")
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>
          // Antialias in screen space so distant fibers do not shimmer.
          float twinPhase = vTwinFiberUv.y * 32.0;
          float twinBand = abs(fract(twinPhase + 0.5) - 0.5);
          float twinPixel = max(fwidth(twinPhase), 0.002);
          float twinFiber = 1.0 - smoothstep(0.055, 0.055 + twinPixel, twinBand);
          float twinFade = 1.0 - smoothstep(0.3, 0.8, twinPixel);
          diffuseColor.rgb *= 0.92 + 0.18 * twinFiber * twinFade;`,
        );
    }
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <emissivemap_fragment>",
      `#include <emissivemap_fragment>
      float twinRim = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 6.0);
      totalEmissiveRadiance += vec3(0.14, 0.38, 0.46) * twinRim * 0.18;`,
    );
  };
  material.customProgramCacheKey = () => `twin-anatomy-rim-v4-${fibers ? "fibers" : "plain"}-${regionMask ? "mask" : "solid"}`;
  return material;
}
