import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { useCoachConversation } from "./CoachConversationProvider";
import { conversationCopy } from "./conversation.copy";

export function CoachHistoryNotice() {
  const { session, state } = useCoachConversation();
  const { lang } = useI18n();
  const copy = conversationCopy(lang);
  const busy =
    state.operation !== "idle" ||
    state.historyState === "loading" ||
    state.historyState === "refreshing";
  const retry = state.historyState !== "signed_out" && state.historyState !== "ready";
  if (state.historyState === "ready" && !state.unconfirmedQuestion && !state.clearUnconfirmed)
    return null;
  return (
    <aside
      className="mb-4 min-w-0 rounded-2xl border border-border bg-surface-2 p-4 text-sm leading-relaxed text-foreground"
      data-coach-history-notice
    >
      <p role="status" data-coach-history-status>
        {copy.history[state.historyState]}
      </p>
      {state.unconfirmedQuestion ? (
        <div className="mt-3" data-coach-send-warning>
          <p>{copy.sendUnconfirmed}</p>
          <p className="mt-2 font-medium">{copy.preservedQuestion}</p>
          <p className="mt-1 whitespace-pre-wrap break-words" data-coach-retained-question>
            {state.unconfirmedQuestion}
          </p>
        </div>
      ) : null}
      {state.clearUnconfirmed ? (
        <p className="mt-3" data-coach-clear-warning>
          {copy.clearUnconfirmed}
        </p>
      ) : null}
      {retry ? (
        <Button
          type="button"
          variant="outline"
          className="mt-3 min-h-11 w-full whitespace-normal sm:w-auto"
          disabled={busy || state.confirmClear}
          onClick={() => void session.load()}
          data-coach-history-retry
        >
          {copy.retry}
        </Button>
      ) : null}
    </aside>
  );
}
