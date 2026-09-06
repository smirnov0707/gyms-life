import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { resolveBodyWeight } from "./body-weight.engine";

export type MicroSnapshot = {
  days: number;
  foodEntries: {
    day: string;
    food: string;
    description: string;
    /**
     * How the entry was captured. Both paths are model estimates; a photo
     * saw the plate, a typed description only saw the athlete's words.
     * `null` for rows written before the app recorded this.
     */
    source: "photo" | "text" | null;
    kcal: number;
    protein: number;
    carbs: number;
    fat: number;
  }[];
  avgKcal: number;
  avgProtein: number;
  supplements: { name: string; dose: string; times_per_day: number }[];
  profile: {
    /** Each is null when it has never been recorded. */
    weight: number | null;
    height: number | null;
    gender: string;
    goal: string | null;
    diet: string;
    birthYear: number | null;
  };
  training: { sessions14d: number; avgSleep: number; avgReadiness: number };
};

/** Pulls the last 14 days of real logs so the scan is based on user data, not guesses. */
export async function loadMicroSnapshot(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<MicroSnapshot> {
  const since = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);

  const [foods, sups, prof, sessions, checkins, weights] = await Promise.all([
    supabase
      .from("nutrition_logs")
      .select("logged_on, food_name, description, calories, protein, carbs, fat, source")
      .eq("user_id", userId)
      .gte("logged_on", since)
      .order("logged_on", { ascending: false })
      .limit(160),
    supabase
      .from("supplements")
      .select("name, dose, times_per_day, is_active")
      .eq("user_id", userId)
      .eq("is_active", true),
    supabase
      .from("profiles")
      .select("weight_kg, height_cm, gender, goal, diet, birth_year")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("workout_sessions")
      .select("id, created_at")
      .eq("user_id", userId)
      .gte("created_at", `${since}T00:00:00Z`),
    supabase
      .from("daily_checkins")
      .select("sleep_hours, readiness_score")
      .eq("user_id", userId)
      .gte("checkin_on", since),
    // What the athlete has actually weighed since. The profile carries what
    // they stated at onboarding, which stops being true the moment the scan
    // is any use — and this analysis reasons from body mass.
    supabase
      .from("body_metrics")
      .select("weight_kg")
      .eq("user_id", userId)
      .order("measured_on", { ascending: false })
      .limit(30),
  ]);

  const rows = foods.data ?? [];

  const dayKeys = new Set(rows.map((r) => r.logged_on));
  const dayCount = Math.max(1, dayKeys.size);
  const totalKcal = rows.reduce((a, r) => a + Number(r.calories ?? 0), 0);
  const totalProtein = rows.reduce((a, r) => a + Number(r.protein ?? 0), 0);

  const ci = checkins.data ?? [];
  const avg = (list: number[]) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : 0);

  const profile = prof.data;

  return {
    days: dayCount,
    foodEntries: rows.slice(0, 90).map((r) => ({
      day: r.logged_on,
      food: r.food_name,
      description: (r.description ?? "").slice(0, 120),
      source:
        r.source === "photo_estimate" ? "photo" : r.source === "text_estimate" ? "text" : null,
      kcal: Math.round(Number(r.calories ?? 0)),
      protein: Math.round(Number(r.protein ?? 0)),
      carbs: Math.round(Number(r.carbs ?? 0)),
      fat: Math.round(Number(r.fat ?? 0)),
    })),
    avgKcal: Math.round(totalKcal / dayCount),
    avgProtein: Math.round(totalProtein / dayCount),
    supplements: (sups.data ?? []).map((s) => ({
      name: s.name,
      dose: s.dose ?? "",
      times_per_day: s.times_per_day ?? 1,
    })),
    profile: {
      // No stored measurement means no measurement. A scan reasoned from an
      // invented body reads as personal advice, and the system prompt for
      // this task tells the model to use only the data below — handing it a
      // 178 cm athlete chasing muscle gain, when we know neither, made that
      // instruction false before the model ever saw it.
      weight: resolveBodyWeight(weights.data ?? [], profile?.weight_kg ?? null).weightKg,
      height: profile?.height_cm == null ? null : Number(profile.height_cm),
      gender: profile?.gender ?? "unknown",
      goal: profile?.goal ?? null,
      diet: profile?.diet ?? "any",
      birthYear: profile?.birth_year ?? null,
    },
    training: {
      sessions14d: (sessions.data ?? []).length,
      avgSleep: Number(avg(ci.map((c) => Number(c.sleep_hours ?? 0)).filter(Boolean)).toFixed(1)),
      avgReadiness: Math.round(avg(ci.map((c) => Number(c.readiness_score ?? 0)).filter(Boolean))),
    },
  };
}

export type MicroNutrientFinding = {
  key: string;
  name: string;
  current: string;
  target: string;
  gapPercent: number;
  priority: "critical" | "high" | "medium" | "low";
  reason: string;
  evidence: string;
  foodFix: string;
  supplement: {
    name: string;
    dose: string;
    category: string;
    times_per_day: number;
    with_food: boolean;
    preferred_time: string;
  } | null;
};

export type MicroScanResult = {
  summary: string;
  dataQuality: string;
  loggedDays: number;
  findings: MicroNutrientFinding[];
  strengths: string[];
  warnings: string[];
  fallback: boolean;
};

