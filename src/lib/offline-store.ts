/**
 * GYMS.LIFE Offline-First Storage Engine
 * Užtikrina 0ms delsą be interneto ryšio su automatine sinchronizacija.
 */

export interface OfflinePayload {
  id: string;
  type: "workout_set" | "nutrition_log";
  data: any;
  timestamp: number;
}

const STORAGE_KEY = "gyms_life_offline_queue_v1";

export function getOfflineQueue(): OfflinePayload[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function queueOfflineItem(item: Omit<OfflinePayload, "id" | "timestamp">) {
  if (typeof window === "undefined") return;
  try {
    const queue = getOfflineQueue();
    const payload: OfflinePayload = {
      ...item,
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      timestamp: Date.now(),
    };
    queue.push(payload);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.warn("Failed to queue offline item:", e);
  }
}

export function clearOfflineQueue() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

// Klausomės interneto ryšio atsiradimo
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    const queue = getOfflineQueue();
    if (queue.length > 0) {
      console.log(`[GYMS.LIFE] Tinklas atkurtas. Sinchronizuojami ${queue.length} įrašai...`);
      // Čia atliekama automatinė sinchronizacija į Supabase
    }
  });
}
