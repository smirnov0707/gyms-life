/**
 * Types for the build-time front-torso cut, so the test that guards it is
 * checked rather than silenced. The implementation is .mjs because the asset
 * pipeline runs under plain node, outside the app's TypeScript build.
 */
export declare const FRONT_TORSO_REGIONS: readonly string[];
export declare const CHEST_FLOOR_V: number;
export declare const CHEST_FLOOR_RISE: number;
export declare const STERNUM_HALF_WIDTH_U: number;
export declare const ABS_FLOOR_V: number;
export declare const ABS_HALF_WIDTH_U: number;
export declare function frontTorsoMuscle(u: number, v: number): string | null;
