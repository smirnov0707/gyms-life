import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, History, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { clearCoachMessages, listCoachMessages } from "@/lib/plan.functions";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/coach-history")({
  head: () => ({
    meta: [
      { title: "Trenerio pokalbių istorija — GYMS.LIFE" },
      { name: "description", content: "Peržiūrėk visus išsaugotus klausimus ir trenerio atsakymus." },
      { property: "og:title", content: "Trenerio pokalbių istorija — GYMS.LIFE" },
      { property: "og:description", content: "Visi tavo klausimai ir trenerio pastabos vienoje vietoje." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CoachHistoryPage,
});

type Row = { id: string; role: "user" | "coach"; content: string; createdAt: string };

function CoachHistoryPage() {
  const { t } = useI18n();
  const list = useServerFn(listCoachMessages);
  const clear = useServerFn(clearCoachMessages);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await list({ data: { limit: 200 } });
      setRows(res.messages);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setLoading(false);
    }
  }, [list, t]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-3 text-4xl sm:text-5xl">
            <History className="size-7 text-primary" />
            {t("coach.history")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">{t("coach.historySub")}</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/coach">
              <ArrowLeft className="size-4" /> {t("coach.title")}
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={loading || rows.length === 0}
            onClick={async () => {
              try {
                await clear({});
                setRows([]);
                toast.success(t("coach.cleared"));
              } catch (err) {
                toast.error(err instanceof Error ? err.message : t("common.error"));
              }
            }}
          >
            <Trash2 className="size-4" /> {t("coach.clear")}
          </Button>
        </div>
      </div>

      <div className="panel min-h-[40vh] p-5">
        {loading ? (
          <div className="grid place-items-center py-16">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        ) : rows.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">{t("coach.historyEmpty")}</p>
        ) : (
          <div className="grid gap-3">
            {rows.map((m) => (
              <div key={m.id} className={cn("grid gap-1", m.role === "user" ? "justify-items-end" : "")}>
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  {new Date(m.createdAt).toLocaleString()}
                </span>
                <div
                  className={cn(
                    "max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed",
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-surface-2 text-foreground",
                  )}
                >
                  {m.content}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
