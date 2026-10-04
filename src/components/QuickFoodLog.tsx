import { useRef, useState } from "react";
import { Loader2, Sparkles, Utensils } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { aiErrorMessage } from "@/lib/ai-error";
import { refreshCoreData } from "@/lib/core-cache";
import { useI18n } from "@/lib/i18n";
import { browserTimeZone } from "@/lib/local-day";
import { logMeal } from "@/lib/nutrition.functions";

export function QuickFoodLog({ compact = false }: { compact?: boolean }) {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const call = useServerFn(logMeal);
  const [text, setText] = useState("");
  const mealLock = useRef(false);

  const add = useMutation({
    mutationFn: async () => {
      if (mealLock.current) return false;
      mealLock.current = true;
      try {
        await call({ data: { description: text, lang, timeZone: browserTimeZone() } });
        return true;
      } finally {
        mealLock.current = false;
      }
    },
    onSuccess: (saved) => {
      if (!saved) return;
      setText("");
      void refreshCoreData(qc, "nutrition");
    },
    onError: (error) => toast.error(aiErrorMessage(error, t)),
  });

  return (
    <div className={compact ? "grid gap-3" : "fl-workspace-panel fl-meal-entry p-5 sm:p-6"}>
      <div className="flex items-center gap-2">
        <Utensils className="size-4 text-primary" />
        <p id="quick-food-log-label" className="text-sm font-semibold text-foreground">
          {t("action.logFood")}
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <Input
          aria-labelledby="quick-food-log-label"
          value={text}
          disabled={add.isPending}
          maxLength={400}
          onChange={(event) => setText(event.target.value)}
          placeholder={t("nut.ph")}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              !add.isPending &&
              !mealLock.current &&
              text.trim().length > 1
            ) {
              event.preventDefault();
              add.mutate();
            }
          }}
          className="h-11 w-full border-border bg-surface-2"
        />
        <Button
          className="min-h-11 rounded-full px-5 font-bold"
          disabled={add.isPending || text.trim().length < 2}
          onClick={() => add.mutate()}
        >
          {add.isPending ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Sparkles className="mr-2 size-4" />
          )}
          {add.isPending ? t("nut.analyzing") : t("nut.add")}
        </Button>
      </div>
    </div>
  );
}
