/** Enter belongs to the text. Only an explicit modifier chord submits. */
export function isCoachSubmitShortcut(
  event: Pick<
    KeyboardEvent,
    | "key"
    | "ctrlKey"
    | "metaKey"
    | "shiftKey"
    | "altKey"
    | "repeat"
    | "isComposing"
    | "keyCode"
    | "defaultPrevented"
  >,
  composing = false,
): boolean {
  return (
    event.key === "Enter" &&
    (event.ctrlKey || event.metaKey) &&
    !event.shiftKey &&
    !event.altKey &&
    !event.repeat &&
    !event.defaultPrevented &&
    !event.isComposing &&
    event.keyCode !== 229 &&
    !composing
  );
}

/** Pixel inputs come from the rendered font, not an assumed device/text scale. */
export function coachComposerHeight(
  scrollHeight: number,
  lineHeight: number,
  padding: number,
  border: number,
) {
  const finite = (value: number, fallback: number) =>
    Number.isFinite(value) && value >= 0 ? value : fallback;
  const line = lineHeight > 0 ? finite(lineHeight, 24) : 24;
  const inset = finite(padding, 20) + finite(border, 0);
  const minimum = Math.max(44, line * 2 + inset);
  const maximum = Math.max(minimum, line * 6 + inset);
  const content = finite(scrollHeight, minimum) + finite(border, 0);
  return {
    height: Math.min(maximum, Math.max(minimum, content)),
    overflowing: content > maximum + 1,
  };
}
