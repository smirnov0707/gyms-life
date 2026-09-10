/** Only a normalized same-origin local URL can be used after authentication. */
export function safeAuthNext(value: unknown): string | undefined {
  if (
    typeof value !== "string" ||
    value.length > 2048 ||
    !value.startsWith("/") ||
    value.startsWith("//")
  )
    return undefined;
  const base = "https://gyms-redirect.invalid";
  try {
    // Browsers normalize backslashes and strip controls before navigating.
    // Reject those bytes both literally and encoded instead of testing only //.
    const decoded = decodeURIComponent(value);
    if (
      // eslint-disable-next-line no-control-regex -- Intentionally reject navigation control bytes.
      /[\\\u0000-\u0020\u007f]/u.test(value) ||
      // eslint-disable-next-line no-control-regex -- Intentionally reject navigation control bytes.
      /[\\\u0000-\u001f\u007f]/u.test(decoded) ||
      decoded.startsWith("//")
    )
      return undefined;
    const url = new URL(value, base);
    if (url.origin !== base || url.username || url.password) return undefined;
    if (["/auth", "/reset-password"].includes(url.pathname.replace(/\/+$/, ""))) return undefined;
    return url.pathname + url.search + url.hash;
  } catch {
    return undefined;
  }
}
