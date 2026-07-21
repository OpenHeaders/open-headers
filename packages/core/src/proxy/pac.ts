/**
 * PAC generation for scoped browser routing (OBSERVABILITY_PLAN.md
 * §5.1, Chromium leg). Chromium has no per-request proxy hook, so the
 * scope list compiles into a proxy auto-config script: scoped hosts get
 * `PROXY 127.0.0.1:<port>; DIRECT` (the DIRECT failover keeps browsing
 * alive when the capture proxy is unreachable), everything else stays
 * DIRECT and keeps h3.
 *
 * The generated matcher MUST agree with {@link hostInScope} — exact
 * host, `*.`-wildcard-never-apex, IP-literal exact — and the equivalence
 * is pinned by tests, not by care. Pattern strings embed via
 * `JSON.stringify`, so a hostile pattern can never escape its literal
 * into the script body.
 */

import { parseScopePattern } from './scope';

/**
 * Compile the decrypt-scope list into a PAC script routing scoped hosts
 * at `127.0.0.1:<port>`. Invalid entries are skipped exactly as the
 * matcher skips them; an empty (or all-invalid) list yields a script
 * that answers DIRECT for everything.
 */
export function buildScopePac(patterns: readonly string[], port: number): string {
  const exact: Record<string, true> = {};
  const suffixes: string[] = [];
  for (const raw of patterns) {
    const pattern = parseScopePattern(raw);
    if (pattern === null) continue;
    if (pattern.wildcard) suffixes.push(`.${pattern.base}`);
    else exact[pattern.base] = true;
  }
  const route = `PROXY 127.0.0.1:${port}; DIRECT`;
  return [
    `var route = ${JSON.stringify(route)};`,
    `var exact = ${JSON.stringify(exact)};`,
    `var suffixes = ${JSON.stringify(suffixes)};`,
    'function FindProxyForURL(url, host) {',
    '  var h = String(host).toLowerCase();',
    "  if (h.charAt(0) === '[') {",
    "    var close = h.indexOf(']');",
    '    h = close === -1 ? h.slice(1) : h.slice(1, close);',
    '  }',
    '  if (exact[h] === true) return route;',
    '  for (var i = 0; i < suffixes.length; i++) {',
    '    var s = suffixes[i];',
    '    if (h.length > s.length && h.slice(h.length - s.length) === s) return route;',
    '  }',
    "  return 'DIRECT';",
    '}',
  ].join('\n');
}
