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
 *   • {@link parsePathParamNames} + {@link substitutePathParams} — the
 *     path-parameter grammar (`/:name` segments) and its wire-side
 *     substitution. The editor's derived table and both executors
 *     call these two; nothing else re-implements the grammar.
 *     {@link parsePathParamSpans} is the same scan by position, for
 *     the URL bar's token painting.
 *     {@link inlinePathParams} is the display-side twin (values
 *     verbatim, nothing encoded) the GraphQL convert folds through;
 *     {@link normalizePathParamSegments} is the pairing form the spec
 *     seam keys operations by.
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

/** A query-less URL split at its path: the authority (scheme + host +
 *  port, or a bare `{{host}}` template) and the path after it. */
export interface SplitUrlPath {
  /** Everything before the first `/` past the scheme's `//`. */
  authority: string;
  /** The path from that `/` on, verbatim; `''` when the URL has none. */
  path: string;
}

/**
 * Split a query-less URL into authority + path, template-safe: a `/`
 * inside a `{{...}}` block never counts, and the scheme's own `//` is
 * skipped. Round-trips as `authority + path`. The Socket.IO editor's
 * URL⇄namespace sync rides this the way the params sync rides
 * {@link parseUrlQuery} — the official client reads a Socket.IO URL's
 * path as the namespace.
 */
