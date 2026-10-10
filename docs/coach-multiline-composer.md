# Coach multiline composer

Base: 5079aaeb275ef36fcfe1bda54787c72a446f8363, after the released conversation recovery in PR159.

The active Coach route used a one-line input. This patch replaces only that input/form view with a controlled textarea while retaining the existing mounted-owner conversation session. Drafts, send acknowledgment, unknown-send recovery, owner isolation and conversation ordering keep their existing authority and memory-only lifetime. No storage or automatic AI retry is introduced.

Plain Enter and Shift+Enter insert a line break. The send button and Ctrl/Cmd+Enter are explicit submission paths; composition events, keyCode 229 at an IME boundary, repeated keydown, Alt/Shift-modified and prevented events do not trigger the shortcut. The session remains the final synchronous guard on duplicate sends. The input remains editable during an in-flight send; a new draft is not erased when the old answer arrives.

Sizing uses rendered line height and padding, starts with two lines and stops growing after six. Further content scrolls within the field and is never truncated. The existing trimmed 1000 UTF-16-code-unit server/session limit is retained; overlong input stays editable and blocks submission instead of being silently clipped. The visible count follows that same trimmed length. Metadata is linked with aria-describedby; no character-by-character live announcement. Scoped theme-token CSS keeps a 44px send target and a 16px default textarea font without changing other pages.

The new browser suite exercises the real route and existing synthetic transports, not a stub composer: 18 locale/theme/viewport combinations, 8 doubled-root-font cases and one multiline ambiguous-send/account case per engine. Existing conversation and privacy suites remain unchanged. Synthetic composition events are a regression guard, not physical IME acceptance. Root-font doubling is not browser zoom. No live asks, deletes, consent changes, database migrations, provider or dependency updates are included.

References for the input implementation: React controlled textarea documentation (https://react.dev/reference/react-dom/components/textarea) and MDN keydown/IME boundary guidance (https://developer.mozilla.org/en-US/docs/Web/API/Element/keydown_event), reviewed 2026-10-09. Runtime typing and final-head tests remain release gates.
