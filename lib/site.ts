/**
 * Public base URL used when building links that people share (tournament
 * page, registration links). Set NEXT_PUBLIC_SITE_URL once the production
 * domain is connected; until then the current origin is used, so nothing
 * is hardcoded.
 */
export function getSiteUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (configured) return configured.replace(/\/+$/, "");

  if (typeof window !== "undefined") return window.location.origin;

  return "";
}
