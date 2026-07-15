/**
 * Metric-family filter for Prometheus/OpenMetrics response bodies — the
 * metrics sibling of `response-filter.ts`'s JSONPath/XPath evaluators.
 *
 * The body parses once into families (`# HELP`/`# TYPE`/`# UNIT` header
 * lines plus their sample lines — histogram/summary siblings like
 * `_bucket`/`_sum`/`_count` attach to their declared family). Queries
 * use a hybrid syntax:
 *
 *   http                                bare word — case-insensitive
 *                                       substring over family (and
 *                                       sample) names; whole families
 *   http_requests_total{code="500"}     selector — exact name plus
 *                                       PromQL-style label matchers
 *                                       (`=`, `!=`, `=~`, `!~`);
 *                                       matching series only
 *   {job=~"api.*"}                      matchers alone — any family
 *
 * Matching output is verbatim source lines (header lines + matching
 * sample lines per family), so the filtered pane still reads as
 * exposition text. Display-only throughout: the parse never rewrites
 * capture bytes, and evaluation returns slices of the original lines.
 *
 * Mid-edit forgiveness mirrors `normalizeFilterQuery`: while the brace
 * is still open, a dangling fragment (`name{`, `name{code=`, an
 * unterminated value) is dropped and the completed part evaluates. A
 * CLOSED selector with malformed content is an error (`{ ok: false }`).
 */

const METRIC_NAME = /^[a-zA-Z_:][a-zA-Z0-9_:]*$/;
const SAMPLE_NAME = /^([a-zA-Z_:][a-zA-Z0-9_:]*)/;
const META_LINE = /^#\s*(?:HELP|TYPE|UNIT)\s+([a-zA-Z_:][a-zA-Z0-9_:]*)(?:\s|$)/;

/** Sample-name suffixes that attach to a DECLARED family — histogram /
 *  summary components plus the OpenMetrics counter/info suffixes. */
const FAMILY_SUFFIXES = ['_bucket', '_count', '_sum', '_created', '_gcount', '_gsum', '_total', '_info'];

export interface MetricSeries {
  /** Sample metric name as written (`x_bucket`, not the family `x`). */
  name: string;
  labels: Readonly<Record<string, string>>;
  /** The verbatim source line, exemplar and all. */
  line: string;
}

export interface MetricFamily {
  name: string;
  /** `# HELP` / `# TYPE` / `# UNIT` lines, verbatim, document order. */
  headerLines: string[];
  series: MetricSeries[];
}

export interface MetricsDocument {
  families: MetricFamily[];
}

/** Unescape a label value's `\\` / `\"` / `\n` escapes — the three the
 *  exposition format defines. Unknown escapes stay verbatim, so a
 *  regex matcher's `\.` survives into compilation. */
function unescapeLabelValue(raw: string): string {
  return raw.replace(/\\(.)/g, (whole, ch: string) => (ch === 'n' ? '\n' : ch === '"' || ch === '\\' ? ch : whole));
}

/** Parse `{key="value",…}` starting at `text[start]` (the `{`). Returns
 *  the label map and the index just past the closing `}`, or null when
 *  malformed. */
function parseLabelSet(text: string, start: number): { labels: Record<string, string>; end: number } | null {
  const labels: Record<string, string> = {};
  let i = start + 1;
  const skipSpaces = () => {
    while (i < text.length && (text[i] === ' ' || text[i] === '\t')) i++;
  };
  skipSpaces();
  if (text[i] === '}') return { labels, end: i + 1 };
  for (;;) {
    skipSpaces();
    const key = /^[a-zA-Z_][a-zA-Z0-9_]*/.exec(text.slice(i));
    if (!key) return null;
    i += key[0].length;
    skipSpaces();
    if (text[i] !== '=') return null;
    i++;
    skipSpaces();
    if (text[i] !== '"') return null;
    i++;
    let raw = '';
    while (i < text.length && text[i] !== '"') {
      if (text[i] === '\\') {
        raw += text.slice(i, i + 2);
        i += 2;
      } else {
        raw += text[i];
        i++;
      }
    }
    if (text[i] !== '"') return null;
    i++;
    labels[key[0]] = unescapeLabelValue(raw);
    skipSpaces();
    if (text[i] === ',') {
      i++;
      continue;
    }
    if (text[i] === '}') return { labels, end: i + 1 };
    return null;
  }
}

/** Value (+ optional timestamp/exemplar) that must follow a sample's
 *  name and label set — anything else disqualifies the line. */
const SAMPLE_TAIL = /^\s+(?:[+-]?(?:Inf|NaN)|-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)(?:\s|$)/;

/**
 * Parse an exposition body into its metric families. Tolerant by
 * design: lines that don't fit the grammar are skipped (they carry no
 * queryable structure), never fatal — a filter over a half-garbled
 * body still narrows what parsed.
 */
