import { useEffect, useId, useLayoutEffect, useRef } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { useCoachConversation } from "./conversation.context";
import { conversationCopy } from "./conversation.copy";
import { coachComposerCopy } from "./composer.copy";
import { coachComposerHeight, isCoachSubmitShortcut } from "./composer.model";
import "./composer.css";

function resizeComposer(element: HTMLTextAreaElement) {
  const style = getComputedStyle(element);
  const padding = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
  const border = parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
  // Measure an independent field: the visible field's scroll position and caret
  // can keep its scrollHeight enlarged after a long draft is replaced.
  const measure = document.createElement("textarea");
  for (const property of [
    "font-family",
    "font-size",
    "font-weight",
    "font-style",
    "line-height",
    "letter-spacing",
    "text-indent",
    "text-transform",
    "tab-size",
    "padding-top",
    "padding-bottom",
    "padding-left",
    "padding-right",
    "border-top-width",
    "border-bottom-width",
    "border-left-width",
    "border-right-width",
    "border-style",
    "box-sizing",
    "white-space",
    "overflow-wrap",
    "word-break",
  ]) {
    measure.style.setProperty(property, style.getPropertyValue(property), "important");
  }
  Object.assign(measure.style, {
    position: "absolute",
    visibility: "hidden",
    pointerEvents: "none",
    width: `${element.getBoundingClientRect().width}px`,
    height: "0px",
    minHeight: "0px",
    maxHeight: "none",
    overflow: "hidden",
  });
  measure.tabIndex = -1;
  measure.setAttribute("aria-hidden", "true");
  measure.value = element.value;
  document.body.appendChild(measure);
  try {
    const size = coachComposerHeight(
      measure.scrollHeight,
      parseFloat(style.lineHeight),
      padding,
      border,
    );
    element.style.height = `${size.height}px`;
    element.style.overflowY = size.overflowing ? "auto" : "hidden";
  } finally {
    measure.remove();
  }
}

/** View only: the existing mounted-owner session still owns all drafts and sends. */
export function CoachComposer() {
  const { lang, t } = useI18n();
  const { session, state } = useCoachConversation();
  const copy = conversationCopy(lang);
  const labels = coachComposerCopy(lang);
  const field = useRef<HTMLTextAreaElement>(null);
  const composing = useRef(false);
  const id = useId();
  const length = state.draft.trim().length;
  const tooLong = length > 1000;
  const signedOut = state.historyState === "signed_out";
  const blocked =
    state.operation !== "idle" || signedOut || state.needsRecheck || state.confirmClear;
  const canSend = !blocked && length > 0 && !tooLong;
  const sendLabel =
    state.unconfirmedQuestion === state.draft.trim() ? copy.sendAgain : t("coach.send");

  useLayoutEffect(() => {
    if (field.current) resizeComposer(field.current);
  }, [state.draft]);

  useEffect(() => {
    const element = field.current;
    if (!element) return;
    let frame = 0;
    let alive = true;
    let previous = "";
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!alive) return;
        const style = getComputedStyle(element);
        const metric = `${element.clientWidth}:${style.lineHeight}:${style.paddingTop}:${style.paddingBottom}`;
        if (metric !== previous) {
          previous = metric;
          resizeComposer(element);
        }
      });
    };
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
    observer?.observe(element);
    observer?.observe(document.documentElement);
    window.addEventListener("resize", schedule);
    void document.fonts?.ready.then(() => {
      if (alive) schedule();
    });
    schedule();
    return () => {
      alive = false;
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", schedule);
    };
  }, []);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (canSend && !composing.current) void session.send(lang);
      }}
      className="relative border-t border-border bg-surface-2/60 p-3 backdrop-blur-xl sm:p-4"
      data-coach-composer
    >
      <div className="fl-coach-composer-input">
        <textarea
          ref={field}
          rows={2}
          value={state.draft}
          onChange={(event) => session.setDraft(event.target.value)}
          onCompositionStart={() => {
            composing.current = true;
          }}
          onCompositionEnd={() => {
            composing.current = false;
          }}
          onKeyDown={(event) => {
            if (!isCoachSubmitShortcut(event.nativeEvent, composing.current)) return;
            event.preventDefault();
            if (canSend) event.currentTarget.form?.requestSubmit();
          }}
          disabled={signedOut}
          aria-label={t("coach.ph")}
          aria-invalid={tooLong}
          aria-describedby={`${id}-help${tooLong ? ` ${id}-limit` : ""}`}
          placeholder={t("coach.ph")}
          data-coach-draft
        />
        <Button
          type="submit"
          disabled={!canSend}
          aria-label={sendLabel}
          title={sendLabel}
          size="icon"
          className="min-h-11 min-w-11 shrink-0 rounded-xl"
          data-coach-send
        >
          <Send className="size-4" aria-hidden="true" />
        </Button>
      </div>
      <div className="fl-coach-composer-help">
        <p id={`${id}-help`} data-coach-composer-help>
          <span>{labels.newline}</span> <span>{labels.shortcut}</span>
        </p>
        <span aria-label={labels.length(length)} data-coach-draft-count>
          {length} / 1000
        </span>
      </div>
      {tooLong ? (
        <p id={`${id}-limit`} role="status" className="mt-2 text-sm text-foreground">
          {copy.limit}
        </p>
      ) : null}
    </form>
  );
}
