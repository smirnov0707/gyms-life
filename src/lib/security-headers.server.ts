const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://cdn.paddle.com",
  "style-src 'self' 'unsafe-inline'",
  // Both faces are self-hosted variable TTFs under the OFL, with their licences
  // in `public/fonts`. The Google Fonts hosts stood in this policy for a
  // request nothing makes, which is an allowance an injected stylesheet could
  // use and the athlete's own font requests never would.
  "font-src 'self' data:",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  // GLTFLoader's ImageBitmapLoader fetches object URLs for textures embedded
  // in the verified GLB. img-src alone covers <img>, not this local fetch.
  "connect-src 'self' blob: https://*.supabase.co wss://*.supabase.co https://*.paddle.com https://cdn.jsdelivr.net https://storage.googleapis.com",
  "frame-src https://checkout.paddle.com",
  "worker-src 'self' blob:",
].join("; ");

const SECURITY_HEADERS = {
  "content-security-policy": CONTENT_SECURITY_POLICY,
  "cross-origin-opener-policy": "same-origin",
  "permissions-policy": "camera=(self), microphone=(self), geolocation=()",
  "referrer-policy": "strict-origin-when-cross-origin",
  "strict-transport-security": "max-age=31536000; includeSubDomains",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
} as const;

/** Adds the same production protections to SSR pages and API responses. */
export function applySecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    // Multiple CSP policies are intersected by the browser. Preserve a stricter
    // route-specific policy rather than overwriting it with the baseline.
    if (name === "content-security-policy" && headers.has(name) && headers.get(name) !== value)
      headers.append(name, value);
    else headers.set(name, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export { CONTENT_SECURITY_POLICY, SECURITY_HEADERS };
