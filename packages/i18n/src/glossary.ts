/**
 * Do-not-translate glossary — the machine-readable half of the English
 * boundary (I18N_PLAN.md §3).
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
  'HAR',
  'cURL',
  'Cookie',
  'Set-Cookie',
  'User-Agent',
  // DevTools parity vocabulary
  'Waterfall',
  'Preflight',
  'Headers',
  'Payload',
  'Timing',
  'Initiator',
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
