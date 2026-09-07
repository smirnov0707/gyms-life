/**
 * Whether a change of signed-in identity means the cached answers on screen
 * belong to somebody else.
 *
 * React Query caches by key, and most of this app's keys name what was asked
 * for — "twin-snapshot", "lab-overview", "performance-overview" — not who
 * asked. The server always answers as the caller, so the data is correct when
 * it arrives; the cache is what outlives the account. Sign out on a shared
 * laptop, sign in as somebody else, and the second person's Today can be
 * painted from the first person's cached recovery, volume and plan until each
 * query happens to refetch.
 *
 * Keeping the check here rather than inline makes the two cases that must not
 * clear the cache explicit: the first time auth resolves after a page load,
 * and a token refresh, which changes the session but not the person.
 */
export function identityChanged(previous: string | null | undefined, next: string | null): boolean {
  // `undefined` is "auth has not resolved yet in this tab": there is nothing
  // to have been cached under a different person.
  if (previous === undefined) return false;
  return previous !== next;
}
