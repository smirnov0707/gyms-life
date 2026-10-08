import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { Calendar } from "@/components/ui/calendar";
import "../../src/styles.css";

const params = new URLSearchParams(window.location.search);
document.documentElement.className = params.get("theme") === "light" ? "light" : "dark";
const dateLabel = (date: Date | undefined) =>
  date ? `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}` : "none";

function CalendarFixture() {
  const [selected, setSelected] = useState<Date | undefined>(new Date(2026, 9, 8));
  const [submissions, setSubmissions] = useState(0);
  return (
    <main className="min-h-screen bg-background p-3 text-foreground">
      <p>Synthetic calendar. No account or server writes.</p>
      <form
        className="mt-4 w-full max-w-sm"
        onSubmit={(event) => {
          event.preventDefault();
          setSubmissions((count) => count + 1);
        }}
      >
        <Calendar
          mode="single"
          defaultMonth={new Date(2026, 9, 1)}
          today={new Date(2026, 9, 8)}
          selected={selected}
          onSelect={setSelected}
          disabled={new Date(2026, 9, 15)}
          showWeekNumber={params.get("weeks") === "1"}
        />
        <output aria-label="Selected date">{dateLabel(selected)}</output>
        <output aria-label="Form submissions">{submissions}</output>
      </form>
    </main>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("Missing synthetic calendar root");
createRoot(root).render(<CalendarFixture />);
