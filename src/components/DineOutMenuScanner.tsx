import React, { useState } from "react";
import { Utensils, Search, Loader2, Sparkles, Check, ChevronRight, AlertCircle } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { useI18n } from "@/lib/i18n";
import { searchRestaurantDishes } from "@/lib/dineout.functions";

export const DineOutMenuScanner: React.FC = () => {
  const { lang } = useI18n();
  const searchFn = useServerFn(searchRestaurantDishes);

  const [searchQuery, setSearchQuery] = useState("");
  const [goal, setGoal] = useState<"muscle_gain" | "fat_loss" | "healthy">("muscle_gain");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{
    ok: boolean;
    canonicalRestaurantName?: string;
    category?: string;
    dishes?: Array<{
      name: string;
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
      recommendationReason: string;
      fitScore: number;
    }>;
    coachTip?: string;
    reason?: string;
  } | null>(null);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) {
      toast.error(lang === "lt" ? "Įveskite restorano pavadinimą" : "Enter restaurant name");
      return;
    }

    setIsLoading(true);
    setResult(null);
    try {
      const res = await searchFn({
        data: {
          query: searchQuery.trim(),
          goal,
          lang: lang || "lt",
        },
      });

      setResult(res);
      if (res.ok) {
        toast.success(
          lang === "lt" 
            ? `Rastas meniu: ${res.canonicalRestaurantName}` 
            : `Found menu: ${res.canonicalRestaurantName}`
        );
      } else {
        toast.error(res.reason || (lang === "lt" ? "Restoranas nerastas" : "Restaurant not found"));
      }
    } catch (err: any) {
      toast.error(err?.message || (lang === "lt" ? "Klaida ieškant meniu" : "Search error"));
    } finally {
      setIsLoading(false);
    }
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
    <div className="rounded-2xl bg-neutral-900/80 border border-white/10 p-4 sm:p-6 backdrop-blur-xl shadow-2xl space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-orange-500/10 border border-orange-500/30 text-orange-400">
            <Utensils className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white">
              {lang === "lt" ? "Restoranų ir Kavinių AI Asistentas" : "Restaurant & Cafe AI Assistant"}
            </h3>
            <p className="text-xs font-mono text-neutral-400">
              {lang === "lt" ? "Smart fuzzy-matching & fitneso patiekalų parinkimas" : "Smart fuzzy-matching & healthy picks"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/50 border border-orange-500/30">
          <Sparkles className="w-3.5 h-3.5 text-orange-400" />
          <span className="text-[10px] font-mono text-orange-300 font-bold">NEURAL PICK</span>
        </div>
      </div>

      {/* Tikslo pasirinkimas */}
      <div className="flex items-center gap-2 p-1 rounded-xl bg-black/40 border border-white/5 text-xs">
        <button
          type="button"
          onClick={() => setGoal("muscle_gain")}
          className={`flex-1 py-1.5 px-3 rounded-lg font-medium transition-all ${
            goal === "muscle_gain"
              ? "bg-orange-500/20 text-orange-300 border border-orange-500/30 font-bold"
              : "text-neutral-400 hover:text-white"
          }`}
        >
          💪 {lang === "lt" ? "Raumenų auginimas" : "Muscle Gain"}
        </button>
        <button
          type="button"
          onClick={() => setGoal("fat_loss")}
          className={`flex-1 py-1.5 px-3 rounded-lg font-medium transition-all ${
            goal === "fat_loss"
              ? "bg-orange-500/20 text-orange-300 border border-orange-500/30 font-bold"
              : "text-neutral-400 hover:text-white"
          }`}
        >
          🔥 {lang === "lt" ? "Svorio metimas" : "Fat Loss"}
        </button>
        <button
          type="button"
          onClick={() => setGoal("healthy")}
          className={`flex-1 py-1.5 px-3 rounded-lg font-medium transition-all ${
            goal === "healthy"
              ? "bg-orange-500/20 text-orange-300 border border-orange-500/30 font-bold"
              : "text-neutral-400 hover:text-white"
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
            placeholder={lang === "lt" ? "Pvz.: mcdonals, hesburger, subway, cili..." : "E.g. mcdonalds, chipotle, subway..."}
            className="bg-black/50 border-white/10 text-white placeholder:text-neutral-500 pl-3 pr-3 text-sm focus:border-orange-500/50"
          />
        </div>
        <Button
          type="submit"
          disabled={isLoading}
          className="bg-orange-600 hover:bg-orange-500 text-white px-4 gap-2 font-medium"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          <span className="hidden sm:inline">{lang === "lt" ? "Rasti" : "Find"}</span>
        </Button>
      </form>

      {/* Greitos parinktys */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-mono text-neutral-500 mr-1">
          {lang === "lt" ? "Populiarūs:" : "Popular:"}
        </span>
        {popularPlaces.map((p) => (
          <button
            key={p.query}
            type="button"
            onClick={() => {
              setSearchQuery(p.query);
              setTimeout(() => {
                searchFn({
                  data: { query: p.query, goal, lang: lang || "lt" },
                }).then(setResult);
              }, 50);
            }}
            className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-white/5 hover:bg-white/10 text-neutral-300 border border-white/5 transition-colors"
          >
            {p.name}
          </button>
        ))}
      </div>

      {/* Rezultatų rodymas */}
      {result && (
        <div className="space-y-4 pt-2 border-t border-white/10">
          {result.ok ? (
            <>
              <div className="flex items-center justify-between bg-orange-500/10 border border-orange-500/20 p-3 rounded-xl">
                <div>
                  <span className="text-[10px] font-mono text-orange-400 uppercase tracking-wider block">
                    {lang === "lt" ? "ATPAŽINTAS RESTORANAS" : "RECOGNIZED RESTAURANT"}
                  </span>
                  <h4 className="text-base sm:text-lg font-bold text-white">
                    {result.canonicalRestaurantName}
                  </h4>
                </div>
                {result.category && (
                  <span className="text-xs font-mono px-2.5 py-1 rounded bg-black/40 text-neutral-300 border border-white/10">
                    {result.category}
                  </span>
                )}
              </div>

              {result.coachTip && (
                <div className="p-3 rounded-xl bg-neutral-950/80 border border-white/10 text-xs text-neutral-300 leading-relaxed flex items-start gap-2">
                  <span className="text-base">💡</span>
                  <div>
                    <strong className="text-orange-400 font-medium block mb-0.5">
                      {lang === "lt" ? "Trenerio patarimas užsakymui:" : "Coach Ordering Tip:"}
                    </strong>
                    {result.coachTip}
                  </div>
                </div>
              )}

              <div className="space-y-2.5">
                <span className="text-xs font-mono text-neutral-400 uppercase tracking-wider block">
                  {lang === "lt" ? "REKOMENDUOJAMI PATIEKALAI PAGAL JŪSŲ TIKSLĄ:" : "TOP PICKS FOR YOUR GOAL:"}
                </span>

                {result.dishes?.map((dish, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-black/50 border border-white/10 hover:border-orange-500/30 transition-all space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h5 className="text-sm font-bold text-white flex items-center gap-1.5">
                          <Check className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                          {dish.name}
                        </h5>
                        <p className="text-xs text-neutral-400 mt-0.5 leading-relaxed">
                          {dish.recommendationReason}
                        </p>
                      </div>
                      <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-orange-500/20 text-orange-300 border border-orange-500/30 shrink-0">
                        {dish.fitScore}% FIT
                      </span>
                    </div>

                    <div className="grid grid-cols-4 gap-1.5 text-center pt-1.5 border-t border-white/5 text-xs font-mono">
                      <div className="bg-neutral-900/80 py-1 rounded">
                        <span className="text-neutral-500 text-[9px] block">KCAL</span>
                        <span className="font-bold text-white">{dish.calories}</span>
                      </div>
                      <div className="bg-neutral-900/80 py-1 rounded">
                        <span className="text-blue-400 text-[9px] block">BALTYMAI</span>
                        <span className="font-bold text-blue-300">{dish.protein}g</span>
                      </div>
                      <div className="bg-neutral-900/80 py-1 rounded">
                        <span className="text-amber-400 text-[9px] block">ANGLIAV.</span>
                        <span className="font-bold text-amber-300">{dish.carbs}g</span>
                      </div>
                      <div className="bg-neutral-900/80 py-1 rounded">
                        <span className="text-rose-400 text-[9px] block">RIEBALAI</span>
                        <span className="font-bold text-rose-300">{dish.fat}g</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center space-y-2">
              <AlertCircle className="w-5 h-5 text-amber-400 mx-auto" />
              <p className="text-xs text-neutral-300">{result.reason}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DineOutMenuScanner;
