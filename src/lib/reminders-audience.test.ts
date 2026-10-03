import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Who the reminder scheduler is allowed to interrupt.
 *
 * `ReminderProvider` wraps the whole router, including the public landing page,
 * and the scheduler's only condition was the user's own `enabled` setting —
 * which defaults to `true`, as do water, meal and workout. So a visitor who had
 * never signed in, and had no plan, no meals and no account, was shown
 * "Valgymo laikas · Suvalgyk suplanuotą patiekalą ir įrašyk jį į mitybos
 * dienoraštį" over the top of the marketing page, in Lithuanian, about a meal
 * in a plan that did not exist.
 *
 * The hydration read in the same component was already gated `enabled: !!user`.
 * The guard existed and covered one call site instead of the feature, which is
 * the shape AGENTS.md keeps returning to.
 *
 * Source-scanned rather than rendered: the provider pulls in Supabase, the
 * query client, an audio context and a `Notification` global, and what is worth
 * holding still here is the condition itself.
 */

const REMINDERS = path.resolve("src/lib/reminders.tsx");
const SONNER = path.resolve("src/components/ui/sonner.tsx");
const source = () => readFileSync(REMINDERS, "utf8");

/** The scheduler effect, from its `useEffect(` to the dependency array. */
function schedulerEffect(): string {
  const text = source();
  const at = text.indexOf("// scheduler: checks every 30 s");
  expect(at, "the scheduler effect is still identifiable by its comment").toBeGreaterThan(0);
  const end = text.indexOf("}, [fire, today", at);
  expect(end, "the scheduler effect still ends in a dependency array").toBeGreaterThan(at);
  return text.slice(at, end + 40);
}

describe("the reminder scheduler", () => {
  it("is reading the scheduler, not some other effect", () => {
    const effect = schedulerEffect();
    expect(effect).toMatch(/setInterval\(tick, 30000\)/);
    expect(effect).toMatch(/daySchedule\(/);
  });

  it("does not run for a visitor who is not signed in", () => {
    // The whole fix in one line, and the line a refactor is most likely to drop.
    expect(schedulerEffect()).toMatch(/if \(!user\) return;/);
  });

  it("re-evaluates when the session changes, so signing in starts it", () => {
    // Without `user` in the dependencies the effect keeps the closure that
    // returned early, and reminders never start for the rest of the visit.
    expect(schedulerEffect()).toMatch(/\}, \[fire, today, user\]\)/);
  });

  it("still gates the hydration read it was always gating", () => {
    // The other half of the pair. If this ever loses its guard, an anonymous
    // visitor starts issuing authenticated reads.
    expect(source()).toMatch(/enabled: !!user/);
  });
});

describe("the toast those reminders are shown in", () => {
  it("takes the app's theme rather than sonner's default", () => {
    // Sonner's `theme` prop defaults to "light", so every toast was a white
    // card on the onyx ground whatever the athlete had chosen — the token
    // classes below it were correct and were being applied to an element whose
    // background came from sonner's own variables.
    const sonner = readFileSync(SONNER, "utf8");
    expect(sonner).toMatch(/const \{ resolved \} = useTheme\(\)/);
    expect(sonner).toMatch(/theme=\{resolved\}/);
  });

  it("paints from the theme tokens, not a literal", () => {
    const sonner = readFileSync(SONNER, "utf8");
    expect(sonner).toMatch(/bg-surface/);
    expect(sonner).toMatch(/text-foreground/);
    expect(sonner).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});
