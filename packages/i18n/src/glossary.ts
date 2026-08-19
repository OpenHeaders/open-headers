/**
 * Do-not-translate glossary — the machine-readable half of the English
 * boundary (the i18n plan §3).
 *
 * These terms stay English in every locale: the hardcoded-string
 * scanner whitelists them, the translator handoff marks them
 * protected, and reviewers reject catalogs that translate them.
 * Product chrome AROUND them still localizes ("Copy as cURL" — the
 * verb translates, `cURL` doesn't).
 */

export const GLOSSARY: readonly string[] = [
  // Brand + product proper nouns (incl. import-source products named in UI)
  'Open Headers',
  'Postman',
  'Insomnia',
  'Bruno',
  // Browser proper nouns (backend-details window titles)
  'Chrome',
  'Firefox',
  'Edge',
  // Protocol / wire vocabulary
  'HTTP',
  'HTTPS',
  'WebSocket',
  'URL',
  'URI',
  'JSON',
  'XML',
  'HTML',
  'CSS',
  'JavaScript',
  'GraphQL',
  'gRPC',
  'REST',
  'API',
  'CORS',
  'CSP',
  'JWT',
  'OAuth',
  'PKCE',
  'TOTP',
  'mTLS',
  'TLS',
  'SSL',
  'DNS',
  'IP',
  'TCP',
  'UDP',
  'SOCKS5',
  'PAC',
  'WPAD',
  'HAR',
  'cURL',
  'Cookie',
  'Set-Cookie',
  'User-Agent',
  // Set-Cookie attribute tokens (RFC 6265 vocabulary — cookie surfaces
  // show them raw as field/column labels)
  'Domain',
  'Path',
  'Expires',
  'SameSite',
  'HttpOnly',
  'Secure',
  'Partitioned',
  // declarativeNetRequest condition field names (docs chips)
  'urlFilter',
  'regexFilter',
  'requestDomains',
  'excludedRequestDomains',
  'initiatorDomains',
  'requestMethods',
  'resourceTypes',
  'domainType',
  // JWT part + registered-claim names (RFC 7519 vocabulary)
  'Header',
  'Signature',
  'iat',
  'nbf',
  'exp',
  // DevTools parity vocabulary
  'Waterfall',
  'Preflight',
  'Headers',
  'Payload',
  'Timing',
  'Initiator',
  'Connection Start',
  'Stalled',
  'DOMContentLoaded',
  'Server Timing',
  // Encoding names
  'Base64',
  // Architecture component names (backend-details scenes)
  'sync-engine',
  'rule-engine',
  'oracle',
  'vault',
  // Scripting surface
  'oh.require',
  // Units that ride the Chrome parity timing scale
  'µs',
  'ms',
  's',
];

const glossarySet = new Set(GLOSSARY.map((t) => t.toLowerCase()));

export function isGlossaryTerm(term: string): boolean {
  return glossarySet.has(term.toLowerCase());
}
