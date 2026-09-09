import { useI18n, baseLang } from "@/lib/i18n";
import type { GeneratedMealPlan } from "@/lib/meal-plan.schema";
import { findKnownRecipeConflicts, type RecipePreferences } from "@/lib/meal-restrictions.engine";
export function MealPlanReviewNotice({
  plan,
  preferences,
}: {
  plan: GeneratedMealPlan;
  preferences: RecipePreferences | null;
}) {
  const { lang } = useI18n(),
    en = baseLang(lang) === "en";
  const conflicts = preferences ? findKnownRecipeConflicts(plan.days, preferences) : [];
  const examples = [...new Set(conflicts.map((conflict) => conflict.ingredient))].slice(0, 4);
  return (
    <section
      role={conflicts.length ? "alert" : "note"}
      aria-label={en ? "Recipe review" : "Receptų patikra"}
      className={`rounded-2xl border p-4 text-sm leading-6 ${conflicts.length ? "border-destructive/40 bg-destructive/5" : "border-border bg-surface"}`}
    >
      <p className="font-semibold">
        {conflicts.length
          ? en
            ? "This saved plan has a possible restriction conflict. Do not use the affected recipe without checking it."
            : "Išsaugotame plane aptiktas galimas neatitikimas apribojimui. Nenaudok pažymėto recepto jo nepatikrinęs."
          : en
            ? "Check ingredients and serving amounts before cooking."
            : "Prieš gamindamas patikrink ingredientus ir porcijų kiekius."}
      </p>
      {examples.length > 0 && <p className="mt-2 break-words">{examples.join(" · ")}</p>}
      <p className="mt-2 text-muted-foreground">
        {en
          ? "AI recipe quantities and nutrition are estimates. Automatic text checks cover only known terms and do not certify allergen-free food. Check product labels and cross-contact risks; a vegan or lactose-free label does not by itself exclude every allergen."
          : "AI pateikti receptų kiekiai ir maistinė vertė yra įverčiai. Automatinė teksto patikra atpažįsta tik dalį terminų ir negarantuoja, kad maiste nėra alergenų. Patikrink produktų etiketes ir kryžminio kontakto riziką; užrašas „veganiškas“ ar „be laktozės“ savaime neatmeta visų alergenų."}
      </p>
    </section>
  );
}
