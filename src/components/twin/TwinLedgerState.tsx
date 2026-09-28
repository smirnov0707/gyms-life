import { AlertCircle, Inbox, Loader2, RotateCcw } from "lucide-react";
import { baseLang, useI18n } from "@/lib/i18n";
import "./TwinLedger.css";

export function TwinLedgerState({
  state,
  title,
  description,
  onRetry,
  retrying = false,
}: {
  state: "loading" | "error" | "empty";
  title: string;
  description?: string | undefined;
  onRetry?: (() => void) | undefined;
  retrying?: boolean;
}) {
  const { lang } = useI18n();
  const lt = baseLang(lang) === "lt";
  const Icon = state === "loading" ? Loader2 : state === "error" ? AlertCircle : Inbox;
  return (
    <div
      className="fl-ledger-state"
      data-state={state}
      role={state === "error" ? "alert" : "status"}
    >
      <Icon aria-hidden="true" className={state === "loading" ? "animate-spin" : undefined} />
      <div>
        <h3>{title}</h3>
        {description ? <p>{description}</p> : null}
      </div>
      {onRetry ? (
        <button type="button" onClick={onRetry} disabled={retrying}>
          <RotateCcw aria-hidden="true" />
          {retrying ? (lt ? "Įkeliama…" : "Loading…") : lt ? "Bandyti dar kartą" : "Try again"}
        </button>
      ) : null}
    </div>
  );
}
