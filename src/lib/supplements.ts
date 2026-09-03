// Smart supplement scheduling engine.
// Distributes a user's supplements across the day using evidence-based
// timing rules (absorption, interactions, stimulant curfews).
import type { Supplement } from "./supplement.schema";

export type { Supplement } from "./supplement.schema";

export type SlotId =
  "wake" | "breakfast" | "lunch" | "pre_workout" | "post_workout" | "dinner" | "bedtime";

export interface ScheduledItem {
  supplement: Supplement;
  reasonKey: string;
}

export interface Slot {
  id: SlotId;
  time: string;
  items: ScheduledItem[];
}

export interface ScheduleResult {
  slots: Slot[];
  warningKeys: string[];
}

export const SLOT_ORDER: { id: SlotId; time: string }[] = [
  { id: "wake", time: "07:00" },
  { id: "breakfast", time: "08:00" },
  { id: "lunch", time: "13:00" },
  { id: "pre_workout", time: "16:30" },
  { id: "post_workout", time: "18:00" },
  { id: "dinner", time: "19:30" },
  { id: "bedtime", time: "22:00" },
];

const MEAL_SLOTS: SlotId[] = ["breakfast", "lunch", "dinner"];

// Preferred slots per category, in priority order.
const CATEGORY_SLOTS: Record<string, SlotId[]> = {
  preworkout: ["pre_workout"],
  creatine: ["post_workout", "breakfast"],
  protein: ["post_workout", "breakfast", "dinner"],
  omega: ["breakfast", "dinner"],
  vitamin: ["breakfast", "lunch"],
  mineral: ["bedtime", "dinner"],
  iron: ["wake", "lunch"],
  calcium: ["dinner", "lunch"],
  electrolyte: ["pre_workout", "post_workout"],
  probiotic: ["wake", "breakfast"],
  general: ["breakfast", "lunch", "dinner"],
};

// Reason key per category (translated in the UI).
const CATEGORY_REASON: Record<string, string> = {
  preworkout: "supp.why.preworkout",
  creatine: "supp.why.creatine",
  protein: "supp.why.protein",
  omega: "supp.why.omega",
  vitamin: "supp.why.vitamin",
  mineral: "supp.why.mineral",
  iron: "supp.why.iron",
  calcium: "supp.why.calcium",
  electrolyte: "supp.why.electrolyte",
  probiotic: "supp.why.probiotic",
  general: "supp.why.general",
};

const PREFERRED_MAP: Record<string, SlotId> = {
  morning: "breakfast",
  pre_workout: "pre_workout",
  post_workout: "post_workout",
  evening: "dinner",
  bedtime: "bedtime",
};

// Categories that should never share a slot (absorption competition).
const CONFLICTS: [string, string, string][] = [
  ["iron", "calcium", "supp.warn.ironCalcium"],
  ["iron", "mineral", "supp.warn.ironZinc"],
  ["calcium", "mineral", "supp.warn.calciumZinc"],
];

const SPREAD: SlotId[] = ["breakfast", "lunch", "dinner", "bedtime", "wake"];

function slotsFor(s: Supplement): SlotId[] {
  let base = CATEGORY_SLOTS[s.category] ?? CATEGORY_SLOTS["general"]!;
  const pref = PREFERRED_MAP[s.preferred_time];
  if (pref) {
    base = [pref, ...base.filter((x) => x !== pref)];
  }
  if (s.with_food) {
    // Empty-stomach slots become the nearest meal slot.
    base = base.map((slot) =>
      slot === "wake" || slot === "pre_workout" || slot === "bedtime"
        ? (MEAL_SLOTS.find((m) => !base.includes(m)) ?? "breakfast")
        : slot,
    );
    base = [...new Set(base)];
  }
  // Pad with a spread so multi-dose supplements never stack in one slot.
  const out = [...base];
  for (const extra of SPREAD) {
    if (out.length >= Math.max(1, s.times_per_day)) break;
    if (!out.includes(extra)) out.push(extra);
  }
  return out;
}

export function buildSchedule(supplements: Supplement[]): ScheduleResult {
  const active = supplements.filter((s) => s.is_active);
  const bySlot = new Map<SlotId, ScheduledItem[]>();
  for (const { id } of SLOT_ORDER) bySlot.set(id, []);
  const warnings = new Set<string>();

  for (const s of active) {
    const slots = slotsFor(s);
    const n = Math.min(Math.max(1, s.times_per_day), 4);
    for (let i = 0; i < n; i++) {
      const slot = slots[i] ?? slots[slots.length - 1]!;
      bySlot.get(slot)!.push({
        supplement: s,
        reasonKey: CATEGORY_REASON[s.category] ?? CATEGORY_REASON["general"]!,
      });
    }
    // Stimulant curfew: pre-workout late in the day hurts sleep.
    const assigned = slots.slice(0, n);
    if (s.category === "preworkout" && assigned.some((x) => x === "dinner" || x === "bedtime")) {
      warnings.add("supp.warn.caffeineLate");
    }
  }

  // Resolve same-slot conflicts: move the second conflicting item onward.
  for (const [a, b, warnKey] of CONFLICTS) {
    for (const { id } of SLOT_ORDER) {
      const items = bySlot.get(id)!;
      const hasA = items.findIndex((i) => i.supplement.category === a);
      const hasB = items.findIndex((i) => i.supplement.category === b);
      if (hasA >= 0 && hasB >= 0) {
        const [moved] = items.splice(hasB, 1);
        const idx = SLOT_ORDER.findIndex((x) => x.id === id);
        const fallback: SlotId[] = ["lunch", "dinner", "breakfast", "bedtime"];
        const target =
          SLOT_ORDER.slice(idx + 1).find((x) => MEAL_SLOTS.includes(x.id))?.id ??
          fallback.find((f) => f !== id)!;
        bySlot.get(target)!.push({ ...moved!, reasonKey: "supp.why.separated" });
        warnings.add(warnKey);
      }
    }
  }

  // Too many pills at once → suggest splitting.
  for (const { id } of SLOT_ORDER) {
    if (bySlot.get(id)!.length >= 4) warnings.add("supp.warn.tooMany");
  }

  return {
    slots: SLOT_ORDER.map(({ id, time }) => ({ id, time, items: bySlot.get(id)! })).filter(
      (s) => s.items.length > 0,
    ),
    warningKeys: [...warnings],
  };
}
