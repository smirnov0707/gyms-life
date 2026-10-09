import { SystemNotice } from "@/components/system/SystemNotice";
import { Button } from "@/components/ui/button";
import type { LabUnreadableSource } from "@/lib/lab.schema";
import { labReadCopyFor, type LabReadMode } from "./lab-read.copy";

/** Shared operational surface; no synthetic progress, guessed values or hidden read errors. */
export function LabReadNotice({
  mode,
  language,
  sources = [],
  onRetry,
  retrying = false,
}: {
  mode: LabReadMode;
  language: "lt" | "en";
  sources?: readonly LabUnreadableSource[];
  onRetry?: () => void;
  retrying?: boolean;
}) {
  const copy = labReadCopyFor(language);
  const canRetry = onRetry && mode !== "loading" && mode !== "refreshing";
  return (
    <div role="status" data-lab-read-state={mode}>
      <SystemNotice
        eyebrow={language === "lt" ? "LABORATORIJA" : "LAB"}
        title={copy.title[mode]}
        actions={
          canRetry ? (
            <Button
              type="button"
              variant="outline"
              className="min-h-11 w-full sm:w-auto"
              disabled={retrying}
              onClick={onRetry}
            >
              {retrying ? copy.retrying : copy.retry}
            </Button>
          ) : undefined
        }
      >
        <p>{copy.description[mode]}</p>
        {sources.length > 0 ? (
          <p className="mt-2" data-lab-unreadable-sources>
            {copy.missingSources}: {[...new Set(sources)].map((source) => copy.source[source]).join(", ")}.
          </p>
        ) : null}
      </SystemNotice>
    </div>
  );
}
