// Isolated service responses: no model request, real camera or database write.
import { z } from "zod";
import { SupplementInputSchema } from "../../src/lib/supplement.schema";
import { state, count, delay, persist } from "./state";
export async function getSupplements() {
  count("getSupplements");
  while (state.fail === "supplements-pending") await delay();
  await delay();
  if (state.fail === "supplements") throw new Error("Synthetic private lookup failure");
  return { supplements: structuredClone(state.supplements) };
}
export async function addSupplements({ data }: { data: unknown }) {
  count("addSupplements");
  state.last.addSupplements = data;
  const input = z
    .object({ supplements: z.array(SupplementInputSchema), skipExistingNames: z.boolean() })
    .parse(data);
  await delay();
  if (state.fail === "supplement-add") throw new Error("Synthetic private insert failure");
  const rows = input.supplements
    .filter(
      (item) =>
        !input.skipExistingNames ||
        !state.supplements.some((saved) => saved.name.toLowerCase() === item.name.toLowerCase()),
    )
    .map((item) => ({
      ...item,
      id: crypto.randomUUID(),
      dose: item.dose || null,
      notes: item.notes || null,
    }));
  state.supplements.push(...rows);
  persist();
  return { supplements: rows, created: rows.length };
}
export async function setSupplementActive({ data }: { data: { id: string; isActive: boolean } }) {
  count("setSupplementActive");
  const fail = state.fail === "supplement-toggle";
  await delay();
  if (fail) {
    count("setSupplementActive:failed");
    throw new Error("Synthetic private update failure");
  }
  const row = state.supplements.find((item) => item.id === data.id);
  if (!row) throw new Error("Missing synthetic supplement");
  row.is_active = data.isActive;
  persist();
  return { ok: true };
}
export async function removeSupplement({ data }: { data: { id: string } }) {
  count("removeSupplement");
  const fail = state.fail === "supplement-remove";
  await delay();
  if (fail) {
    count("removeSupplement:failed");
    throw new Error("Synthetic private delete failure");
  }
  state.supplements = state.supplements.filter((item) => item.id !== data.id);
  persist();
  return { ok: true };
}
export async function scanMicronutrients() {
  count("scanMicronutrients");
  await delay();
  return {
    summary: "Synthetic fixture: no nutrient analysis available.",
    dataQuality: "No food evidence in this controlled response.",
    loggedDays: 0,
    findings: [],
    strengths: [],
    warnings: [],
    fallback: true,
  };
}
export async function analyzeSupplementCycles() {
  count("analyzeSupplementCycles");
  await delay();
  throw new Error("AI_PROVIDER_UNAVAILABLE");
}
export async function analyzeSupplementPhoto() {
  count("analyzeSupplementPhoto");
  await delay();
  return {
    ok: true,
    products: [
      {
        name: "Synthetic scanned label",
        dose: "",
        category: "general",
        timesPerDay: 1,
        withFood: false,
        preferredTime: "any",
        notes: "Synthetic editable draft",
        readable: "Synthetic label",
      },
    ],
  };
}
