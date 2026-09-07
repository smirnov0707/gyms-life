import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Check, Copy, Eye, EyeOff, KeyRound, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { getHealthSource, rotateHealthToken } from "@/lib/health-source.functions";

/**
 * The last mile between the health endpoint and the athlete.
 *
 * The endpoint has existed for a long time and every profile has always had a
 * key, but nothing ever showed anyone theirs — which is the entire reason the
 * signal rail is empty. This is that missing step, and nothing more: it hands
 * over a credential the athlete's own session could already read, in a form
 * they can paste into a phone automation.
 *
 * The key is masked until asked for, is never placed in a URL, and can be
 * replaced on the spot when it has ended up somewhere it should not be.
 */

const ENDPOINT_PATH = "/api/public/health-ingest";

const SAMPLE = `{
  "token": "…",
  "sleep_hours": 7.4,
  "hrv_ms": 68,
  "resting_hr": 52,
  "steps": 8342,
  "active_kcal": 563
}`;

function CopyField({
  label,
  value,
  mono = true,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard permission can be refused; the value is on screen either way.
      toast.error(t("common.error"));
    }
  };

  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <div className="mt-1 flex items-center gap-2">
        <code
          className={`min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-xl border border-border bg-surface-2 px-3 py-2 text-xs ${
            mono ? "font-mono" : ""
          }`}
        >
          {value}
        </code>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={copy}
          className="min-h-11 shrink-0 rounded-xl"
          aria-label={t("hs.copy")}
        >
          {copied ? <Check className="size-4 text-primary" /> : <Copy className="size-4" />}
          <span className="ml-1.5 hidden sm:inline">{copied ? t("hs.copied") : t("hs.copy")}</span>
        </Button>
      </div>
    </div>
  );
}

export function ConnectHealthSource() {
  const { t } = useI18n();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [revealed, setRevealed] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["health-source", user?.id],
    queryFn: () => getHealthSource(),
    enabled: !!user,
    staleTime: 5 * 60_000,
  });

  const rotate = useMutation({
    mutationFn: () => rotateHealthToken(),
    onSuccess: (result) => {
      if (result.status !== "ready") {
        toast.error(t("hs.unavailable"));
        return;
      }
      queryClient.setQueryData(["health-source", user?.id], result);
      setRevealed(true);
      toast.success(t("hs.rotated"));
    },
    onError: () => toast.error(t("hs.unavailable")),
  });

  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const token = data?.status === "ready" ? data.token : null;

  return (
    <section
      aria-label={t("hs.title")}
      className="rounded-3xl border border-border bg-surface p-4 md:p-5"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="grid size-9 shrink-0 place-items-center rounded-2xl border border-border bg-surface-2 text-primary"
        >
          <KeyRound className="size-4" />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold">{t("hs.title")}</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t("hs.body")}</p>
        </div>
      </div>

      {isLoading ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin text-primary" />
          {t("common.loading")}
        </p>
      ) : data?.status !== "ready" ? (
        <p className="mt-4 rounded-2xl border border-border bg-surface-2 p-3 text-sm text-muted-foreground">
          {t("hs.unavailable")}
        </p>
      ) : (
        <div className="mt-4 grid gap-3">
          <CopyField label={t("hs.endpoint")} value={`${origin}${ENDPOINT_PATH}`} />

          <div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                {t("hs.token")}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setRevealed((value) => !value)}
                className="h-8 rounded-full px-2 text-xs"
              >
                {revealed ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                <span className="ml-1.5">{revealed ? t("hs.hide") : t("hs.reveal")}</span>
              </Button>
            </div>
            <div className="mt-1">
              {revealed ? (
                <CopyField label="" value={token!} />
              ) : (
                <code className="block rounded-xl border border-border bg-surface-2 px-3 py-2 font-mono text-xs tracking-[0.3em] text-muted-foreground">
                  ••••••••-••••-••••-••••-••••••••••••
                </code>
              )}
            </div>
            <p className="mt-2 text-xs leading-relaxed text-destructive">{t("hs.warning")}</p>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              {t("hs.payload")}
            </p>
            <pre className="mt-1 overflow-x-auto rounded-xl border border-border bg-surface-2 px-3 py-2 font-mono text-[11px] leading-relaxed">
              {SAMPLE}
            </pre>
            <p className="mt-1.5 text-xs text-muted-foreground">{t("hs.payloadNote")}</p>
          </div>

          <div className="border-t border-border/60 pt-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => rotate.mutate()}
              disabled={rotate.isPending}
              className="min-h-11 rounded-full"
            >
              {rotate.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              <span className="ml-2">{t("hs.rotate")}</span>
            </Button>
            <p className="mt-1.5 text-xs text-muted-foreground">{t("hs.rotateHint")}</p>
          </div>
        </div>
      )}
    </section>
  );
}
