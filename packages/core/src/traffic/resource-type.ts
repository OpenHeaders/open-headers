/**
 * Normalized resource-type vocabulary for traffic projections.
 *
 * The raw `resourceType` a lifecycle carries is per-correlator — the
 * heuristic spine speaks `chrome.webRequest` tokens (`main_frame`,
 * `xmlhttprequest`), the CDP spine speaks protocol tokens (`Document`,
 * `XHR`, `Fetch`), and the proxy spine has no browser context at all —
 * so raw values must never be compared across sources. Every traffic
 * projection routes through this one table instead; no consumer ever
 * sees a raw correlator token.
 */

export type TrafficResourceType =
  | 'document'
  | 'stylesheet'
  | 'script'
  | 'image'
  | 'font'
  | 'media'
  | 'xhr'
  | 'fetch'
  | 'eventsource'
  | 'websocket'
  | 'manifest'
  | 'wasm'
  | 'ping'
  | 'preflight'
  | 'csp-report'
  | 'prefetch'
  | 'signed-exchange'
  | 'other';

/**
 * Case-insensitive union of the three correlator vocabularies. The CDP
 * tokens arrive capitalized (`Document`, `CSPViolationReport`) and are
 * folded to lower case before lookup, so one table serves all spines.
 */
const NORMALIZATION: Record<string, TrafficResourceType> = {
  // webRequest (heuristic spine)
  main_frame: 'document',
  sub_frame: 'document',
  xmlhttprequest: 'xhr',
  csp_report: 'csp-report',
  object: 'other',
  webbundle: 'other',
  // CDP spine (lowercased protocol tokens)
  document: 'document',
  xhr: 'xhr',
  fetch: 'fetch',
  eventsource: 'eventsource',
  prefetch: 'prefetch',
  preflight: 'preflight',
  cspviolationreport: 'csp-report',
  signedexchange: 'signed-exchange',
  texttrack: 'other',
  // shared spellings
  stylesheet: 'stylesheet',
  script: 'script',
  image: 'image',
  font: 'font',
  media: 'media',
  websocket: 'websocket',
  manifest: 'manifest',
  wasm: 'wasm',
  ping: 'ping',
  other: 'other',
};

/** Fold one raw correlator token into the normalized vocabulary. Unknown
 *  or absent tokens land on `'other'` — never on a passthrough. */
export function normalizeTrafficResourceType(raw: string | undefined): TrafficResourceType {
  if (!raw) return 'other';
  return NORMALIZATION[raw.toLowerCase()] ?? 'other';
}
