const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://cdn.paddle.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.paddle.com https://cdn.jsdelivr.net https://storage.googleapis.com",
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
    headers.set(name, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export { CONTENT_SECURITY_POLICY, SECURITY_HEADERS };
