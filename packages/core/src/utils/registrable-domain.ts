/**
 * Registrable-domain heuristic (no public-suffix list shipped): last
 * two labels, or three when the second-level label is a well-known
 * public second level (`example.co.uk`). IPs, `localhost`, and
 * single-label hosts pass through as-is; `www.` is noise.
 *
 * Shared by the quick-create destination heuristic (rules land in a
 * folder named after the captured URL's domain) and the sessions
 * archive's auto-placement (a session's default folder is its dominant
 * origin's registrable domain, the agent-traffic plan §11.1).
 */

const PUBLIC_SECOND_LEVELS = new Set(['co', 'com', 'net', 'org', 'gov', 'edu', 'ac']);

/** `https://www.app.openheaders.com/x` → `openheaders.com`; null on an
 *  unparseable URL or an empty host. */
export function registrableDomain(url: string): string | null {
  try {
    const host = new URL(url).hostname;
    if (!host) return null;
    if (/^[\d.]+$/.test(host) || host.includes(':')) return host;
    const labels = host.replace(/^www\./, '').split('.');
    if (labels.length <= 2) return labels.join('.');
    const take = PUBLIC_SECOND_LEVELS.has(labels[labels.length - 2]) ? 3 : 2;
    return labels.slice(-take).join('.');
  } catch {
    return null;
  }
}
