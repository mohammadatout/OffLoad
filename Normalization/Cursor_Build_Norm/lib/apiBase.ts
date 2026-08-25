/**
 * Where the browser sends matcher API requests.
 *
 * Short JSON calls go through the Next.js rewrite so they are same-origin.
 * Long ones — large uploads and match runs — go straight to the API, because
 * the Next dev proxy hangs up (`ECONNRESET`) on requests that take a minute,
 * which surfaces as a 500 even after the backend has finished successfully.
 *
 * Cookies still work on the direct route: a different port is cross-origin but
 * the same site, so a `SameSite=Lax` cookie is sent, and CORS on the API allows
 * this origin with credentials.
 */

function normalize(url: string): string {
  return url.replace(/\/$/, '');
}

export const API_BASE = normalize(process.env.NEXT_PUBLIC_MATCHER_API_URL ?? '/api/matcher');

export const HEAVY_API_BASE = normalize(
  process.env.NEXT_PUBLIC_MATCHER_DIRECT_URL ?? 'http://localhost:8010'
);
