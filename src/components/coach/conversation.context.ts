import { createContext, useContext, useSyncExternalStore } from "react";
import type { CoachConversationSession } from "./conversation.session";

export const CoachConversationContext = createContext<CoachConversationSession | null>(null);

export function useCoachConversation() {
  const session = useContext(CoachConversationContext);
  if (!session) throw new Error("Coach conversation provider is required");
  const state = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getServerSnapshot,
  );
  return { session, state };
}
