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

/**
 * Absolute base URL for server code (link-preview metadata, card footers).
 * Order: NEXT_PUBLIC_SITE_URL, then the Vercel production/deployment host,
 * then localhost. Never hardcoded to a domain.
 */
export function getServerSiteUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (configured) return configured.replace(/\/+$/, "");

  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();

  if (production) return `https://${production}`;

  const deployment = process.env.VERCEL_URL?.trim();

  if (deployment) return `https://${deployment}`;

  return "http://localhost:3000";
}
