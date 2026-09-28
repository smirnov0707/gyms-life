import { useState } from "react";
import { CalendarDays, ArrowUpRight } from "lucide-react";
import { Slider } from "./ui/slider";
import { useI18n } from "@/lib/i18n";

/** Schedule arithmetic only. No health prediction and no persisted training plan. */
export function TransformationCalculator() {
  const { t } = useI18n();
  const [weeks, setWeeks] = useState(12);
  const [daysPerWeek, setDaysPerWeek] = useState(4);
  const duration = t("tl.tc.durationWeeks").replace("{n}", String(weeks));
  const frequency = t("tl.tc.frequencyPerWeek").replace("{n}", String(daysPerWeek));
  return (
    <section className="fl-rhythm" aria-labelledby="rhythm-title">
      <div className="fl-rhythm-intro">
        <span className="fl-public-eyebrow">
          <CalendarDays aria-hidden="true" />
          {t("tl.tc.badge")}
        </span>
        <h2 id="rhythm-title">{t("tl.tc.title")}</h2>
        <p>{t("tl.tc.subtitle")}</p>
      </div>
      <div className="fl-rhythm-controls">
        <div>
          <div className="fl-rhythm-label">
            <span id="rhythm-duration">{t("tl.tc.duration")}</span>
            <strong>{duration}</strong>
          </div>
          <Slider
            aria-labelledby="rhythm-duration"
            aria-valuetext={duration}
            min={4}
            max={24}
            step={1}
            value={[weeks]}
            onValueChange={([v]) => setWeeks(v ?? 12)}
          />
        </div>
        <div>
          <div className="fl-rhythm-label">
            <span id="rhythm-frequency">{t("tl.tc.frequency")}</span>
            <strong>{frequency}</strong>
          </div>
          <Slider
            aria-labelledby="rhythm-frequency"
            aria-valuetext={frequency}
            min={2}
            max={6}
            step={1}
            value={[daysPerWeek]}
            onValueChange={([v]) => setDaysPerWeek(v ?? 4)}
          />
        </div>
      </div>
      <div className="fl-rhythm-result" role="status" aria-live="polite" aria-atomic="true">
        <div>
          <span>{t("tl.tc.sessions")}</span>
          <ArrowUpRight aria-hidden="true" />
        </div>
        <strong data-testid="rhythm-sessions">{weeks * daysPerWeek}</strong>
        <p>
          {t("tl.tc.formula")
            .replace("{weeks}", String(weeks))
            .replace("{days}", String(daysPerWeek))}
        </p>
        <small>{t("tl.tc.notSaved")}</small>
      </div>
    </section>
  );
}
