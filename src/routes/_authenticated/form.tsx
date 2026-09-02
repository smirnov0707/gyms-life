import { createFileRoute } from "@tanstack/react-router";
import { BiomechanicsScanner } from "@/components/BiomechanicsScanner";
import { useI18n } from "@/lib/i18n";
import { ShieldCheck, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/form")({
  component: FormRouteComponent,
});

function FormRouteComponent() {
  const { t, lang } = useI18n();

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6 pb-24">
      {/* Antraštė */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              {lang === "lt" ? "AI Formos & Biomechanikos Analizė" : "AI Form & Biomechanics"}
            </h1>
            <p className="text-xs font-mono text-neutral-400">
              {lang === "lt"
                ? "Automatinis sąnarių kampų, stuburo ir saugumo įvertinimas"
                : "Kinematic joint angle & spine safety assessment"}
            </p>
          </div>
        </div>
      </div>

      {/* Pagrindinis regos skeneris */}
      <BiomechanicsScanner />
    </div>
  );
}
