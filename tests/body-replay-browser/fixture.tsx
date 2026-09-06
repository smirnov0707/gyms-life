import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { BodyReplayView } from "../../src/components/twin/BodyReplay";
import { buildSessionMuscleBreakdown } from "../../src/lib/session-muscle-breakdown";
import "../../src/styles.css";
const catalogue = [
  { slug: "bench", muscle_group: "chest" },
  { slug: "squat", muscle_group: "legs" },
  { slug: "pullup", muscle_group: "back" },
];
const logged = [
  { exercise_slug: "bench", reps: 10, weight_kg: 50, done: true },
  { exercise_slug: "bench", reps: 10, weight_kg: 30, done: true },
  { exercise_slug: "squat", reps: 10, weight_kg: 80, done: true },
  { exercise_slug: "pullup", reps: 8, weight_kg: null, done: true },
  { exercise_slug: "unlisted-exercise", reps: 10, weight_kg: 10, done: true },
];
export function Fixture() {
  const language = new URLSearchParams(window.location.search).get("lang") === "lt" ? "lt" : "en";
  const [mounted, setMounted] = useState(true);
  const [incomplete, setIncomplete] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [empty, setEmpty] = useState(false);
  const [failed, setFailed] = useState(false);
  const [light, setLight] = useState(false);
  const inputs = empty ? [] : incomplete ? [...logged, { ...logged[0]!, reps: null }] : logged;
  const contributions = buildSessionMuscleBreakdown(inputs, catalogue, !unavailable);
  return (
    <main style={{ maxWidth: 1000, margin: "auto", padding: 12 }}>
      <p className="text-xs text-muted-foreground">TEST FIXTURE — NOT USER DATA</p>
      <div className="flex flex-wrap gap-2 text-xs text-foreground">
        <button onClick={() => setMounted((value) => !value)}>Toggle replay</button>
        <button onClick={() => setFailed((value) => !value)}>
          {failed ? "Restore replay source" : "Fail replay source"}
        </button>
        <button onClick={() => setIncomplete((value) => !value)}>
          {incomplete ? "Restore inputs" : "Incomplete inputs"}
        </button>
        <button onClick={() => setUnavailable((value) => !value)}>
          {unavailable ? "Restore catalogue" : "Fail catalogue"}
        </button>
        <button onClick={() => setEmpty((value) => !value)}>
          {empty ? "Restore records" : "Clear records"}
        </button>
        <button
          onClick={() => {
            document.documentElement.classList.remove("light", "dark");
            document.documentElement.classList.add(light ? "dark" : "light");
            setLight((value) => !value);
          }}
        >
          {light ? "Dark theme" : "Light theme"}
        </button>
      </div>
      {mounted && (
        <BodyReplayView
          contributions={contributions}
          unavailable={failed}
          onRetry={() => setFailed(false)}
          lang={language}
          regionLabel={(region) => region.charAt(0).toUpperCase() + region.slice(1)}
        />
      )}
      <p data-scroll-target className="mt-6 text-xs text-muted-foreground">
        End of synthetic session evidence
      </p>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Fixture />
  </StrictMode>,
);
