import { describe, expect, it } from "vitest";
import { parseCoachRecommendation } from "./ai-coach.contract";

describe("coach provider boundary",()=>{it("accepts strict recommendation output",()=>{const value=parseCoachRecommendation({schemaVersion:"1.0",decision:"ADJUST_NEXT_WORKOUT",priority:"MEDIUM",summary:"Increase next working weight slightly.",rationale:["Recent performance is improving."],actions:[{type:"INCREASE_LOAD",exerciseSlug:"bench-press",value:2.5,unit:"kg",instruction:"Add 2.5 kg next session if all prescribed reps are completed."}],confidence:.82,safety:{requiresUserConfirmation:true,notes:[]}});expect(value.confidence).toBe(.82);});it("rejects malformed output",()=>{expect(()=>parseCoachRecommendation({schemaVersion:"1.0",decision:"INVALID"})).toThrow();});});
