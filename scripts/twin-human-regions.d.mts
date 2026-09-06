/**
 * Types for the build-time region map, so the test that guards it is checked
 * rather than silenced. The implementation is .mjs because the asset pipeline
 * runs under plain node, outside the app's TypeScript build.
 */
export declare const REGIONS: readonly string[];
export declare const NEUTRAL: string;
export declare const REGION_MATERIAL_PREFIX: string;
export declare function normaliseBone(name: string): string;
export declare function regionForBone(name: string, front: boolean): string;
