/**
 * Decorative subdermal detail for the registered natural skin mesh only.
 * Coordinates are metres in that asset's rest pose, not athlete measurements.
 * A pigment layer leaves silhouette, normals, breathing and picking untouched.
 */
export const TWIN_SKIN_VEIN_DECLARATIONS = /* glsl */ `
float twinVeinStrand(vec2 p, vec2 span, vec4 bends, float radius) {
  float t = clamp((p.y - span.x) / (span.y - span.x), 0.0, 1.0);
  float a = 1.0 - t;
  float x = a*a*a*bends.x + 3.0*a*a*t*bends.y
    + 3.0*a*t*t*bends.z + t*t*t*bends.w;
  float slope = 3.0 * (a*a*(bends.y-bends.x)
    + 2.0*a*t*(bends.z-bends.y) + t*t*(bends.w-bends.z)) / (span.y-span.x);
  float distance = abs(p.x - x) / sqrt(1.0 + slope*slope);
  // Taper the ends, softly diffuse the colour and filter subpixel strands.
  float width = radius * (0.55 + 0.45*sin(t*3.14159265));
  float pixel = max(fwidth(p.x), 0.00015);
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
  float front = twinVeinStrand(p, vec2(0.875,1.31), vec4(0.342,0.349,0.284,0.265),0.0022);
  front = max(front, 0.75*twinVeinStrand(p,vec2(0.84,1.025),vec4(0.364,0.365,0.345,0.329),0.0015));
  front = max(front, 0.60*twinVeinStrand(p,vec2(1.045,1.23),vec4(0.322,0.336,0.309,0.298),0.0013));
  float back = twinVeinStrand(p,vec2(0.845,1.23),vec4(0.351,0.348,0.323,0.280),0.0019);
  back = max(back,0.70*twinVeinStrand(p,vec2(0.83,1.015),vec4(0.321,0.324,0.345,0.340),0.0013));
  float facing = normalize(vTwinSkinNormal).z;
  float skin = front*smoothstep(0.12,0.70,facing)
    + back*smoothstep(0.12,0.70,-facing);
  return skin * smoothstep(0.235,0.265,p.x);
}
`;

export const TWIN_SKIN_VEIN_COLOR = /* glsl */ `
  float twinVein = twinSkinVeins() * (1.0-0.85*twinSelected);
  // Muted blue-green beneath the warm diffuse skin; no emissive vein glow.
  diffuseColor.rgb *= mix(vec3(1.0),vec3(0.35,0.65,0.73),twinVein*0.66);
`;
