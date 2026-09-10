import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/integrations/supabase/types";
import { IsoDaySchema } from "./local-day";

/** Read the selected local day, not the latest 80 entries from arbitrary days. */
export async function readDailyNutritionLogs(
  client: SupabaseClient<Database>,
  userId: string,
  day: string,
): Promise<Tables<"nutrition_logs">[]> {
  const selectedDay = IsoDaySchema.parse(day);
  const rows: Tables<"nutrition_logs">[] = [];
  const seen = new Set<string>();
  const pageSize = 250;
  let expectedCount: number | null = null;
  for (let page = 0; page < 40; page++) {
    const { data, error, count } = await client
      .from("nutrition_logs")
      .select("*", { count: "exact" })
      .eq("user_id", userId)
      .eq("logged_on", selectedDay)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1);
    if (error || data === null || count === null || !Number.isSafeInteger(count) || count < 0)
      throw new Error("Daily food log could not be read completely.");
    if (expectedCount !== null && count !== expectedCount)
      throw new Error("Food log changed during loading. Refresh it.");
    expectedCount = count;
    for (const row of data) {
      if (seen.has(row.id) || row.user_id !== userId || row.logged_on !== selectedDay)
        throw new Error("Daily food log is inconsistent. Refresh it.");
      if (
        [row.calories, row.protein, row.carbs, row.fat].some(
          (value) => !Number.isFinite(value) || value < 0,
        )
      )
        throw new Error("Daily food log contains invalid nutrition values.");
      seen.add(row.id);
      rows.push(row);
    }
    if (rows.length === count) return rows;
    if (rows.length > count || data.length < pageSize)
      throw new Error("Daily food log is incomplete.");
  }
  throw new Error("Daily food log is too large to read completely.");
}
