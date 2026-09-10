/** Runs in every browser frame. Test setup must touch only its own top-level app page. */
export function initializePageLocale({ origin, language }) {
  if (window !== window.top || location.origin !== origin) return;
  // Do not catch this: denied storage in the actual app must remain a test failure.
  localStorage.setItem("forma_lang", language);
}
