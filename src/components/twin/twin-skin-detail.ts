/** Rest-space skin finish: decorative, seam-free and independent of athlete data. */
export const TWIN_SKIN_DETAIL_DECLARATIONS = /* glsl */ `
float twinSkinHash(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}

float twinSkinNoise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f*f*f*(f*(f*6.0-15.0)+10.0);
  return mix(
    mix(mix(twinSkinHash(i), twinSkinHash(i+vec3(1,0,0)), f.x),
        mix(twinSkinHash(i+vec3(0,1,0)), twinSkinHash(i+vec3(1,1,0)), f.x), f.y),
    mix(mix(twinSkinHash(i+vec3(0,0,1)), twinSkinHash(i+vec3(1,0,1)), f.x),
        mix(twinSkinHash(i+vec3(0,1,1)), twinSkinHash(i+vec3(1,1,1)), f.x), f.y), f.z);
}
`;

export const TWIN_SKIN_DETAIL_ROUGHNESS = /* glsl */ `
  // Neutral feathered borders retain the same finish as adjacent skin.
  roughnessFactor = mix(twinNeutralRoughness, roughnessFactor, twinSkinSelectionMask);
  float twinSkinVariation = twinSkinNoise(vTwinSkinPosition*45.0)-0.5;
  roughnessFactor = clamp(roughnessFactor + twinSkinVariation*0.09, 0.5, 0.9);
`;

export const TWIN_SKIN_DETAIL_NORMAL = /* glsl */ `
  // Fade before the detail becomes subpixel; distant phone views must not shimmer.
  float twinSkinPixel = max(length(dFdx(vTwinSkinPosition)), length(dFdy(vTwinSkinPosition)));
  float twinSkinDetailFade = 1.0-smoothstep(0.0015,0.004,twinSkinPixel);
  float twinSkinHeight = (twinSkinNoise(vTwinSkinPosition*180.0)-0.5)*0.00012;
  vec3 twinDx = dFdx(-vViewPosition), twinDy = dFdy(-vViewPosition);
  vec3 twinRx = cross(twinDy, normal), twinRy = cross(normal, twinDx);
  float twinDet = dot(twinDx, twinRx);
  vec3 twinGradient = (dFdx(twinSkinHeight)*twinRx + dFdy(twinSkinHeight)*twinRy)
    * sign(twinDet)/max(abs(twinDet),0.0000000001);
  twinGradient *= min(1.0,0.06/max(length(twinGradient),0.000001));
  normal = normalize(normal-twinGradient*twinSkinDetailFade);
`;
