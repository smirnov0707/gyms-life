import React, { useState } from "react";
import { FileText, Download, Sparkles, RefreshCw, AlertTriangle, Stethoscope, CheckCircle2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "./ui/button";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { getMedicalReport, type MedicalReport } from "@/lib/medical-report.functions";

export const WorkoutReportExporter: React.FC = () => {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const run = useServerFn(getMedicalReport);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [report, setReport] = useState<MedicalReport | null>(null);

  const generate = async () => {
    setLoading(true);
    try {
      const result = (await run({ data: { lang } })) as MedicalReport;
      setReport(result);
      toast.success(t("sc.report.ready"));
    } catch (error) {
      console.error(error);
      toast.error(t("sc.report.failed"));
    } finally {
      setLoading(false);
    }
  };

  const download = async () => {
    if (!report) return;
    setDownloading(true);
    try {
      const { downloadMedicalReportPdf } = await import("@/lib/medical-report-pdf");
      const name =
        (user?.user_metadata?.["display_name"] as string) ?? (user?.email as string) ?? "";
      await downloadMedicalReportPdf(report, lang, name);
      toast.success(t("sc.report.pdfSaved"));
    } catch (error) {
      console.error(error);
      toast.error(t("sc.report.failed"));
    } finally {
      setDownloading(false);
    }
  };

  const s = report?.stats;

  return (
    <div className="p-5 sm:p-6 rounded-3xl border border-border bg-surface backdrop-blur-xl shadow-2xl space-y-5">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shrink-0">
          <FileText className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider break-words">
            {t("sc.report.title")}
          </h3>
          <p className="text-xs text-muted-foreground">{t("sc.report.subtitle")}</p>
        </div>
      </div>

      {s && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center text-xs">
          {[
            { k: t("sc.report.sessions"), v: `${s.sessions}` },
            { k: t("sc.report.totalTonnage"), v: `${Math.round(s.totalVolumeKg / 1000)} t` },
            { k: t("sc.report.readiness"), v: s.avgReadiness != null ? `${s.avgReadiness}` : "—" },
            { k: t("sc.report.sleep"), v: s.avgSleepHours != null ? `${s.avgSleepHours} h` : "—" },
          ].map((cell) => (
            <div key={cell.k} className="p-3 rounded-2xl bg-surface-2 border border-border">
              <span className="block text-[10px] font-mono text-muted-foreground uppercase leading-tight">
                {cell.k}
              </span>
              <span className="font-bold text-foreground text-sm">{cell.v}</span>
            </div>
          ))}
        </div>
      )}

      {report && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-surface-2 border border-border space-y-2">
            <p className="text-sm font-bold text-foreground">{report.headline}</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{report.summary}</p>
            <div>
              <div className="flex items-center justify-between text-[11px] font-mono uppercase text-muted-foreground">
                <span>{t("sc.report.adherence")}</span>
                <span className="text-foreground font-bold">
                  {report.adherence.score}/100 · {report.adherence.label}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 rounded-full bg-border overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${report.adherence.score}%` }}
                />
              </div>
            </div>
          </div>

          {report.sections.map((section) => (
            <div key={section.title} className="p-4 rounded-2xl border border-border space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-foreground">{section.title}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{section.body}</p>
              <div className="flex flex-wrap gap-1.5">
                {section.metrics.map((m) => (
                  <span
                    key={`${section.title}-${m.label}`}
                    className="text-[11px] px-2 py-1 rounded-lg bg-surface-2 border border-border"
                    title={m.note}
                  >
                    <span className="font-bold text-foreground">{m.value}</span>{" "}
                    <span className="text-muted-foreground">{m.label}</span>
                  </span>
                ))}
              </div>
            </div>
          ))}

          {report.risks.length > 0 && (
            <div className="space-y-2">
              {report.risks.map((r) => (
                <div key={r.title} className="flex gap-2 p-3 rounded-2xl border border-amber-500/25 bg-amber-500/5">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-foreground">{r.title}</p>
                    <p className="text-xs text-muted-foreground">{r.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {report.recommendations.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {t("sc.report.recs")}
              </p>
              {report.recommendations.map((r) => (
                <div key={r.title} className="flex gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-foreground">{r.title}</p>
                    <p className="text-xs text-muted-foreground">{r.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {report.questionsForDoctor.length > 0 && (
            <div className="p-4 rounded-2xl border border-border space-y-1.5">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-foreground">
                <Stethoscope className="w-4 h-4 text-cyan-400" /> {t("sc.report.questions")}
              </p>
              {report.questionsForDoctor.map((q) => (
                <p key={q} className="text-xs text-muted-foreground">
                  • {q}
                </p>
              ))}
            </div>
          )}

          <p className="text-[10px] text-muted-foreground leading-relaxed">{t("sc.report.disclaimer")}</p>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2.5">
        <Button
          onClick={generate}
          disabled={loading}
          className="flex-1 min-w-0 h-11 bg-surface-2 hover:bg-surface border border-border text-foreground font-bold rounded-2xl"
        >
          {loading ? (
            <RefreshCw className="w-4 h-4 mr-2 animate-spin text-indigo-400 shrink-0" />
          ) : (
            <Sparkles className="w-4 h-4 mr-2 text-indigo-400 shrink-0" />
          )}
          <span className="truncate">
            {loading ? t("sc.report.analyzing") : report ? t("sc.report.regenerate") : t("sc.report.analyze")}
          </span>
        </Button>
        <Button
          onClick={download}
          disabled={!report || downloading}
          className="flex-1 min-w-0 h-11 font-bold rounded-2xl"
        >
          <Download className="w-4 h-4 mr-2 shrink-0" />
          <span className="truncate">{downloading ? t("sc.report.exporting") : t("sc.report.download")}</span>
        </Button>
      </div>
    </div>
  );
};
