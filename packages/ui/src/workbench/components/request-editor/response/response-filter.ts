/**
 * Structural filters for the response body Filter bar — one evaluator
 * per queryable language. JSON gets a JSONPath subset (below); XML and
 * HTML get real XPath 1.0 through the platform's `DOMParser` +
 * `document.evaluate` (no bundled engine). Languages without a
 * structural query form (text, JavaScript, Markdown) get no filter —
 * Find covers them.
 *
 * JSONPath subset (deliberately small — the common drill-down shapes,
 * no predicates or slices):
 *
 *   $                     root (optional prefix)
 *   .key                  object member
 *   ['key'] / ["key"]     object member, any characters
 *   [n]                   array index (negative counts from the end)
 *   [*]  /  .*            every child (array items / object values)
 *   ..key                 recursive descent to `key` anywhere below
 *
 * Evaluation returns EVERY match in document order; the caller decides
 * how to render one-vs-many.
 */

export type JsonPathResult = { ok: true; matches: unknown[] } | { ok: false };

type Segment =
  | { kind: 'key'; key: string }
  | { kind: 'index'; index: number }
  | { kind: 'wildcard' }
  | { kind: 'recursive'; key: string };

const SEGMENT_PATTERNS: ReadonlyArray<{ re: RegExp; toSegment: (m: RegExpExecArray) => Segment }> = [
  { re: /^\.\.([A-Za-z_$][\w$-]*)/, toSegment: (m) => ({ kind: 'recursive', key: m[1] ?? '' }) },
  { re: /^\.\*/, toSegment: () => ({ kind: 'wildcard' }) },
  { re: /^\.([A-Za-z_$][\w$-]*)/, toSegment: (m) => ({ kind: 'key', key: m[1] ?? '' }) },
  { re: /^\[\s*(['"])((?:(?!\1).)*)\1\s*\]/, toSegment: (m) => ({ kind: 'key', key: m[2] ?? '' }) },
  { re: /^\[\s*\*\s*\]/, toSegment: () => ({ kind: 'wildcard' }) },
  { re: /^\[\s*(-?\d+)\s*\]/, toSegment: (m) => ({ kind: 'index', index: Number(m[1]) }) },
];

function parsePath(path: string): Segment[] | null {
  let rest = path.trim();
  if (rest.startsWith('$')) rest = rest.slice(1);
  const segments: Segment[] = [];
  while (rest.length > 0) {
    const hit = SEGMENT_PATTERNS.map((p) => ({ p, m: p.re.exec(rest) })).find((c) => c.m !== null);
    if (!hit?.m) return null;
    segments.push(hit.p.toSegment(hit.m));
    rest = rest.slice(hit.m[0].length);
  }
  return segments;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function childValues(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (isRecord(value)) return Object.values(value);
  return [];
}

function memberValue(value: unknown, key: string): unknown[] {
  if (isRecord(value) && Object.hasOwn(value, key)) return [value[key]];
  return [];
}

/** The node itself plus every descendant, in document order. */
function descendants(value: unknown): unknown[] {
  const out: unknown[] = [value];
  for (const child of childValues(value)) out.push(...descendants(child));
  return out;
}

function applySegment(nodes: unknown[], segment: Segment): unknown[] {
  switch (segment.kind) {
    case 'key':
      return nodes.flatMap((n) => memberValue(n, segment.key));
    case 'index':
      return nodes.flatMap((n) => {
        if (!Array.isArray(n)) return [];
        const at = segment.index < 0 ? n.length + segment.index : segment.index;
        return at >= 0 && at < n.length ? [n[at]] : [];
      });
    case 'wildcard':
      return nodes.flatMap(childValues);
    case 'recursive':
      return nodes.flatMap((n) => descendants(n).flatMap((d) => memberValue(d, segment.key)));
  }
}

export function evaluateJsonPath(root: unknown, path: string): JsonPathResult {
  const segments = parsePath(path);
  if (segments === null) return { ok: false };
  let nodes: unknown[] = [root];
  for (const segment of segments) nodes = applySegment(nodes, segment);
  return { ok: true, matches: nodes };
}

/**
 * Forgiving form of a mid-edit query: a trailing separator (`/` for
 * XPath, `.` / `[` for JSONPath) means "descend from here", not an
 * error — evaluate the base the user has typed so far, and let the
 * suggest list offer what comes next.
 */
export function normalizeFilterQuery(query: string, kind: 'jsonpath' | 'xpath'): string {
  const q = query.trim();
  if (kind === 'xpath') return q.replace(/\/+$/, '') || '/';
  return q.replace(/[.[]+$/, '') || '$';
}

/** Cap on lookahead suggestions — a completion list, not an index. */
const SUGGEST_LIMIT = 50;

const IDENTIFIER_KEY = /^[A-Za-z_$][\w$-]*$/;

/** The separator that continues a path below `value` — appended to a
 *  suggestion so accepting it re-opens the next level's lookahead.
 *  Empty for leaves (primitives, empty containers). */
function jsonChildSeparator(value: unknown): string {
  if (Array.isArray(value) && value.length > 0) return '[';
  if (isRecord(value) && Object.keys(value).length > 0) return '.';
  return '';
}

/**
 * Contextual JSONPath completion: evaluate the query up to its last
 * separator against the body, then offer THAT level's members — object
 * keys (dot form when they fit the grammar, bracket-quoted otherwise)
 * and `[0]` / `[*]` for arrays — filtered by the trailing fragment.
 * Each suggestion is the full replacement string; members with
 * children carry a trailing separator so the drill-down continues.
 */
export function suggestJsonPathCompletions(root: unknown, query: string): string[] {
  const q = query.trim();
  const lastDot = q.lastIndexOf('.');
  const lastBracket = q.lastIndexOf('[');
  const cut = Math.max(lastDot, lastBracket);
  const bracketContext = lastBracket > lastDot;
  let base = cut <= 0 ? '$' : q.slice(0, cut);
  // A '..' recursive prefix leaves a dangling dot — trim so the base
  // evaluates (completion then works from the non-recursive parent).
  while (base.endsWith('.')) base = base.slice(0, -1);
  if (base === '') base = '$';
  const partial = (cut === -1 ? q.replace(/^\$/, '') : q.slice(cut + 1)).replace(/^['"]/, '').toLowerCase();

  const evaluated = evaluateJsonPath(root, base);
  if (!evaluated.ok) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (full: string) => {
    if (!seen.has(full) && out.length < SUGGEST_LIMIT) {
      seen.add(full);
      out.push(full);
    }
  };
  for (const node of evaluated.matches) {
    if (Array.isArray(node)) {
      if (node.length === 0) continue;
      // The first element stands in for the level below `[*]` too —
      // response arrays are near-universally homogeneous.
      const sep = jsonChildSeparator(node[0]);
      for (const index of ['0', '*']) {
        if (partial !== '' && !(bracketContext && index.startsWith(partial))) continue;
        push(`${base}[${index}]${sep}`);
      }
    } else if (isRecord(node)) {
      for (const key of Object.keys(node)) {
        if (partial !== '' && !key.toLowerCase().startsWith(partial)) continue;
        const safeKey = key.replaceAll("'", '');
        const sep = jsonChildSeparator(node[key]);
        push(bracketContext || !IDENTIFIER_KEY.test(key) ? `${base}['${safeKey}']${sep}` : `${base}.${key}${sep}`);
      }
    }
    if (out.length >= SUGGEST_LIMIT) break;
  }
  return out;
}

/**
 * Contextual XPath completion: element-name lookahead for the segment
 * being typed. A bare fragment offers `//tag` over the document's
 * distinct tags; after a `/` the base path is evaluated and its
 * children's tags offered. Tags with element children carry a trailing
 * `/` so the drill-down continues. Empty for a document that doesn't
 * parse. Candidate maps are tag → "has element children anywhere".
 */
export function suggestXPathCompletions(body: string, kind: 'xml' | 'html', query: string): string[] {
  const doc = new DOMParser().parseFromString(body, kind === 'xml' ? 'text/xml' : 'text/html');
  if ((kind === 'xml' && doc.getElementsByTagName('parsererror').length > 0) || !doc.documentElement) return [];
  const q = query.trim();

  const mergeTag = (tags: Map<string, boolean>, el: Element) => {
    const tag = el.tagName.toLowerCase();
    const prev = tags.get(tag);
    if (prev === undefined) {
      if (tags.size < SUGGEST_LIMIT) tags.set(tag, el.children.length > 0);
    } else if (!prev && el.children.length > 0) {
      tags.set(tag, true);
    }
  };

  const allTags = () => {
    const tags = new Map<string, boolean>();
    const walk = (el: Element) => {
      mergeTag(tags, el);
      for (const child of Array.from(el.children)) walk(child);
    };
    walk(doc.documentElement);
    return tags;
  };

  const toPaths = (tags: Map<string, boolean>, prefix: string, partial: string) =>
    Array.from(tags)
      .filter(([tag]) => tag.startsWith(partial))
      .map(([tag, hasChildren]) => `${prefix}${tag}${hasChildren ? '/' : ''}`)
      .slice(0, SUGGEST_LIMIT);

  const lastSlash = q.lastIndexOf('/');
  if (lastSlash === -1) return toPaths(allTags(), '//', q.toLowerCase());
  const base = q.slice(0, lastSlash);
  const partial = q.slice(lastSlash + 1).toLowerCase();

  if (base === '') {
    const root = doc.documentElement;
    return toPaths(new Map([[root.tagName.toLowerCase(), root.children.length > 0]]), '/', partial);
  }
  if (base === '/') return toPaths(allTags(), '//', partial);
  try {
    const result = doc.evaluate(base, doc, null, XPathResult.ORDERED_NODE_ITERATOR_TYPE, null);
    const tags = new Map<string, boolean>();
    for (let node = result.iterateNext(); node !== null; node = result.iterateNext()) {
      if (node.nodeType !== Node.ELEMENT_NODE) continue;
      for (const child of Array.from((node as Element).children)) mergeTag(tags, child);
    }
    return toPaths(tags, `${base}/`, partial);
  } catch {
    return [];
  }
}

export type XPathResultText = { ok: true; matches: string[] } | { ok: false };

/**
 * XPath 1.0 over the body text via the platform DOM. Node matches
 * serialize back to markup; string/number/boolean results become one
 * text match. `{ ok: false }` covers both an unparseable document and
 * an invalid expression — the bar shows the same honest error state.
 */
export function evaluateXPath(body: string, path: string, kind: 'xml' | 'html'): XPathResultText {
  const doc = new DOMParser().parseFromString(body, kind === 'xml' ? 'text/xml' : 'text/html');
  if (kind === 'xml' && doc.getElementsByTagName('parsererror').length > 0) return { ok: false };
  try {
    const result = doc.evaluate(path, doc, null, XPathResult.ANY_TYPE, null);
    if (result.resultType === XPathResult.STRING_TYPE) return { ok: true, matches: [result.stringValue] };
    if (result.resultType === XPathResult.NUMBER_TYPE) return { ok: true, matches: [String(result.numberValue)] };
    if (result.resultType === XPathResult.BOOLEAN_TYPE) return { ok: true, matches: [String(result.booleanValue)] };
    const serializer = new XMLSerializer();
    const matches: string[] = [];
    for (let node = result.iterateNext(); node !== null; node = result.iterateNext()) {
      matches.push(node.nodeType === Node.ATTRIBUTE_NODE ? (node.nodeValue ?? '') : serializer.serializeToString(node));
    }
    return { ok: true, matches };
  } catch {
    return { ok: false };
  }
}
