import { useContext } from "react";
import { History, Trash2 } from "lucide-react";
import { baseLang, useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CoachConversationContext, CoachConversationProvider, useCoachConversation } from "@/components/coach/CoachConversationProvider";
import { CoachHistoryNotice } from "@/components/coach/CoachHistoryNotice";
import { coachVisibleMessages } from "@/components/coach/conversation.session";
import { conversationCopy } from "@/components/coach/conversation.copy";

export function CoachMemory() {
  const shared = useContext(CoachConversationContext);
  return shared ? <MemoryPanel standalone={false} /> : <StandaloneMemory />;
}
function StandaloneMemory() {
  const { user } = useAuth();
  return (
    <CoachConversationProvider key={user?.id ?? "signed-out"} authenticated={Boolean(user)}>
      <MemoryPanel standalone />
    </CoachConversationProvider>
  );
}
function MemoryPanel({ standalone }: { standalone: boolean }) {
  const { t, lang } = useI18n();
  const copy = conversationCopy(lang);
  const { session, state } = useCoachConversation();
  const rows = coachVisibleMessages(state);
  const busy = state.operation !== "idle" || state.historyState === "loading" || state.historyState === "refreshing";
  const signedOut = state.historyState === "signed_out";
  return (
    <section className="mx-auto grid w-full min-w-0 max-w-3xl gap-4" data-coach-memory>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <History className="size-5 shrink-0 text-primary" aria-hidden="true" />
            {baseLang(lang) === "en" ? "Coach memory" : "Coach atmintis"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">{t("coach.historySub")}</p>
        </div>
        {!signedOut ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" className="min-h-11 whitespace-normal"
              disabled={busy || state.confirmClear} onClick={() => void session.load()} data-memory-refresh>
              {copy.retry}
            </Button>
            <Button type="button" variant="outline" className="min-h-11 whitespace-normal"
              disabled={busy || state.historyState !== "ready" || state.history.length === 0 || state.needsRecheck || state.confirmClear}
              onClick={() => session.requestClear()} data-memory-clear>
              <Trash2 className="size-4 shrink-0" aria-hidden="true" /> {t("coach.clear")}
            </Button>
          </div>
        ) : null}
      </div>
      {standalone ? <CoachHistoryNotice /> : null}
      {state.confirmClear ? (
        <div className="rounded-xl border border-border bg-surface-2 p-3 text-sm text-foreground" data-memory-confirm>
          <p>{copy.clearConfirm}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" variant="outline" className="min-h-11 whitespace-normal" onClick={() => session.cancelClear()}>{copy.cancel}</Button>
            <Button type="button" variant="destructive" className="min-h-11 whitespace-normal" onClick={() => void session.clear()} data-memory-confirm-clear>{copy.clearAccept}</Button>
          </div>
        </div>
      ) : null}
      <div className="min-w-0 rounded-xl border border-border bg-surface p-3">
        {state.historyState === "ready" && rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground" data-memory-empty>{t("coach.historyEmpty")}</p>
        ) : (
          <div className="grid min-w-0 gap-3">
            {rows.map((message) => (
              <article key={message.id} className={cn("grid min-w-0 gap-1", message.role === "user" ? "justify-items-end" : "")} data-memory-row>
                <span className="text-xs text-muted-foreground">
                  {message.createdAt ? new Date(message.createdAt).toLocaleString(lang) : copy.visit}
                </span>
                <p className={cn("max-w-[90%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm leading-relaxed",
                  message.role === "user" ? "bg-primary text-primary-foreground" : "bg-surface-2 text-foreground")}>
                  {message.text}
                </p>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
