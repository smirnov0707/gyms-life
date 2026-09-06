import React, { useState } from "react";
import {
  Utensils,
  Search,
  Loader2,
  Sparkles,
  Check,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { useI18n } from "@/lib/i18n";
import { calculateDishFit, type DishFitBand } from "@/lib/dish-fit.engine";
import { searchRestaurantDishes, type RestaurantSearchResult } from "@/lib/dineout.functions";
import { errorMessage } from "@/lib/error-message";

/**
 * How the dish sits against the goal, and what that was decided from.
 *
 * There is no percentage here on purpose. The macros are a model's estimate
 * of a menu item, and a two-significant-figure score on top of an estimate
 * claims a precision nothing has. A band plus the figure it came from lets
 * the athlete check the reasoning instead of trusting a number.
 */
const BAND_TONE: Record<DishFitBand, string> = {
  strong:
    "bg-emerald-500/15 text-emerald-300 border-emerald-500/30 light:text-emerald-700 light:bg-emerald-600/10",
  workable:
    "bg-amber-500/15 text-amber-300 border-amber-500/30 light:text-amber-700 light:bg-amber-600/10",
  poor: "bg-foreground/[0.06] text-muted-foreground border-border",
};

const BAND_LABEL: Record<DishFitBand, { lt: string; en: string }> = {
  strong: { lt: "TINKA", en: "STRONG FIT" },
  workable: { lt: "TIKS", en: "WORKABLE" },
  poor: { lt: "PRASTAI TINKA", en: "POOR FIT" },
};

function DishFitBadge({
  dish,
  goal,
  lang,
}: {
  dish: { calories: number; protein: number; fat: number };
  goal: "muscle_gain" | "fat_loss" | "healthy";
  lang: string;
}) {
  const fit = calculateDishFit(dish, goal);
  if (fit.band === null) return null;

  const label = BAND_LABEL[fit.band];
  return (
    <span className="shrink-0 text-right">
      <span
        className={`block rounded border px-2 py-0.5 text-xs font-mono font-bold ${BAND_TONE[fit.band]}`}
      >
        {lang === "lt" ? label.lt : label.en}
      </span>
      <span className="mt-0.5 block font-mono text-[9px] text-muted-foreground">
        {fit.proteinPer100Kcal}
        {lang === "lt" ? " g baltymų / 100 kcal" : " g protein / 100 kcal"}
      </span>
    </span>
  );
}

export const DineOutMenuScanner: React.FC = () => {
  const { lang } = useI18n();
  const searchFn = useServerFn(searchRestaurantDishes);

  const [searchQuery, setSearchQuery] = useState("");
  const [goal, setGoal] = useState<"muscle_gain" | "fat_loss" | "healthy">("muscle_gain");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<RestaurantSearchResult | null>(null);

  const search = async (query: string) => {
    setIsLoading(true);
    setResult(null);
    try {
      const res = await searchFn({
        data: {
          query,
          goal,
          lang: lang || "lt",
        },
      });

      setResult(res);
      if (res.ok) {
        toast.success(
          lang === "lt"
            ? `Rastas meniu: ${res.canonicalRestaurantName}`
            : `Found menu: ${res.canonicalRestaurantName}`,
        );
      } else {
        toast.error(
          errorMessage(res.reason, lang === "lt" ? "Restoranas nerastas" : "Restaurant not found"),
        );
      }
    } catch (error: unknown) {
      toast.error(errorMessage(error, lang === "lt" ? "Klaida ieškant meniu" : "Search error"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (!query) {
      toast.error(lang === "lt" ? "Įveskite restorano pavadinimą" : "Enter restaurant name");
      return;
    }
    await search(query);
  };

  const popularPlaces = [
    { name: "McDonald's", query: "mcdonalds" },
    { name: "Hesburger", query: "hesburger" },
    { name: "Subway", query: "subway" },
    { name: "KFC", query: "kfc" },
    { name: "Čili Pizza", query: "cili pica" },
    { name: "Sushi Express", query: "sushi express" },
  ];

  return (
    <div className="rounded-2xl bg-surface-2 border border-border p-4 sm:p-6 backdrop-blur-xl shadow-2xl space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-orange-500/10 border border-orange-500/30 text-orange-400 light:text-orange-700">
            <Utensils className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-foreground">
              {lang === "lt"
                ? "Restoranų ir Kavinių AI Asistentas"
                : "Restaurant & Cafe AI Assistant"}
            </h3>
            <p className="text-xs font-mono text-muted-foreground">
              {lang === "lt"
                ? "Smart fuzzy-matching & fitneso patiekalų parinkimas"
                : "Smart fuzzy-matching & healthy picks"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface border border-orange-500/30">
          <Sparkles className="w-3.5 h-3.5 text-orange-400 light:text-orange-700" />
          <span className="text-[10px] font-mono text-orange-300 light:text-orange-700 font-bold">
            NEURAL PICK
          </span>
        </div>
      </div>

      {/* Tikslo pasirinkimas */}
      <div className="flex items-center gap-2 p-1 rounded-xl bg-surface border border-border text-xs">
        <button
          type="button"
          onClick={() => setGoal("muscle_gain")}
          className={`flex-1 py-1.5 px-3 rounded-lg font-medium transition-all ${
            goal === "muscle_gain"
              ? "bg-orange-500/20 text-orange-300 light:text-orange-700 border border-orange-500/30 font-bold"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          💪 {lang === "lt" ? "Raumenų auginimas" : "Muscle Gain"}
        </button>
        <button
          type="button"
          onClick={() => setGoal("fat_loss")}
          className={`flex-1 py-1.5 px-3 rounded-lg font-medium transition-all ${
            goal === "fat_loss"
              ? "bg-orange-500/20 text-orange-300 light:text-orange-700 border border-orange-500/30 font-bold"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          🔥 {lang === "lt" ? "Svorio metimas" : "Fat Loss"}
        </button>
        <button
          type="button"
          onClick={() => setGoal("healthy")}
          className={`flex-1 py-1.5 px-3 rounded-lg font-medium transition-all ${
            goal === "healthy"
              ? "bg-orange-500/20 text-orange-300 light:text-orange-700 border border-orange-500/30 font-bold"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          🥗 {lang === "lt" ? "Balansas" : "Balanced"}
        </button>
      </div>

      {/* Paieškos laukelis */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            maxLength={120}
            placeholder={
              lang === "lt"
                ? "Pvz.: mcdonals, hesburger, subway, cili..."
                : "E.g. mcdonalds, chipotle, subway..."
            }
            className="bg-surface border-border text-foreground placeholder:text-muted-foreground pl-3 pr-3 text-sm focus:border-orange-500/50"
          />
        </div>
        <Button
          type="submit"
          disabled={isLoading}
          className="bg-orange-600 hover:bg-orange-500 text-white px-4 gap-2 font-medium"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Search className="w-4 h-4" />
          )}
          <span className="hidden sm:inline">{lang === "lt" ? "Rasti" : "Find"}</span>
        </Button>
      </form>

      {/* Greitos parinktys */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-mono text-muted-foreground mr-1">
          {lang === "lt" ? "Populiarūs:" : "Popular:"}
        </span>
        {popularPlaces.map((p) => (
          <button
            key={p.query}
            type="button"
            onClick={() => {
              setSearchQuery(p.query);
              void search(p.query);
            }}
            className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-foreground/[0.06] hover:bg-foreground/10 text-foreground border border-border transition-colors"
          >
            {p.name}
          </button>
        ))}
      </div>

      {/* Rezultatų rodymas */}
      {result && (
        <div className="space-y-4 pt-2 border-t border-border">
          {result.ok ? (
            <>
              <div className="flex items-center justify-between bg-orange-500/10 border border-orange-500/20 p-3 rounded-xl">
                <div>
                  <span className="text-[10px] font-mono text-orange-400 light:text-orange-700 uppercase tracking-wider block">
                    {lang === "lt" ? "ATPAŽINTAS RESTORANAS" : "RECOGNIZED RESTAURANT"}
                  </span>
                  <h4 className="text-base sm:text-lg font-bold text-foreground">
                    {result.canonicalRestaurantName}
                  </h4>
                </div>
                <span className="text-xs font-mono px-2.5 py-1 rounded bg-surface text-foreground border border-border">
                  {result.category}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-surface border border-border text-xs text-foreground leading-relaxed flex items-start gap-2">
                <span className="text-base">💡</span>
                <div>
                  <strong className="text-orange-400 light:text-orange-700 font-medium block mb-0.5">
                    {lang === "lt" ? "Trenerio patarimas užsakymui:" : "Coach Ordering Tip:"}
                  </strong>
                  {result.coachTip}
                </div>
              </div>

              <div className="space-y-2.5">
                <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider block">
                  {lang === "lt"
                    ? "REKOMENDUOJAMI PATIEKALAI PAGAL JŪSŲ TIKSLĄ:"
                    : "TOP PICKS FOR YOUR GOAL:"}
                </span>

                {result.dishes.map((dish, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-surface border border-border hover:border-orange-500/30 transition-all space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h5 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                          <Check className="w-3.5 h-3.5 text-orange-400 light:text-orange-700 shrink-0" />
                          {dish.name}
                        </h5>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                          {dish.recommendationReason}
                        </p>
                      </div>
                      <DishFitBadge dish={dish} goal={goal} lang={lang} />
                    </div>

                    <div className="grid grid-cols-4 gap-1.5 text-center pt-1.5 border-t border-border text-xs font-mono">
                      <div className="bg-surface-2 py-1 rounded">
                        <span className="text-muted-foreground text-[9px] block">KCAL</span>
                        <span className="font-bold text-foreground">{dish.calories}</span>
                      </div>
                      <div className="bg-surface-2 py-1 rounded">
                        <span className="text-blue-400 light:text-blue-700 text-[9px] block">
                          BALTYMAI
                        </span>
                        <span className="font-bold text-blue-300 light:text-blue-700">
                          {dish.protein}g
                        </span>
                      </div>
                      <div className="bg-surface-2 py-1 rounded">
                        <span className="text-amber-400 light:text-amber-700 text-[9px] block">
                          ANGLIAV.
                        </span>
                        <span className="font-bold text-amber-300 light:text-amber-700">
                          {dish.carbs}g
                        </span>
                      </div>
                      <div className="bg-surface-2 py-1 rounded">
                        <span className="text-rose-400 light:text-rose-700 text-[9px] block">
                          RIEBALAI
                        </span>
                        <span className="font-bold text-rose-300 light:text-rose-700">
                          {dish.fat}g
                        </span>
                      </div>
                    </div>
                  </div>
                ))}

                {/* These are not looked-up nutrition tables. The model is
                    recalling a menu, and a monospace grid of round numbers
                    reads as measurement unless it is told otherwise. */}
                <p className="pt-1 text-[10px] leading-relaxed text-muted-foreground">
                  {lang === "lt"
                    ? "Maistinė vertė — modelio įvertis pagal tai, ką jis žino apie šį meniu, o ne restorano duomenys. Tikslių skaičių ieškok restorano informacijoje."
                    : "The nutrition figures are the model's estimate from what it knows of this menu, not the restaurant's own data. Check the restaurant's information for exact numbers."}
                </p>
              </div>
            </>
          ) : (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center space-y-2">
              <AlertCircle className="w-5 h-5 text-amber-400 light:text-amber-700 mx-auto" />
              <p className="text-xs text-foreground">{result.reason}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DineOutMenuScanner;
