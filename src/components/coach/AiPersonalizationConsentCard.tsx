import { useEffect, useId, useMemo, useSyncExternalStore } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import {
  getAiPersonalizationConsent,
  recordAiPersonalizationConsent,
} from "@/lib/ai-personalization-consent.functions";
import { Button } from "@/components/ui/button";
import { createConsentPreferenceSession } from "./consent-preference.session";
import { consentPreferenceCopy, consentPreferenceStatus } from "./consent-preference.copy";

export function AiPersonalizationConsentCard() {
  const { user } = useAuth();
  // A different owner gets a different session before rendering any saved state.
  return <ConsentPreference key={user?.id ?? "signed-out"} authenticated={Boolean(user)} />;
}

function ConsentPreference({ authenticated }: { authenticated: boolean }) {
  const { lang } = useI18n();
  const getConsent = useServerFn(getAiPersonalizationConsent);
  const recordConsent = useServerFn(recordAiPersonalizationConsent);
  const session = useMemo(
    () =>
      createConsentPreferenceSession(
        {
          read: () => getConsent(),
          write: (granted) => recordConsent({ data: { granted } }),
          report: (reason) => {
            console.warn(
              reason === "read"
                ? "[Coach] CONSENT_READ_UNAVAILABLE"
                : "[Coach] CONSENT_SAVE_UNCONFIRMED",
            );
          },
        },
        authenticated,
      ),
    [getConsent, recordConsent, authenticated],
  );
  const state = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getServerSnapshot,
  );
  useEffect(() => {
    void session.start();
    return () => session.stop();
  }, [session]);
  const copy = consentPreferenceCopy(lang);
  const titleId = useId();
  const statusId = useId();
  const busy = state.status === "loading" || state.status === "saving";

  return (
    <section
      className="fl-premium-card min-w-0 rounded-2xl border border-border bg-surface-2 p-4"
      data-coach-consent
      data-consent-state={state.status}
      aria-labelledby={titleId}
      aria-busy={busy}
    >
      <div className="flex min-w-0 items-start gap-3">
        <ShieldCheck className="mt-1 size-5 shrink-0 text-primary" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground">
            {copy.eyebrow}
          </p>
          <h2 id={titleId} className="mt-1 text-base font-semibold text-foreground">
            {copy.title}
          </h2>
          <p
            id={statusId}
            role="status"
            className="mt-2 text-sm leading-relaxed text-foreground"
            data-consent-status
          >
            {consentPreferenceStatus(state, lang)}
          </p>
        </div>
      </div>
      <p className="mt-4 text-sm leading-relaxed text-muted-foreground" data-consent-explanation>
        {copy.description}
      </p>
      {state.status !== "signed_out" ? (
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          aria-describedby={statusId}
          className="mt-4 min-h-11 w-full whitespace-normal px-3 py-2 text-sm sm:w-auto"
          onClick={() => {
            if (state.status === "ready") void session.toggle();
            else if (state.status === "unavailable") void session.load();
          }}
          data-consent-action
        >
          {busy ? (
            <Loader2
              className="size-4 shrink-0 animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
          ) : null}
          {state.status === "ready"
            ? state.enabled
              ? copy.disable
              : copy.enable
            : state.status === "saving"
              ? copy.status.saving
              : state.status === "loading"
                ? copy.status.loading
                : copy.retry}
        </Button>
      ) : null}
    </section>
  );
}
