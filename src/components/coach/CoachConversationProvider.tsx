import { useEffect, useMemo, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { askCoach, clearCoachMessages, listCoachMessages } from "@/lib/plan.functions";
import { createCoachConversationSession } from "./conversation.session";

import { CoachConversationContext } from "./conversation.context";

/** The caller keys this provider by owner, so no prior-owner state is rendered. */
export function CoachConversationProvider({
  authenticated,
  children,
}: {
  authenticated: boolean;
  children: ReactNode;
}) {
  const ask = useServerFn(askCoach);
  const list = useServerFn(listCoachMessages);
  const clear = useServerFn(clearCoachMessages);
  const session = useMemo(
    () =>
      createCoachConversationSession(
        {
          read: () => list({ data: { limit: 200 } }),
          ask: (question, lang) => ask({ data: { question, lang } }),
          clear: () => clear({}),
          report: (reason) => {
            const codes = {
              history: "[Coach] HISTORY_UNAVAILABLE",
              send: "[Coach] SEND_UNCONFIRMED",
              clear: "[Coach] CLEAR_UNCONFIRMED",
            };
            console.warn(codes[reason]);
          },
        },
        authenticated,
      ),
    [ask, list, clear, authenticated],
  );
  useEffect(() => {
    void session.start();
    return () => session.stop();
  }, [session]);
  return (
    <CoachConversationContext.Provider value={session}>
      {children}
    </CoachConversationContext.Provider>
  );
}
