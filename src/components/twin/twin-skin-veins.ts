/**
 * Decorative subdermal detail for the registered natural skin mesh only.
 * Coordinates are metres in that asset's rest pose, not athlete measurements.
 * Pigment and bounded shading relief leave silhouette, breathing and picking untouched.
 */
export const TWIN_SKIN_VEIN_DECLARATIONS = /* glsl */ `
float twinVeinStrand(vec2 p, vec2 pixelSize, vec2 span, vec4 bends, float radius) {
  float t = clamp((p.y - span.x) / (span.y - span.x), 0.0, 1.0);
  float a = 1.0 - t;
  float x = a*a*a*bends.x + 3.0*a*a*t*bends.y
    + 3.0*a*t*t*bends.z + t*t*t*bends.w;
  float slope = 3.0 * (a*a*(bends.y-bends.x)
    + 2.0*a*t*(bends.z-bends.y) + t*t*(bends.w-bends.z)) / (span.y-span.x);
  float distance = abs(p.x - x) / sqrt(1.0 + slope*slope);
  // Taper the ends, softly diffuse the colour and filter subpixel strands.
  float width = radius * (0.55 + 0.45*sin(t*3.14159265));
  float pixel = max((pixelSize.x + abs(slope)*pixelSize.y) / sqrt(1.0+slope*slope), 0.00015);
  float filteredWidth = sqrt(width*width + pixel*pixel);
  float ink = exp(-distance*distance / (filteredWidth*filteredWidth));
  float ends = smoothstep(span.x, span.x+0.016, p.y)
    * (1.0-smoothstep(span.y-0.022, span.y, p.y));
  return ink * width/filteredWidth * ends;
}

float twinSkinVeins() {
  vec2 p = vec2(abs(vTwinSkinPosition.x), vTwinSkinPosition.y);
  // Slight left/right variation avoids perfectly mirrored drawn-on lines.
  p.x += sign(vTwinSkinPosition.x) * 0.0025
    * sin((p.y-0.85)*15.0);
  // Derivatives are evaluated before spatial branches, including at their edges.
  vec2 pixelSize = fwidth(p);
  vec3 facing = normalize(vTwinSkinNormal);
  float frontFacing = smoothstep(0.12,0.70,facing.z);
  float backFacing = smoothstep(0.12,0.70,-facing.z);
  if (p.x > 0.235 && p.y > 0.77 && p.y < 1.50) {
    float front = twinVeinStrand(p,pixelSize,vec2(0.875,1.31),vec4(0.342,0.349,0.284,0.265),0.0022);
    front = max(front,0.75*twinVeinStrand(p,pixelSize,vec2(0.84,1.025),vec4(0.364,0.365,0.345,0.329),0.0015));
    front = max(front,0.65*twinVeinStrand(p,pixelSize,vec2(1.045,1.23),vec4(0.322,0.336,0.309,0.298),0.0013));
    front = max(front,0.82*twinVeinStrand(p,pixelSize,vec2(1.215,1.48),vec4(0.281,0.273,0.259,0.244),0.0019));
    front = max(front,0.68*twinVeinStrand(p,pixelSize,vec2(0.94,1.245),vec4(0.315,0.312,0.279,0.258),0.0016));
    front = max(front,0.55*twinVeinStrand(p,pixelSize,vec2(1.08,1.185),vec4(0.340,0.326,0.315,0.300),0.0011));
    float back = twinVeinStrand(p,pixelSize,vec2(0.845,1.23),vec4(0.351,0.348,0.323,0.280),0.0019);
    back = max(back,0.70*twinVeinStrand(p,pixelSize,vec2(0.83,1.015),vec4(0.321,0.324,0.345,0.340),0.0013));
    back = max(back,0.64*twinVeinStrand(p,pixelSize,vec2(1.04,1.36),vec4(0.306,0.308,0.279,0.254),0.0015));
    // Fine dorsal hand branches converge towards the wrist; no palm-wide net.
    back = max(back,0.72*twinVeinStrand(p,pixelSize,vec2(0.805,0.97),vec4(0.361,0.363,0.354,0.347),0.0012));
    back = max(back,0.65*twinVeinStrand(p,pixelSize,vec2(0.805,0.95),vec4(0.339,0.338,0.343,0.349),0.0010));
    back = max(back,0.50*twinVeinStrand(p,pixelSize,vec2(0.84,0.93),vec4(0.310,0.315,0.333,0.343),0.0009));
    return max(front*frontFacing,back*backFacing) * smoothstep(0.235,0.265,p.x);
  }
  if (p.x < 0.22 && p.y > 0.14 && p.y < 0.61) {
    float innerFacing = smoothstep(0.10,0.70,-sign(vTwinSkinPosition.x)*facing.x);
    float front = 0.68*twinVeinStrand(p,pixelSize,vec2(0.15,0.59),vec4(0.143,0.145,0.108,0.086),0.0016);
    front = max(front,0.45*twinVeinStrand(p,pixelSize,vec2(0.235,0.395),vec4(0.174,0.168,0.148,0.130),0.0011));
    float back = 0.72*twinVeinStrand(p,pixelSize,vec2(0.18,0.59),vec4(0.155,0.106,0.105,0.104),0.0018);
    back = max(back,0.50*twinVeinStrand(p,pixelSize,vec2(0.38,0.57),vec4(0.112,0.138,0.138,0.124),0.0012));
    return max(front*frontFacing,back*max(backFacing,innerFacing*0.8));
  }
  return 0.0;
}
`;

export const TWIN_SKIN_VEIN_COLOR = /* glsl */ `
  float twinVein = twinSkinVeins() * (1.0-0.85*twinSelected);
  // Muted blue-green beneath the warm diffuse skin; no emissive vein glow.
  diffuseColor.rgb *= mix(vec3(1.0),vec3(0.35,0.65,0.73),twinVein*0.66);
`;