export function parseMetricsBody(body: string): MetricsDocument {
  const families: MetricFamily[] = [];
  const byName = new Map<string, MetricFamily>();
  const familyFor = (name: string): MetricFamily => {
    const existing = byName.get(name);
    if (existing) return existing;
    const family: MetricFamily = { name, headerLines: [], series: [] };
    byName.set(name, family);
    families.push(family);
    return family;
  };

  for (const line of body.split('\n')) {
    if (line.trim() === '') continue;
    if (line.startsWith('#')) {
      const meta = META_LINE.exec(line);
      if (meta) familyFor(meta[1]).headerLines.push(line);
      continue;
    }
    const nameMatch = SAMPLE_NAME.exec(line);
    if (!nameMatch) continue;
    const name = nameMatch[1];
    let labels: Record<string, string> = {};
    let end = name.length;
    if (line[name.length] === '{') {
      const parsed = parseLabelSet(line, name.length);
      if (parsed === null) continue;
      labels = parsed.labels;
      end = parsed.end;
    }
    if (!SAMPLE_TAIL.test(line.slice(end))) continue;
    // A suffixed sample (`x_bucket`) belongs to its DECLARED family
    // (`x`); undeclared names stand as their own implicit family.
    let owner = byName.get(name);
    if (!owner) {
      const suffix = FAMILY_SUFFIXES.find((s) => name.endsWith(s));
      const base = suffix ? name.slice(0, -suffix.length) : '';
      owner = (suffix ? byName.get(base) : undefined) ?? familyFor(name);
    }
    owner.series.push({ name, labels, line });
  }
  return { families };
}

// ── Query ────────────────────────────────────────────────────────────

type MatcherOp = '=' | '!=' | '=~' | '!~';

interface Matcher {
  key: string;
  op: MatcherOp;
  value: string;
  /** Full-anchored, compiled — regex ops only. */
  re?: RegExp;
}

type MetricsQuery = { kind: 'name'; needle: string } | { kind: 'selector'; name: string; matchers: Matcher[] };

const MATCHER_HEAD = /^([a-zA-Z_][a-zA-Z0-9_]*)\s*(=~|!~|!=|=)\s*/;

/** Scan a quoted value from `text[0] === '"'`; returns the unescaped
 *  value and consumed length, or null when unterminated. */
function scanQuotedValue(text: string): { value: string; length: number } | null {
  let i = 1;
  let raw = '';
  while (i < text.length && text[i] !== '"') {
    if (text[i] === '\\') {
      raw += text.slice(i, i + 2);
      i += 2;
    } else {
      raw += text[i];
      i++;
    }
  }
  if (text[i] !== '"') return null;
  return { value: unescapeLabelValue(raw), length: i + 1 };
}

function parseMetricsQuery(query: string): MetricsQuery | null {
  const q = query.trim();
  const braceIdx = q.indexOf('{');
  if (braceIdx === -1) {
    return { kind: 'name', needle: q.toLowerCase() };
  }
  const name = q.slice(0, braceIdx).trim();
  if (name !== '' && !METRIC_NAME.test(name)) return null;
  const closeIdx = q.indexOf('}');
  if (closeIdx !== -1 && q.slice(closeIdx + 1).trim() !== '') return null;
  const closed = closeIdx !== -1;
  let rest = closed ? q.slice(braceIdx + 1, closeIdx) : q.slice(braceIdx + 1);

  const matchers: Matcher[] = [];
  while (rest.trim() !== '') {
    rest = rest.trimStart();
    const head = MATCHER_HEAD.exec(rest);
    // Dangling fragment: still typing → evaluate what's complete;
    // inside a CLOSED selector it's malformed.
    if (!head) return closed ? null : { kind: 'selector', name, matchers };
    rest = rest.slice(head[0].length);
    if (!rest.startsWith('"')) return closed ? null : { kind: 'selector', name, matchers };
    const scanned = scanQuotedValue(rest);
    if (!scanned) return closed ? null : { kind: 'selector', name, matchers };
    rest = rest.slice(scanned.length);
    const op = head[2] as MatcherOp;
    const matcher: Matcher = { key: head[1], op, value: scanned.value };
    if (op === '=~' || op === '!~') {
      try {
        matcher.re = new RegExp(`^(?:${scanned.value})$`);
      } catch {
        // Invalid regex: an error once closed; dropped while typing.
        if (closed) return null;
        continue;
      }
    }
    matchers.push(matcher);
    rest = rest.trimStart();
    if (rest.startsWith(',')) {
      rest = rest.slice(1);
      continue;
    }
    if (rest !== '') return closed ? null : { kind: 'selector', name, matchers };
  }
  return { kind: 'selector', name, matchers };
}

// ── Evaluation ───────────────────────────────────────────────────────

export type MetricsFilterResult = { ok: true; matches: string[] } | { ok: false };

/** PromQL semantics: an absent label matches as the empty string. */
function seriesMatches(series: MetricSeries, matchers: Matcher[]): boolean {
  for (const m of matchers) {
    const value = series.labels[m.key] ?? '';
    const hit =
      m.op === '='
        ? value === m.value
        : m.op === '!='
          ? value !== m.value
          : m.op === '=~'
            ? (m.re as RegExp).test(value)
            : !(m.re as RegExp).test(value);
    if (!hit) return false;
  }
  return true;
}

