import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TwinLayerControls } from "./TwinLayerControls";
import { TWIN_LAYERS } from "./twin-scene.model";
import { twinLayerCopy } from "./twin-layer.copy";

const escape = (text: string) =>
  renderToStaticMarkup(<span>{text}</span>).replace(/^<span>|<\/span>$/g, "");

describe("Twin layer control labels", () => {
  for (const language of ["lt", "en"] as const) {
    it.each(TWIN_LAYERS)(`${language}: preserves the canonical %s selection`, (layer) => {
      const html = renderToStaticMarkup(
        <TwinLayerControls language={language} layer={layer} onLayerChange={() => {}} />,
      );
      expect(html.match(/<button\b/g)).toHaveLength(3);
      expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
      expect(html).toContain(`data-twin-layer-option="${layer}"`);
      for (const option of TWIN_LAYERS)
        expect(html).toContain(`aria-label="${escape(twinLayerCopy(language).label[option])}"`);
      expect(html).not.toContain("disabled");
    });
  }

  it("keeps readable Lithuanian labels without truncation characters", () => {
    const html = renderToStaticMarkup(
      <TwinLayerControls language="lt" layer="recovery" onLayerChange={() => {}} />,
    );
    for (const label of ["Atsistatymas", "Tūris", "Šiandien"])
      expect(html).toContain(`>${label}</span>`);
    expect(html).not.toContain("…");
    expect(html).not.toContain("<br");
  });

  it("never invokes a layer change during rendering", () => {
    let changes = 0;
    renderToStaticMarkup(
      <TwinLayerControls
        language="en"
        layer="recovery"
        onLayerChange={() => {
          changes++;
        }}
      />,
    );
    expect(changes).toBe(0);
  });
});
