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
    /**
     * Where that weight came from: a scale the athlete read, the photo scan's
     * guess, or the figure they stated at onboarding. Null when there is no
     * weight to attribute. Advice here is sized from body mass, so a model's
     * estimate must not be handed over as a weighing.
     */
    weightSource: "measured" | "photo_estimate" | "stated" | null;
    height: number | null;
    gender: string;
    goal: string | null;
    diet: string;
    birthYear: number | null;
  };
  /**
   * Null where the check-ins carried no such value. Zero is a reading — "this
   * athlete sleeps no hours", "this athlete has no readiness" — and it used to
   * be handed to the model as one whenever nothing had been recorded.
   */
  training: { sessions14d: number; avgSleep: number | null; avgReadiness: number | null };
  /**
   * Supporting sources whose query failed. The food log is not among them —
   * without it there is nothing to analyse, so that read throws instead.
   */
  unreadable: string[];
};

/**
 * The two prompt lines where a failed read would have done real harm.
 *
 * Told "none", a dietitian model recommends what the athlete already takes —
 * and this prompt asks it to weigh double-dosing risk, so an unreadable
 * supplement list turns a safety check into its opposite. Told zero sessions
 * and zero sleep, it reasons about a body at rest that has been training.
 */
export function supplementsLine(snap: MicroSnapshot): string {
  if (snap.unreadable.includes("supplements")) {
    return "SOURCE COULD NOT BE READ — do not conclude the athlete takes none, and do not recommend anything as if nothing were already covered";
  }
  return (
    snap.supplements.map((s) => `${s.name} ${s.dose} x${s.times_per_day}`).join("; ") || "none"
  );
}

export function trainingLine(snap: MicroSnapshot): string {
  if (
    snap.unreadable.includes("training sessions") ||
    snap.unreadable.includes("daily check-ins")
  ) {
    return "SOURCE COULD NOT BE READ";
  }
  const sleep = snap.training.avgSleep === null ? "not recorded" : `${snap.training.avgSleep} h`;
  const readiness =
    snap.training.avgReadiness === null ? "not recorded" : snap.training.avgReadiness;
  return `${snap.training.sessions14d} sessions in 14 days, avg sleep ${sleep}, avg readiness ${readiness}`;
}

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
      .select("weight_kg, weight_source")
      .eq("user_id", userId)
      .order("measured_on", { ascending: false })
      .limit(30),
  ]);

  // The whole analysis is about what the athlete ate. A failed food read used
  // to arrive as an empty array, which becomes "0 kcal, 0 g protein, food log
  // empty" in a prompt the model is told to reason only from — and a
  // micronutrient gap analysis run on nothing finds a gap in everything.
  if (foods.error) throw new Error(foods.error.message);

  const unreadable = (
    [
      ["supplements", sups.error],
      ["profile", prof.error],
      ["training sessions", sessions.error],
      ["daily check-ins", checkins.error],
      ["body measurements", weights.error],
    ] satisfies [string, unknown][]
  )
    .filter(([, error]) => error)
    .map(([source]) => source);

  const rows = foods.data ?? [];

  const dayKeys = new Set(rows.map((r) => r.logged_on));
  const dayCount = Math.max(1, dayKeys.size);
  const totalKcal = rows.reduce((a, r) => a + Number(r.calories ?? 0), 0);
  const totalProtein = rows.reduce((a, r) => a + Number(r.protein ?? 0), 0);

  const ci = checkins.data ?? [];
  // Null for an empty list, never zero, and a genuine zero among the values is
  // kept: `filter(Boolean)` used to drop it alongside the absent ones.
  const num = (value: unknown) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };
  const avg = (values: (number | null)[]) => {
    const present = values.filter((value): value is number => value !== null);
    return present.length ? present.reduce((a, b) => a + b, 0) / present.length : null;
  };
  const round1 = (value: number | null) => (value === null ? null : Math.round(value * 10) / 10);
  const roundOrNull = (value: number | null) => (value === null ? null : Math.round(value));

  const profile = prof.data;
  const bodyWeight = resolveBodyWeight(weights.data ?? [], profile?.weight_kg ?? null);

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
      // The source travels with the number: a weight the photo scan guessed
      // from an image is not the same evidence as one off a scale, and this
      // scan's advice is sized from body mass.
      weight: bodyWeight.weightKg,
      weightSource: bodyWeight.source,
      height: profile?.height_cm == null ? null : Number(profile.height_cm),
      gender: profile?.gender ?? "unknown",
      goal: profile?.goal ?? null,
      diet: profile?.diet ?? "any",
      birthYear: profile?.birth_year ?? null,
    },
    unreadable,
    training: {
      sessions14d: (sessions.data ?? []).length,
      avgSleep: round1(avg(ci.map((c) => num(c.sleep_hours)))),
      avgReadiness: roundOrNull(avg(ci.map((c) => num(c.readiness_score)))),
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