function familyBlock(family: MetricFamily, series: MetricSeries[]): string {
  return [...family.headerLines, ...series.map((s) => s.line)].join('\n');
}

/**
 * Evaluate a metric-family query against a parsed body. Each match is
 * one family's block (header lines + the sample lines that matched) —
 * the caller joins blocks line-wise, so the filtered pane reads as
 * exposition text.
 */
export function evaluateMetricsFilter(doc: MetricsDocument, query: string): MetricsFilterResult {
  const parsed = parseMetricsQuery(query);
  if (parsed === null) return { ok: false };
  const matches: string[] = [];

  if (parsed.kind === 'name') {
    for (const family of doc.families) {
      const hit =
        family.name.toLowerCase().includes(parsed.needle) ||
        family.series.some((s) => s.name.toLowerCase().includes(parsed.needle));
      if (hit) matches.push(familyBlock(family, family.series));
    }
    return { ok: true, matches };
  }

  for (const family of doc.families) {
    // Name selection: the family itself, or an exact sample name within
    // it (`x_bucket{…}` narrows to the bucket lines).
    let pool: MetricSeries[];
    if (parsed.name === '' || parsed.name === family.name) {
      pool = family.series;
    } else {
      pool = family.series.filter((s) => s.name === parsed.name);
      if (pool.length === 0) continue;
    }
    const matched = parsed.matchers.length === 0 ? pool : pool.filter((s) => seriesMatches(s, parsed.matchers));
    if (matched.length === 0) {
      // A named, series-less family (headers only) still shows for a
      // bare `name{}` — there is nothing the matchers could exclude.
      if (parsed.name === family.name && family.series.length === 0 && parsed.matchers.length === 0) {
        matches.push(familyBlock(family, []));
      }
      continue;
    }
    matches.push(familyBlock(family, matched));
  }
  return { ok: true, matches };
}

// ── Completions ──────────────────────────────────────────────────────

/** Cap on lookahead suggestions — a completion list, not an index. */
const SUGGEST_LIMIT = 50;

/** Re-escape a label value for insertion between quotes. */
function escapeLabelValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

/** The families a selector's name part narrows completions to. */
function candidateFamilies(doc: MetricsDocument, name: string): MetricFamily[] {
  if (name === '') return doc.families;
  return doc.families.filter((f) => f.name === name || f.series.some((s) => s.name === name));
}

/**
 * Contextual completions, mirroring `suggestJsonPathCompletions`: full
 * replacement strings, capped. Family names complete outside a brace
 * (with a trailing `{` when the family carries labels, so accepting
 * re-opens the next level); label keys complete after `{` or `,`
 * (trailing `=` continues into values); label values complete after an
 * operator, closed and quoted.
 */
export function suggestMetricsCompletions(doc: MetricsDocument, query: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (full: string) => {
    if (!seen.has(full) && out.length < SUGGEST_LIMIT) {
      seen.add(full);
      out.push(full);
    }
  };

  const braceIdx = query.lastIndexOf('{');
  if (braceIdx === -1) {
    const partial = query.trim().toLowerCase();
    for (const family of doc.families) {
      if (partial !== '' && !family.name.toLowerCase().includes(partial)) continue;
      const hasLabels = family.series.some((s) => Object.keys(s.labels).length > 0);
      push(hasLabels ? `${family.name}{` : family.name);
    }
    return out;
  }

  const name = query.slice(0, braceIdx).trim();
  if (name !== '' && !METRIC_NAME.test(name)) return [];
  const families = candidateFamilies(doc, name);
  const inside = query.slice(braceIdx + 1);
  if (inside.includes('}')) return [];
  const lastComma = inside.lastIndexOf(',');
  const base = query.slice(0, braceIdx + 1 + lastComma + 1);
  const fragment = inside.slice(lastComma + 1).trimStart();

  const valueContext = MATCHER_HEAD.exec(fragment);
  if (valueContext) {
    const key = valueContext[1];
    const op = valueContext[2];
    const partial = fragment.slice(valueContext[0].length).replace(/^"/, '').toLowerCase();
    for (const family of families) {
      for (const series of family.series) {
        const value = series.labels[key];
        if (value === undefined) continue;
        if (partial !== '' && !value.toLowerCase().includes(partial)) continue;
        push(`${base}${key}${op}"${escapeLabelValue(value)}"`);
      }
    }
    return out;
  }

  const partialKey = fragment.toLowerCase();
  for (const family of families) {
    for (const series of family.series) {
      for (const key of Object.keys(series.labels)) {
        if (partialKey !== '' && !key.toLowerCase().startsWith(partialKey)) continue;
        push(`${base}${key}=`);
      }
    }
  }
  return out;
}

/** The segment a metrics suggestion appends — shown as the list label
 *  (the full query is the insert text). */
export function metricsSuggestionLabel(suggestion: string): string {
  const s = suggestion.replace(/\{$/, '');
  const cut = Math.max(s.lastIndexOf('{'), s.lastIndexOf(','));
  return cut === -1 ? s : s.slice(cut + 1);
}
