import React, { useState } from "react";
import { Sparkles, Plus, Trash2, ChefHat, Loader2, Clock, RefreshCw, Info } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { generateFridgeRecipe } from "@/lib/fridge.functions";

type Recipe = {
  title: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  time: string;
  steps: string[];
  usedIngredients: string[];
  missingSuggestion: string;
  coachNote: string;
  fallback: boolean;
};

export const SmartFridgeScanner: React.FC = () => {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const [ingredients, setIngredients] = useState<string[]>(["Kiaušiniai", "Varškė", "Avižos"]);
  const [inputVal, setInputVal] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [variant, setVariant] = useState(0);
  const [recipeResult, setRecipeResult] = useState<Recipe | null>(null);
  /** Signature of the ingredients the current recipe was built from. */
  const [recipeFor, setRecipeFor] = useState("");
  const call = useServerFn(generateFridgeRecipe);

  const signature = ingredients.map((i) => i.toLowerCase().trim()).sort().join("|");
  const stale = !!recipeResult && recipeFor !== signature;

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("weight_kg, goal").eq("id", user!.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const weight = Number(profile?.weight_kg ?? 75);
  const goal = String(profile?.goal ?? "muscle");

  const addIngredient = () => {
    const v = inputVal.trim();
    if (!v) return;
    if (ingredients.some((i) => i.toLowerCase() === v.toLowerCase())) {
      setInputVal("");
      return;
    }
    setIngredients([...ingredients, v]);
    setInputVal("");
  };

  const handleGenerate = async (nextVariant?: number) => {
    if (ingredients.length === 0) return;
    const seed = nextVariant ?? variant;
    setIsGenerating(true);
    setRecipeResult(null);
    try {
      const res = (await call({
        data: {
          ingredients,
          lang,
          goal,
          kcalLeft: Math.round(weight * (goal === "lose" ? 28 : goal === "muscle" ? 38 : 34)),
          proteinLeft: Math.round(weight * 2),
          variant: seed,
        },
      })) as Recipe;
      setRecipeResult(res);
      setRecipeFor(signature);
      if (res.fallback) toast.info(t("sc.fridge.offline"));
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-b from-surface to-surface p-6 backdrop-blur-xl shadow-2xl">
      <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-2xl">
          <ChefHat className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
            {t("sc.fridge.title")} <Sparkles className="w-4 h-4 text-accent" />
          </h3>
          <p className="text-xs text-muted-foreground">{t("sc.fridge.subtitle")}</p>
        </div>
      </div>

      {/* Input row */}
      <div className="flex gap-2 mb-4">
        <Input
          placeholder={t("sc.fridge.inputPlaceholder")}
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addIngredient()}
          className="bg-surface border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-indigo-500"
        />
        <Button
          onClick={addIngredient}
          variant="secondary"
          aria-label={t("sc.fridge.add")}
          className="bg-surface-2 hover:bg-muted text-foreground"
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      {/* Ingredient Chips */}
      <div className="flex flex-wrap gap-2 mb-6">
        {ingredients.map((item, idx) => (
          <span
            key={`${item}-${idx}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-2 border border-border text-xs font-medium text-foreground"
          >
            {item}
            <button
              aria-label={`${t("sc.fridge.remove")}: ${item}`}
              onClick={() => setIngredients(ingredients.filter((_, i) => i !== idx))}
              className="text-muted-foreground hover:text-rose-400 transition-colors"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>

      <Button
        onClick={() => handleGenerate()}
        disabled={isGenerating || ingredients.length === 0}
        className="w-full bg-gradient-to-r from-indigo-500 via-indigo-600 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-foreground font-semibold py-6 rounded-2xl shadow-lg shadow-indigo-500/20 transition-all duration-300"
      >
        {isGenerating ? (
          <span className="flex items-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /> {t("sc.fridge.generating")}
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" /> {t("sc.fridge.generate")}
          </span>
        )}
      </Button>

      {stale && !isGenerating && (
        <p className="mt-3 text-[11px] text-accent flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5" /> {t("sc.fridge.stale")}
        </p>
      )}

      {/* Result Card */}
      {recipeResult && (
        <div className="mt-6 p-5 rounded-2xl bg-surface border border-border space-y-4 animate-in fade-in slide-in-from-bottom-3 duration-300">
          <div className="flex justify-between items-start gap-3">
            <h4 className="font-bold text-foreground text-base">{recipeResult.title}</h4>
            <span className="text-xs font-mono px-2.5 py-1 rounded-md bg-indigo-950/80 text-indigo-400 border border-indigo-800/50 flex items-center gap-1 shrink-0">
              <Clock className="w-3 h-3" /> {recipeResult.time}
            </span>
          </div>

          {recipeResult.usedIngredients.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {recipeResult.usedIngredients.map((i) => (
                <span key={i} className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-surface-2 text-muted-foreground border border-border">
                  {i}
                </span>
              ))}
            </div>
          )}

          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="p-2 rounded-xl bg-surface border border-border">
              <span className="block text-[10px] text-muted-foreground uppercase font-mono">{t("sc.fridge.kcal")}</span>
              <span className="font-bold text-sm text-foreground">{recipeResult.calories}</span>
            </div>
            <div className="p-2 rounded-xl bg-surface border border-border">
              <span className="block text-[10px] text-muted-foreground uppercase font-mono">{t("sc.fridge.protein")}</span>
              <span className="font-bold text-sm text-primary">{recipeResult.protein}g</span>
            </div>
            <div className="p-2 rounded-xl bg-surface border border-border">
              <span className="block text-[10px] text-muted-foreground uppercase font-mono">{t("sc.fridge.carbs")}</span>
              <span className="font-bold text-sm text-accent">{recipeResult.carbs}g</span>
            </div>
            <div className="p-2 rounded-xl bg-surface border border-border">
              <span className="block text-[10px] text-muted-foreground uppercase font-mono">{t("sc.fridge.fat")}</span>
              <span className="font-bold text-sm text-rose-400">{recipeResult.fat}g</span>
            </div>
          </div>

          <div className="space-y-1.5 pt-2">
            {recipeResult.steps.map((step: string, i: number) => (
              <p key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                <span className="font-bold text-indigo-400">{i + 1}.</span> {step}
              </p>
            ))}
          </div>

          {recipeResult.coachNote && (
            <p className="text-xs text-foreground/80 border-l-2 border-indigo-500/60 pl-3">{recipeResult.coachNote}</p>
          )}
          {recipeResult.missingSuggestion && (
            <p className="text-[11px] text-muted-foreground">{recipeResult.missingSuggestion}</p>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const next = variant + 1;
              setVariant(next);
              void handleGenerate(next);
            }}
            disabled={isGenerating}
            className="rounded-xl text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> {t("sc.fridge.another")}
          </Button>
        </div>
      )}
    </div>
  );
};
