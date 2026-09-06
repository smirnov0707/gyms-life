import candidate from "./human-asset.candidate.json";
import type { HumanAssetDescriptor } from "./human-asset.policy";

export const HUMAN_ASSET_CANDIDATE: HumanAssetDescriptor = candidate;
/** Explicit preview opt-in. Never enable for production before visual acceptance. */
export const HUMAN_REALISM_PREVIEW_ENABLED = import.meta.env["VITE_TWIN_HUMAN_PREVIEW"] === "true";
