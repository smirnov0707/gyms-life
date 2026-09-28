import { useState } from "react";
import { TwinChangeMap } from "@/components/twin/TwinChangeMap";
import { TwinEvidenceBridge } from "@/components/twin/TwinEvidenceBridge";
import { useI18n, type TKey } from "@/lib/i18n";
import { KNOWN_MUSCLE_GROUPS } from "@/lib/muscle-load.schema";
import { comparisonPoints } from "./comparison-fixtures";
const known = new Set<string>(KNOWN_MUSCLE_GROUPS);
export function ComparisonFixture() {
  const [alternate, setAlternate] = useState(false);
  const { lang, t } = useI18n();
  const { older, newer } = comparisonPoints(alternate);
  const label = (region: string) => (known.has(region) ? t(`mg.${region}` as TKey) : region);
  return (
    <div className="fl-world-page mx-auto w-full max-w-6xl">
      {new URLSearchParams(location.search).get("switch") === "1" ? (
        <button type="button" onClick={() => setAlternate((value) => !value)}>
          Switch saved pair
        </button>
      ) : null}
      <TwinChangeMap older={older} newer={newer} lang={lang} regionLabel={label} />
      <TwinEvidenceBridge older={older} newer={newer} lang={lang} />
    </div>
  );
}
