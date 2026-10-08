import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Button, buttonVariants } from "./button";
import { Input } from "./input";
import { Textarea } from "./textarea";

describe("shared control contracts", () => {
  it.each(["default", "destructive", "outline", "secondary", "ghost", "link"] as const)(
    "retains the %s variant and a wrapping default touch target",
    (variant) => {
      const classes = buttonVariants({ variant });
      expect(classes).toContain("ui-button");
      expect(classes).toContain("min-h-11");
      expect(classes).toContain("whitespace-normal");
      expect(classes).not.toContain("whitespace-nowrap");
    },
  );
  it("keeps compact, large and icon sizes distinct", () => {
    expect(buttonVariants({ size: "sm" })).toContain("min-h-9");
    expect(buttonVariants({ size: "lg" })).toContain("min-h-12");
    expect(buttonVariants({ size: "icon" })).toContain("size-11");
  });
  it("preserves native disabled and pressed semantics", () => {
    const html = renderToStaticMarkup(
      <Button type="button" disabled aria-pressed="true">
        Selected
      </Button>,
    );
    expect(html).toContain('type="button"');
    expect(html).toContain('disabled=""');
    expect(html).toContain('aria-pressed="true"');
  });
  it("composes an anchor through Slot without nesting a button", () => {
    const html = renderToStaticMarkup(
      <Button asChild variant="outline">
        <a href="#details">Details</a>
      </Button>,
    );
    expect(html).toMatch(/<a\b[^>]*href="#details"/);
    expect(html).not.toContain("<button");
    expect(html).toContain("ui-button");
  });
  it("retains field identity, decimal input hints and validation references", () => {
    const html = renderToStaticMarkup(
      <Input
        id="amount"
        name="amount"
        inputMode="decimal"
        defaultValue="45.5"
        aria-invalid="true"
        aria-describedby="amount-error"
      />,
    ).toLowerCase();
    for (const text of [
      'id="amount"',
      'name="amount"',
      'inputmode="decimal"',
      'aria-invalid="true"',
      'aria-describedby="amount-error"',
      'value="45.5"',
      "ui-input",
      "min-h-11",
    ])
      expect(html).toContain(text);
  });
  it("uses the same field surface for multiline input without losing native props", () => {
    const html = renderToStaticMarkup(
      <Textarea id="notes" rows={3} readOnly defaultValue="Existing notes" />,
    );
    expect(html).toContain("ui-input");
    expect(html).toContain('rows="3"');
    expect(html).toMatch(/readonly=""/i);
    expect(html).toContain("Existing notes");
  });
});
