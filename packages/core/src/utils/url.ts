/**
 * Pure URL parse / build helpers shared by the renderer and the SW.
 *
 * Two representations of the same data, one for each consumer:
 *
 *   • {@link parseUrlQuery} + {@link buildUrlDisplay} — the raw
 *     renderer-side view. Preserves template syntax verbatim (does
 *     NOT URL-encode) so `?a={{env.foo}}` round-trips exactly, which
 *     is what the inline highlight + suggestion popover need.
 *
 *   • {@link appendQueryParams} — the wire-side view used by the
 *     request executor AFTER template resolution. URL-encodes keys
 *     and values with `encodeURIComponent`, skips disabled rows
 *     and rows with empty keys.
 *
 * Round-trip discipline: parse→build MUST be an identity so a
 * controlled URL input driven by the parsed form never swallows or
 * injects characters. This requires preserving three things a naive
 * `split('&')` / `split('=')` would lose:
 *   1. `?key=` vs `?key` — captured by {@link QueryParam.hasEquals}.
 *   2. Trailing `&` (user mid-typing the next param) — captured by
 *      a trailing empty pair in the output array.
 *   3. Interior empty pairs (`&&`) — captured by empty pairs in the
 *      middle of the array.
 *
 * Keeping both representations in one module means there's a single
 * canonical "query params in a URL" grammar — whenever the renderer
 * builds a display URL, the executor will later split it the same way.
 */

export interface QueryParam {
  key: string;
  value: string;
  /** `undefined` is treated as enabled. Disabled rows are omitted
   *  from {@link buildUrlDisplay} output and from the wire-side
   *  {@link appendQueryParams} append. */
  enabled?: boolean;
  /** Preserves the `=` separator through parse→build when the value
   *  is empty. See file header for rationale. */
  hasEquals?: boolean;
}

export interface ParsedUrl {
  /** Everything BEFORE the first unescaped `?`. Never contains a
   *  query string; callers should keep `draft.url` pointed at this. */
  base: string;
  /** Structured query params parsed from the portion after `?`.
   *
   *  Empty placeholder rows are preserved so the parse→build loop
   *  is lossless — trailing `&`, interior `&&`, and a bare `?`
   *  all survive exactly as typed. Callers rendering a UI table
   *  typically filter empties for display; callers rebuilding the
   *  URL string must NOT. */
  params: QueryParam[];
}

/** Find the first `?` in `input` that isn't inside a `{{...}}` block.
 *  Template refs can't contain `?` in our grammar, but we scan
 *  defensively so future grammar extensions don't require re-auditing
 *  every URL splitter in the codebase. Returns `-1` when none. */
function findQuerySeparator(input: string): number {
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (ch === '{' && input[i + 1] === '{') {
      const close = input.indexOf('}}', i + 2);
      if (close === -1) return input.indexOf('?', i);
      i = close + 2;
      continue;
    }
    if (ch === '?') return i;
    i++;
  }
  return -1;
}

/** Parse one raw pair (the substring between `&` separators) into a
 *  {@link QueryParam}. `hasEquals` is set only when the value is
 *  empty but `=` was present — the key-with-non-empty-value form
 *  implies `=` naturally, so no flag is needed there. */
function parsePair(raw: string): QueryParam {
  const eq = raw.indexOf('=');
  if (eq === -1) return { key: raw, value: '' };
  const key = raw.slice(0, eq);
  const value = raw.slice(eq + 1);
  if (value === '') return { key, value, hasEquals: true };
  return { key, value };
}

/**
 * Split `input` into `{ base, params }`. The base contains everything
 * up to (but not including) the first `?` outside of a `{{...}}`
 * block; params are parsed from the `&`-separated pairs after it.
 *
 * Empty pairs are preserved in both the trailing and the interior
 * positions (see file header rationale). Template syntax is preserved;
 * no URL-decoding.
 */
export function parseUrlQuery(input: string): ParsedUrl {
  const qIdx = findQuerySeparator(input);
  if (qIdx === -1) {
    return { base: input, params: [] };
  }
  const base = input.slice(0, qIdx);
  const query = input.slice(qIdx + 1);
  const params: QueryParam[] = [];
  for (const raw of query.split('&')) {
    params.push(parsePair(raw));
  }
  return { base, params };
}

/** Render one {@link QueryParam} as its display form (no encoding).
 *  Always emits a string — empty placeholder rows render as `''` so
 *  `['a=1', ''].join('&')` correctly produces `'a=1&'`. */
function renderPair(p: QueryParam): string {
  const { key, value, hasEquals } = p;
  if (value !== '') return `${key}=${value}`;
  if (hasEquals) return `${key}=`;
  return key;
}

/**
 * Reconstruct a URL from `base + ?k=v&…`. Disabled rows are omitted.
 * Template syntax is preserved verbatim — callers that need a wire
 * URL should use {@link appendQueryParams} on the resolved values
 * instead.
 *
 * An input of `params.length > 0` always emits the `?` separator
 * (even if every enabled row collapses to an empty pair) so a
 * trailing `?` the user typed stays visible while they compose the
 * first key. A totally empty params list (`[]`) emits no separator.
 */
export function buildUrlDisplay(base: string, params: ReadonlyArray<QueryParam>): string {
  if (params.length === 0) return base;
  const parts: string[] = [];
  for (const p of params) {
    if (p.enabled === false) continue;
    parts.push(renderPair(p));
  }
  if (parts.length === 0) return base;
  return `${base}?${parts.join('&')}`;
}

/**
 * Wire-side append. Skips disabled rows and empty-key rows; URL-
 * encodes keys and values with `encodeURIComponent`. Called by the
 * executor AFTER template resolution, so encoding acts on real
 * literal values, not `{{...}}`.
 */
export function appendQueryParams(url: string, params: ReadonlyArray<QueryParam>): string {
  const active = params.filter((p) => p.enabled !== false && p.key.trim() !== '');
  if (active.length === 0) return url;
  const qs = active.map(({ key, value }) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join('&');
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}${qs}`;
}
