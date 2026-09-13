/**
 * Product-surface policy for the 2050 convergence.
 * Routes are implementation details; only WORLD and CONTEXT_TOOL surfaces are discoverable.
 */
export const PRODUCT_SURFACES = {
  "/app": "WORLD",
  "/twin": "WORLD",
  "/lab": "WORLD",
  "/coach": "WORLD",
  "/training": "CONTEXT_TOOL",
  "/exercises": "EMBEDDED_FLOW",
  "/ar": "CONTEXT_TOOL",
  "/nutrition": "CONTEXT_TOOL",
  "/readiness": "EMBEDDED_FLOW",
  "/meal-plan": "EMBEDDED_FLOW",
  "/supplements": "EMBEDDED_FLOW",
  "/me": "SYSTEM_CONTROL",
  "/onboarding": "SYSTEM_FLOW",
  "/progress": "LEGACY_COMPAT",
  "/history": "LEGACY_COMPAT",
  "/form": "LEGACY_COMPAT",
  "/achievements": "LEGACY_COMPAT",
  "/reminders": "LEGACY_COMPAT",
  "/coach-history": "LEGACY_COMPAT",
} as const;

export type ProductSurfaceKind = (typeof PRODUCT_SURFACES)[keyof typeof PRODUCT_SURFACES];

export const DISCOVERABLE_SURFACE_KINDS = new Set<ProductSurfaceKind>(["WORLD", "CONTEXT_TOOL"]);
