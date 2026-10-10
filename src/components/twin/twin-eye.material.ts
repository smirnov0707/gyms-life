import {
  DataTexture,
  EquirectangularReflectionMapping,
  LinearFilter,
  MeshPhysicalMaterial,
  RGBAFormat,
  type Texture,
} from "three";

/** Two small studio reflectors, generated locally; no downloaded environment or emissive eyes. */
function eyeStudioReflection(): DataTexture {
  const width = 256,
    height = 128;
  const pixels = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const u = (x + 0.5) / width,
        v = (y + 0.5) / height;
      const key = Math.exp(-Math.pow((u - 0.715) / 0.022, 8) - Math.pow((v - 0.575) / 0.038, 8));
      const fill = Math.exp(-Math.pow((u - 0.79) / 0.018, 8) - Math.pow((v - 0.545) / 0.026, 8));
      const light = Math.round(8 + 247 * Math.max(key, fill * 0.45));
      const offset = (y * width + x) * 4;
      pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = light;
      pixels[offset + 3] = 255;
    }
  }
  const texture = new DataTexture(pixels, width, height, RGBAFormat);
  texture.mapping = EquirectangularReflectionMapping;
  texture.minFilter = texture.magFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

/** Native generic eyes: a moist reflective coat over the existing iris/sclera map. */
export function createTwinEyeMaterial(map: Texture): MeshPhysicalMaterial {
  return new MeshPhysicalMaterial({
    color: 0xffffff,
    map,
    envMap: eyeStudioReflection(),
    envMapIntensity: 12,
    metalness: 0,
    roughness: 0.4,
    ior: 1.38,
    specularIntensity: 0.5,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
  });
}
