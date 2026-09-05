/** Test-only replacement for the data service; never part of the production app. */
export function getTwinSnapshot(): never {
  throw new Error("The renderer fixture must not access the authenticated backend.");
}
