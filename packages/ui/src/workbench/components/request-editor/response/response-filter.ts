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
