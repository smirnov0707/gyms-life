import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { askCoach, clearCoachMessages, listCoachMessages } from "@/lib/plan.functions";
import { createCoachConversationSession, type CoachConversationSession } from "./conversation.session";

export const CoachConversationContext = createContext<CoachConversationSession | null>(null);

/** The caller keys this provider by owner, so no prior-owner state is rendered. */
export function CoachConversationProvider({ authenticated, children }: {
  authenticated: boolean;
  children: ReactNode;
}) {
  const ask = useServerFn(askCoach);
  const list = useServerFn(listCoachMessages);
  const clear = useServerFn(clearCoachMessages);
  const session = useMemo(() => createCoachConversationSession({
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
  }, authenticated), [ask, list, clear, authenticated]);
  useEffect(() => {
    void session.start();
    return () => session.stop();
  }, [session]);
  return <CoachConversationContext.Provider value={session}>{children}</CoachConversationContext.Provider>;
}

export function useCoachConversation() {
  const session = useContext(CoachConversationContext);
  if (!session) throw new Error("Coach conversation provider is required");
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getServerSnapshot);
  return { session, state };
}
