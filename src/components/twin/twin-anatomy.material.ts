import {
  Color,
  Vector3,
  Vector4,
  MeshStandardMaterial,
  type MeshStandardMaterialParameters,
} from "three";
import type { TwinSculptContour } from "./twin-sculpt.contours";

/**
 * A cool edge on the existing surface keeps the dark anatomical silhouette
 * readable. This is constant studio lighting, independent of every data layer.
 * Opaque depth testing preserves the atlas's overlapping muscle boundaries;
 * additional translucent shells would wash those boundaries out.
 */
export function createTwinAnatomyMaterial(
  parameters: MeshStandardMaterialParameters,
  {
    fibers = false,
    regionMask = false,
    contours = [],
    contourFan = false,
  }: {
    fibers?: boolean;
    regionMask?: boolean;
    contours?: readonly TwinSculptContour[];
    contourFan?: boolean;
  } = {},
): MeshStandardMaterial {
  const material = new MeshStandardMaterial(parameters);
  material.onBeforeCompile = (shader) => {
    if (regionMask) {
      shader.uniforms["twinNeutral"] = { value: new Color(0x354956) };
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          "#include <common>\nattribute float _twin_mask;\nvarying float vTwinMask;",
        )
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvTwinMask = _twin_mask;");
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <common>",
        "#include <common>\nuniform vec3 twinNeutral;\nvarying float vTwinMask;",
      );
    }
    // Only the authoring build's explicit directional coordinates enable this
    // detail. Arbitrary atlas UVs would draw lines across unrelated anatomy.
    if (fibers) {
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec2 vTwinFiberUv;")
        .replace("#include <uv_vertex>", "#include <uv_vertex>\nvTwinFiberUv = uv;");
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <common>",
        "#include <common>\nvarying vec2 vTwinFiberUv;",
      );
    }
    let contourCode = "";
    if (contours.length) {
      shader.uniforms["twinContourCentres"] = {
        value: contours.map((c) => new Vector4(...c.centre, c.angle)),
      };
      shader.uniforms["twinContourRadii"] = { value: contours.map((c) => new Vector3(...c.radii)) };
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          "#include <common>\nattribute vec3 _twin_sculpt_position;\nvarying vec3 vTwinSculptPosition;",
        )
        .replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\nvTwinSculptPosition = _twin_sculpt_position;",
        );
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <common>",
        `#include <common>\nvarying vec3 vTwinSculptPosition;\nuniform vec4 twinContourCentres[${contours.length}];\nuniform vec3 twinContourRadii[${contours.length}];`,
      );
      contourCode = `
        float twinLobe = 0.0;
        float twinContourPhase = 0.0;
        for(int i=0; i<${contours.length}; i++) {
          vec3 twinDelta = vec3(abs(vTwinSculptPosition.x), vTwinSculptPosition.yz) - twinContourCentres[i].xyz;
          float twinCos = cos(twinContourCentres[i].w), twinSin = sin(twinContourCentres[i].w);
          vec3 twinChart = vec3(twinCos*twinDelta.x + twinSin*twinDelta.y, -twinSin*twinDelta.x + twinCos*twinDelta.y, twinDelta.z);
          vec3 twinQ = twinChart / twinContourRadii[i];
          float twinEnvelope = max(0.0, 1.0-dot(twinQ,twinQ));
          if(twinEnvelope > twinLobe) {
            twinLobe = twinEnvelope;
            twinContourPhase = ${contourFan ? "(vTwinSculptPosition.y + .65*twinDelta.x*twinDelta.x)" : "twinChart.x"} * 3.2;
          }
        }
        float twinContourMask = smoothstep(.02,.32,twinLobe);
      `;
    }
    // Evaluate bounded lobe masks per fragment: their borders no longer follow
    // the coarse triangulation. Existing assets keep their original shader path.
    const fiberCode = fibers
      ? `
      float twinPhase = ${contours.length ? "twinContourPhase" : "vTwinFiberUv.y"} * 32.0;
      float twinBand = abs(fract(twinPhase + 0.5) - 0.5);
      float twinPixel = max(fwidth(twinPhase), 0.002);
      float twinFiber = 1.0 - smoothstep(0.055, 0.055 + twinPixel, twinBand);
      float twinFade = 1.0 - smoothstep(0.3, 0.8, twinPixel);
      diffuseColor.rgb *= 0.92 + 0.18 * twinFiber * twinFade;
    `
      : "";
    const maskCode = regionMask
      ? `
      float twinSurfaceMask = clamp(vTwinMask, 0.0, 1.0) ${contours.length ? "* twinContourMask" : ""};
      diffuseColor.rgb = mix(twinNeutral, diffuseColor.rgb, twinSurfaceMask);
    `
      : "";
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <color_fragment>",
      "#include <color_fragment>\n" + contourCode + fiberCode + maskCode,
    );
    if (regionMask)
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <emissivemap_fragment>",
        "#include <emissivemap_fragment>\ntotalEmissiveRadiance *= twinSurfaceMask;",
      );

    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <emissivemap_fragment>",
      `#include <emissivemap_fragment>
      float twinRim = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 6.0);
      totalEmissiveRadiance += vec3(0.14, 0.38, 0.46) * twinRim * 0.18;`,
    );
  };
  material.customProgramCacheKey = () =>
    `twin-anatomy-rim-v5-${fibers ? "fibers" : "plain"}-${regionMask ? "mask" : "solid"}-${contours.length}-${contourFan ? "fan" : "longitudinal"}`;
  return material;
}