export function splitUrlPath(input: string): SplitUrlPath {
  const scheme = input.indexOf('://');
  let i = scheme === -1 ? 0 : scheme + 3;
  while (i < input.length) {
    const ch = input[i];
    if (ch === '{' && input[i + 1] === '{') {
      const close = input.indexOf('}}', i + 2);
      if (close === -1) break;
      i = close + 2;
      continue;
    }
    if (ch === '/') return { authority: input.slice(0, i), path: input.slice(i) };
    i++;
  }
  return { authority: input, path: '' };
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

// ── Path parameters ────────────────────────────────────────────────
//
// A path parameter is a path segment that STARTS with `:` followed by
// an identifier (`[A-Za-z_][A-Za-z0-9_-]*`). The identifier ends at the
// first character outside that class; whatever follows in the segment
// is a literal suffix kept verbatim (`/:id.json` → the parameter `id`
// and the suffix `.json`). Only the path is scanned — the authority is
// skipped the way {@link splitUrlPath} skips it, so a port (`:8080`),
// an IPv6 literal (`[::1]`) or a `{{host}}` template never reads as a
// parameter — and the query / fragment are cut off first. A `:` or `/`
// inside a `{{...}}` block never counts, and a segment whose colon is
// not its first character (`files:batchGet`) is a literal.

const PATH_PARAM_NAME = /^[A-Za-z_][A-Za-z0-9_-]*/;

/** A path parameter named in a URL — the `/:name` segment's identifier. */
export interface PathParamName {
  /** The identifier after the `:`. */
  name: string;
  /** The segment's text after the identifier, verbatim (`''` when the
   *  segment is the parameter alone). */
  suffix: string;
}

/** Find the end of the path proper: the first `?` or `#` outside a
 *  `{{...}}` block, else the input's length. */
function findPathEnd(input: string, from: number): number {
  let i = from;
  while (i < input.length) {
    const ch = input[i];
    if (ch === '{' && input[i + 1] === '{') {
      const close = input.indexOf('}}', i + 2);
      if (close === -1) return input.length;
      i = close + 2;
      continue;
    }
    if (ch === '?' || ch === '#') return i;
    i++;
  }
  return input.length;
}

/** Split the path proper (everything from the first `/` past the
 *  authority up to the query / fragment) into its `/`-delimited
 *  segments, template-aware. Each entry is `[start, end)` into `input`;
 *  the leading `/` of a segment is not part of it. */
function pathSegmentSpans(input: string): Array<[number, number]> {
  const { path } = splitUrlPath(input);
  if (path === '') return [];
  const pathStart = input.length - path.length;
  const pathEnd = findPathEnd(input, pathStart);
  const spans: Array<[number, number]> = [];
  let segStart = pathStart + 1;
  let i = segStart;
  while (i < pathEnd) {
    const ch = input[i];
    if (ch === '{' && input[i + 1] === '{') {
      const close = input.indexOf('}}', i + 2);
      if (close === -1 || close + 2 > pathEnd) break;
      i = close + 2;
      continue;
    }
    if (ch === '/') {
      spans.push([segStart, i]);
      segStart = i + 1;
    }
    i++;
  }
  spans.push([segStart, pathEnd]);
  return spans;
}

/** Read one segment as a parameter, or `null` when it is a literal. */
function pathParamOfSegment(segment: string): PathParamName | null {
  if (segment[0] !== ':') return null;
  const match = PATH_PARAM_NAME.exec(segment.slice(1));
  if (match === null) return null;
  return { name: match[0], suffix: segment.slice(1 + match[0].length) };
}

/** One `:name` token's place in a raw URL — `[start, end)` covers the
 *  colon and the identifier, never the segment's literal suffix. */
export interface PathParamSpan {
  name: string;
  start: number;
  end: number;
}

/**
 * Every `:name` token a raw (unresolved) URL carries, in text order,
 * one entry per OCCURRENCE — `/:id/x/:id` lists `id` twice, once per
 * place. The same scan as {@link parsePathParamNames}; the URL bar
 * paints each token from this list.
 */
export function parsePathParamSpans(url: string): PathParamSpan[] {
  const out: PathParamSpan[] = [];
  for (const [start, end] of pathSegmentSpans(url)) {
    const param = pathParamOfSegment(url.slice(start, end));
    if (param === null) continue;
    out.push({ name: param.name, start, end: start + 1 + param.name.length });
  }
  return out;
}

/**
 * The path parameters a raw (unresolved) URL names, in path order, one
 * entry per DISTINCT name — `/:id/x/:id` names `id` once. Template
 * syntax stays verbatim; the authority, query and fragment are never
 * read. The editor derives its Path Parameters table from this list.
 */
export function parsePathParamNames(url: string): PathParamName[] {
  const out: PathParamName[] = [];
  const seen = new Set<string>();
  for (const [start, end] of pathSegmentSpans(url)) {
    const param = pathParamOfSegment(url.slice(start, end));
    if (param === null || seen.has(param.name)) continue;
    seen.add(param.name);
    out.push(param);
  }
  return out;
}

/**
 * Wire-side substitution. Each `/:name` segment of the raw URL becomes
 * `resolveValue(name)` percent-encoded as ONE segment with
 * `encodeURIComponent` (a `/` in a value is `%2F`, never a new
 * segment) followed by the segment's literal suffix; every other span
 * of the URL goes through `resolveOther`. A resolved value is data,
 * never syntax: a value that expands to `:x` makes no parameter. The
 * executors call this BEFORE {@link appendQueryParams}, so the query
 * never enters the scan. Returns `null` from `resolveValue` leave the
 * caller's gate to refuse — this function substitutes only what it is
 * given and keeps the `:name` text for a name no row answers.
 */
export function substitutePathParams(
  url: string,
  resolveValue: (name: string) => string | null,
  resolveOther: (text: string) => string,
): string {
  return rewritePathParams(
    url,
    (name) => {
      const value = resolveValue(name);
      return value === null ? null : encodeURIComponent(value);
    },
    resolveOther,
  );
}

/**
 * Display-side inlining — the twin of {@link substitutePathParams} the
 * way {@link buildUrlDisplay} is {@link appendQueryParams}'s: each
 * `/:name` segment becomes the row's value text VERBATIM (templates
 * kept, nothing encoded) followed by its literal suffix, every other
 * span stays as written, and a name no row answers keeps its `:name`
 * text. The GraphQL convert folds the authored rows into the URL
 * through this.
 */
export function inlinePathParams(url: string, rowValue: (name: string) => string | null): string {
  return rewritePathParams(url, rowValue, (text) => text);
}

const TEMPLATE_SEGMENT_HEAD = /^\{\{([A-Za-z_][A-Za-z0-9_-]*)\}\}/;

/**
 * The pairing form of a URL: a path segment that BEGINS with a
 * `{{name}}` template whose name is an identifier reads as the `:name`
 * parameter segment, its suffix kept (`/{{id}}.json` → `/:id.json`,
 * the prefix rule); every other span stays verbatim — the authority
 * (`{{baseUrl}}`, `{{host}}:8080`), a dotted reference (`{{env.X}}`),
 * a template inside a segment, the query. Two URLs that name the same
 * operation one in the template form a collection generated before
 * path parameters carries and one in the parameter form the importer
 * emits now compare equal through this; nothing on the wire or in the
 * editor reads it.
 */
export function normalizePathParamSegments(url: string): string {
  const spans = pathSegmentSpans(url);
  if (spans.length === 0) return url;
  const out: string[] = [];
  let cursor = 0;
  for (const [start, end] of spans) {
    const segment = url.slice(start, end);
    const match = TEMPLATE_SEGMENT_HEAD.exec(segment);
    if (match === null) continue;
    out.push(url.slice(cursor, start), `:${match[1]}`, segment.slice(match[0].length));
    cursor = end;
  }
  out.push(url.slice(cursor));
  return out.join('');
}

/** The one walk behind both rewrites: each parameter segment becomes
 *  `segmentText(name)` (or stays when that is `null`) plus its suffix
 *  through `other`; every other span goes through `other`. */
function rewritePathParams(
  url: string,
  segmentText: (name: string) => string | null,
  other: (text: string) => string,
): string {
  const spans = pathSegmentSpans(url);
  if (spans.length === 0) return other(url);
  const out: string[] = [];
  let cursor = 0;
  for (const [start, end] of spans) {
    const segment = url.slice(start, end);
    const param = pathParamOfSegment(segment);
    const text = param === null ? null : segmentText(param.name);
    if (param === null || text === null) continue;
    out.push(other(url.slice(cursor, start)));
    out.push(text);
    out.push(other(param.suffix));
    cursor = end;
  }
  out.push(other(url.slice(cursor)));
  return out.join('');
}