const FB: Record<
  string,
  {
    summary: string;
    quality: string;
    strengths: string[];
    warnings: string[];
    items: Omit<MicroNutrientFinding, "key">[];
  }
> = {
  lt: {
    summary: "Bazinė analizė pagal tavo maisto žurnalą ir treniruočių krūvį.",
    quality:
      "Analizė paremta ribotu maisto žurnalo kiekiu — pildyk mitybą kasdien tikslesniam rezultatui.",
    strengths: ["Baltymų kiekis stebimas kasdien"],
    warnings: ["Tai nėra medicininė diagnozė. Dėl kraujo tyrimų kreipkis į gydytoją."],
    items: [
      {
        name: "Vitaminas D3",
        current: "~200 TV/d",
        target: "2000–4000 TV/d",
        gapPercent: 90,
        priority: "critical",
        reason:
          "Šiaurės platumose su maistu gaunama labai mažai vitamino D, o jis būtinas raumenų jėgai ir imunitetui.",
        evidence: "Maisto žurnale beveik nėra riebios žuvies ar praturtintų produktų.",
        foodFix: "2–3 kartus per savaitę riebi žuvis (lašiša, skumbrė), kiaušinių tryniai.",
        supplement: {
          name: "Vitamin D3",
          dose: "4000 IU",
          category: "vitamin",
          times_per_day: 1,
          with_food: true,
          preferred_time: "morning",
        },
      },
      {
        name: "Magnis",
        current: "~180 mg/d",
        target: "350–400 mg/d",
        gapPercent: 55,
        priority: "high",
        reason:
          "Intensyvios treniruotės didina magnio netektį su prakaitu; trūkumas blogina miegą ir atsistatymą.",
        evidence: "Mažai ankštinių, riešutų ir žalių lapinių daržovių žurnale.",
        foodFix: "Sauja migdolų, špinatai, avinžirniai, tamsus šokoladas (85 %).",
        supplement: {
          name: "Magnesium (citrate/glycinate)",
          dose: "400 mg",
          category: "mineral",
          times_per_day: 1,
          with_food: true,
          preferred_time: "bedtime",
        },
      },
      {
        name: "Omega-3 (EPA/DHA)",
        current: "~400 mg/d",
        target: "1500–2000 mg/d",
        gapPercent: 73,
        priority: "medium",
        reason: "Padeda mažinti sąnarių uždegimą po didelio savaitės tūrio.",
        evidence: "Žuvies patiekalų per pastarąsias 2 savaites užfiksuota mažai.",
        foodFix: "Riebi žuvis 2 k./sav., linų sėmenys, graikiniai riešutai.",
        supplement: {
          name: "Omega-3 (EPA/DHA)",
          dose: "1500 mg",
          category: "omega",
          times_per_day: 1,
          with_food: true,
          preferred_time: "any",
        },
      },
    ],
  },
  en: {
    summary: "Baseline analysis from your food log and training load.",
    quality: "Based on a limited food log — log meals daily for a sharper result.",
    strengths: ["Protein intake is being tracked daily"],
    warnings: ["This is not a medical diagnosis. See a doctor for blood work."],
    items: [
      {
        name: "Vitamin D3",
        current: "~200 IU/d",
        target: "2000–4000 IU/d",
        gapPercent: 90,
        priority: "critical",
        reason:
          "Food rarely covers vitamin D in northern latitudes, yet it drives muscle strength and immunity.",
        evidence: "Almost no oily fish or fortified foods in the log.",
        foodFix: "Oily fish (salmon, mackerel) 2–3x per week, egg yolks.",
        supplement: {
          name: "Vitamin D3",
          dose: "4000 IU",
          category: "vitamin",
          times_per_day: 1,
          with_food: true,
          preferred_time: "morning",
        },
      },
      {
        name: "Magnesium",
        current: "~180 mg/d",
        target: "350–400 mg/d",
        gapPercent: 55,
        priority: "high",
        reason:
          "Hard training increases magnesium loss through sweat; a deficit hurts sleep and recovery.",
        evidence: "Few legumes, nuts or leafy greens in the log.",
        foodFix: "A handful of almonds, spinach, chickpeas, 85% dark chocolate.",
        supplement: {
          name: "Magnesium (citrate/glycinate)",
          dose: "400 mg",
          category: "mineral",
          times_per_day: 1,
          with_food: true,
          preferred_time: "bedtime",
        },
      },
      {
        name: "Omega-3 (EPA/DHA)",
        current: "~400 mg/d",
        target: "1500–2000 mg/d",
        gapPercent: 73,
        priority: "medium",
        reason: "Helps reduce joint inflammation after high weekly volume.",
        evidence: "Very few fish meals logged in the last 2 weeks.",
        foodFix: "Oily fish 2x/week, flaxseed, walnuts.",
        supplement: {
          name: "Omega-3 (EPA/DHA)",
          dose: "1500 mg",
          category: "omega",
          times_per_day: 1,
          with_food: true,
          preferred_time: "any",
        },
      },
    ],
  },
};

/** Deterministic result when the AI gateway is unavailable. */
export function fallbackMicroScan(lang: string, loggedDays: number): MicroScanResult {
  const c = FB[lang] ?? FB["en"]!;
  return {
    summary: c.summary,
    dataQuality: c.quality,
    loggedDays,
    findings: c.items.map((i, idx) => ({ ...i, key: `fb-${idx}` })),
    strengths: c.strengths,
    warnings: c.warnings,
    fallback: true,
  };
}
