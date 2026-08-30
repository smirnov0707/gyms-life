import React, { useState } from "react";
import { Utensils, Sparkles, Loader2, MapPin, AlertTriangle } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { recommendMenu } from "@/lib/food-vision.functions";

type MenuResult = {
  placeName: string;
  cuisine: string;
  known: boolean;
  avoid: string;
  fallback?: boolean;
  recommendations: { dish: string; kcal: number; protein: number; fitReason: string; orderTip: string }[];
};

type NearbyPlace = { name: string; kind: string };

export const DineOutMenuScanner: React.FC = () => {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const [restaurant, setRestaurant] = useState("");
  const [city, setCity] = useState("");
  const [locating, setLocating] = useState(false);
  const [nearby, setNearby] = useState<NearbyPlace[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<MenuResult | null>(null);
  const call = useServerFn(recommendMenu);

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("weight_kg, goal")
        .eq("id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: todayTotals } = useQuery({
    queryKey: ["nutrition", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("nutrition_logs")
        .select("logged_on, calories, protein")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(80);
      return data ?? [];
    },
    enabled: !!user,
    select: (rows) => {
      const today = new Date().toISOString().slice(0, 10);
      return (rows as { logged_on: string; calories: number; protein: number }[])
        .filter((r) => r.logged_on === today)
        .reduce(
          (acc, r) => ({ kcal: acc.kcal + Number(r.calories ?? 0), protein: acc.protein + Number(r.protein ?? 0) }),
          { kcal: 0, protein: 0 },
        );
    },
  });

  const weight = Number(profile?.weight_kg ?? 75);
  const goal = String(profile?.goal ?? "muscle");
  const kcalTarget = Math.round(weight * (goal === "lose" ? 28 : goal === "muscle" ? 38 : 34));
  const proteinTarget = Math.round(weight * 2);
  const kcalLeft = Math.max(0, kcalTarget - (todayTotals?.kcal ?? 0));
  const proteinLeft = Math.max(0, proteinTarget - (todayTotals?.protein ?? 0));

  /** Uses the browser location to fill in the city and list real venues around the user. */
  const detectLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      toast.error(t("sc.dine.locationUnavailable"));
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const rev = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&accept-language=${lang}`,
          ).then((r) => r.json());
          const addr = rev?.address ?? {};
          setCity(addr.city ?? addr.town ?? addr.village ?? addr.county ?? "");

          const query = `[out:json][timeout:20];node(around:900,${latitude},${longitude})["amenity"~"restaurant|cafe|fast_food"]["name"];out 20;`;
          const overpass = await fetch("https://overpass-api.de/api/interpreter", {
            method: "POST",
            body: query,
          }).then((r) => r.json());
          const places: NearbyPlace[] = (overpass?.elements ?? [])
            .map((el: { tags?: Record<string, string> }) => ({
              name: el.tags?.["name"] ?? "",
              kind: el.tags?.["cuisine"] ?? el.tags?.["amenity"] ?? "",
            }))
            .filter((p: NearbyPlace) => p.name)
            .slice(0, 8);
          setNearby(places);
          if (places.length === 0) toast.info(t("sc.dine.noNearby"));
        } catch {
          toast.error(t("sc.dine.locationUnavailable"));
        } finally {
          setLocating(false);
        }
      },
      () => {
        setLocating(false);
        toast.error(t("sc.dine.locationDenied"));
      },
      { enableHighAccuracy: false, timeout: 10000 },
    );
  };

  const handleScan = async (place?: string) => {
    const target = (place ?? restaurant).trim();
    if (!target) return;
    setRestaurant(target);
    setAnalyzing(true);
    setResult(null);
    try {
      const res = await call({
        data: { place: target, city, goal, kcalLeft, proteinLeft, lang },
      });
      setResult(res);
      if ((res as MenuResult).fallback) toast.info(t("sc.dine.offline"));
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="p-6 rounded-3xl border border-border bg-surface backdrop-blur-xl shadow-2xl space-y-4">
      <div className="flex items-center gap-2.5">
        <div className="p-2 rounded-xl bg-accent/10 text-accent border border-amber-500/20">
          <Utensils className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
            {t("sc.dine.title")} <Sparkles className="w-4 h-4 text-accent" />
          </h3>
          <p className="text-xs text-muted-foreground">{t("sc.dine.subtitle")}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono uppercase text-muted-foreground">
        <span className="rounded-md bg-surface-2 px-2 py-1">
          {t("sc.dine.budget").replace("{k}", String(Math.round(kcalLeft))).replace("{p}", String(Math.round(proteinLeft)))}
        </span>
        {city && (
          <span className="rounded-md bg-surface-2 px-2 py-1 flex items-center gap-1">
            <MapPin className="w-3 h-3" /> {city}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          placeholder={t("sc.dine.inputPlaceholder")}
          value={restaurant}
          onChange={(e) => setRestaurant(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleScan()}
          className="bg-surface border-border text-foreground text-xs"
        />
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={detectLocation}
            disabled={locating}
            className="text-xs rounded-xl"
          >
            {locating ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
            <span className="ml-1.5">{t("sc.dine.nearMe")}</span>
          </Button>
          <Button
            onClick={() => handleScan()}
            disabled={analyzing || !restaurant.trim()}
            size="sm"
            className="bg-accent hover:bg-amber-600 text-background font-bold rounded-xl text-xs px-4"
          >
            {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : t("sc.dine.analyzing")}
          </Button>
        </div>
      </div>

      {nearby.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {nearby.map((p) => (
            <button
              key={p.name}
              onClick={() => handleScan(p.name)}
              className="text-[11px] px-2.5 py-1 rounded-full border border-border bg-surface-2 text-foreground hover:border-accent transition"
            >
              {p.name}
            </button>
          ))}
        </div>
      )}

      {result && (
        <div className="space-y-2.5 pt-2 animate-in fade-in">
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span className="font-bold text-foreground">{result.placeName}</span>
            {result.cuisine && <span className="font-mono">· {result.cuisine}</span>}
            {!result.known && (
              <span className="flex items-center gap-1 text-accent">
                <AlertTriangle className="w-3 h-3" /> {t("sc.dine.estimated")}
              </span>
            )}
          </div>

          {result.recommendations.map((rec, i) => (
            <div key={i} className="p-3.5 rounded-2xl bg-surface border border-border space-y-1.5">
              <div className="flex justify-between items-start gap-3 text-xs">
                <span className="font-bold text-foreground text-sm">{rec.dish}</span>
                <span className="font-mono text-primary font-bold whitespace-nowrap">
                  {t("sc.dine.proteinKcal").replace("{p}", String(rec.protein)).replace("{k}", String(rec.kcal))}
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                <strong className="text-accent font-mono">{t("sc.dine.whyFits")}</strong> {rec.fitReason}
              </p>
              {rec.orderTip && (
                <p className="text-xs text-primary/80 leading-relaxed">
                  <strong className="font-mono">{t("sc.dine.orderTip")}</strong> {rec.orderTip}
                </p>
              )}
            </div>
          ))}

          {result.avoid && (
            <p className="text-xs text-muted-foreground">
              <strong className="text-rose-400 font-mono">{t("sc.dine.avoid")}</strong> {result.avoid}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
