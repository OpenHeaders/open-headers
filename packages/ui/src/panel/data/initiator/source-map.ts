/**
 * Source-map v3 parser + position lookup.
 *
 * Pure, host-neutral, no fetch / no I/O. The async fetcher in
 * `source-map-cache.ts` consumes this to produce `ParsedSourceMap`
 * objects; the React hook in `use-resolved-frames.ts` queries them.
 *
 * Spec: https://sourcemaps.info/spec.html
 *
 * Design choices:
 *
 *   - **Lazy per-line decode** — `mappings` can be many megabytes on
 *     real bundles. We split into raw line strings once (cheap) and
 *     decode each line's VLQ segments only the first time it's queried.
 *     Most call stacks hit a handful of lines, so we never pay for the
 *     rest.
 *
 *   - **Binary-search segment lookup** — within a decoded line, segments
 *     are sorted ascending by `genCol`. For a query column we find the
 *     greatest `genCol ≤ col` (standard "find the segment that owns this
 *     generated position" rule).
 *
 *   - **Returns the name index** — for the Initiator tab we only need
 *     the original function name; resolving the source URL and line are
 *     fine to expose but the view doesn't currently use them (Chrome's
 *     Sources panel handles source-map resolution when we `openResource`
 *     the generated URL).
 */

export interface Segment {
  /** Generated column. Always present. */
  genCol: number;
  /** Index into `sources`. Present when the segment has 4+ VLQs. */
  srcIdx?: number;
  /** Original line in the original source. */
  origLine?: number;
  /** Original column in the original source. */
  origCol?: number;
  /** Index into `names`. Present when the segment has 5 VLQs. */
  nameIdx?: number;
}

export interface ParsedSourceMap {
  sources: readonly string[];
  names: readonly string[];
  /** Raw mapping line strings (split on `;`). Decoded lazily into `decodedLines`. */
  rawLines: readonly string[];
  /** Cache of decoded segment arrays per generated line. */
  decodedLines: Map<number, readonly Segment[]>;
}

export interface OriginalPosition {
  source: string | null;
  line: number | null;
  column: number | null;
  name: string | null;
}

// ── VLQ ──────────────────────────────────────────────────────────────

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const BASE64_TABLE: Int8Array = (() => {
  const arr = new Int8Array(128).fill(-1);
  for (let i = 0; i < BASE64_CHARS.length; i++) arr[BASE64_CHARS.charCodeAt(i)] = i;
  return arr;
})();
const VLQ_CONTINUATION = 32;
const VLQ_VALUE_MASK = 31;
const VLQ_SHIFT = 5;

interface VlqResult {
  value: number;
  nextIdx: number;
}

function decodeVlq(input: string, startIdx: number): VlqResult | null {
  let result = 0;
  let shift = 0;
  let i = startIdx;
  while (true) {
    if (i >= input.length) return null;
    const code = BASE64_TABLE[input.charCodeAt(i)];
    if (code < 0) return null;
    i++;
    const value = code & VLQ_VALUE_MASK;
    result += value << shift;
    shift += VLQ_SHIFT;
    if ((code & VLQ_CONTINUATION) === 0) break;
  }
  // Low bit is the sign; the magnitude is the rest.
  const negative = (result & 1) === 1;
  const magnitude = result >>> 1;
  return { value: negative ? -magnitude : magnitude, nextIdx: i };
}

// ── Parser ───────────────────────────────────────────────────────────

interface RawSourceMap {
  version?: number;
  sources?: unknown;
  names?: unknown;
  mappings?: unknown;
  sections?: unknown;
}

export function parseSourceMap(text: string): ParsedSourceMap | null {
  let raw: RawSourceMap;
  try {
    // Trim any leading XSSI prefix (e.g. `)]}'\n`).
    const trimmed = text.replace(/^\)\]\}'?[\r\n]+/, '');
    raw = JSON.parse(trimmed) as RawSourceMap;
  } catch {
    return null;
  }
  // Indexed / sectioned maps are not supported; surface as null so the
  // view falls back to the raw v8 frame name.
  if (raw.sections) return null;
  if (typeof raw.mappings !== 'string') return null;
  const sources = Array.isArray(raw.sources) ? (raw.sources.filter((s) => typeof s === 'string') as string[]) : [];
  const names = Array.isArray(raw.names) ? (raw.names.filter((s) => typeof s === 'string') as string[]) : [];
  const rawLines = raw.mappings.split(';');
  return { sources, names, rawLines, decodedLines: new Map() };
}

function decodeLine(rawLine: string): readonly Segment[] {
  if (rawLine.length === 0) return [];
  const segs: Segment[] = [];
  let genCol = 0;
  let srcIdx = 0;
  let origLine = 0;
  let origCol = 0;
  let nameIdx = 0;
  let i = 0;
  while (i < rawLine.length) {
    if (rawLine[i] === ',') {
      i++;
      continue;
    }
    const vlqs: number[] = [];
    while (i < rawLine.length && rawLine[i] !== ',') {
      const d = decodeVlq(rawLine, i);
      if (!d) break;
      vlqs.push(d.value);
      i = d.nextIdx;
    }
    if (vlqs.length === 0) continue;
    genCol += vlqs[0];
    const segment: Segment = { genCol };
    if (vlqs.length >= 4) {
      srcIdx += vlqs[1];
      origLine += vlqs[2];
      origCol += vlqs[3];
      segment.srcIdx = srcIdx;
      segment.origLine = origLine;
      segment.origCol = origCol;
    }
    if (vlqs.length >= 5) {
      nameIdx += vlqs[4];
      segment.nameIdx = nameIdx;
    }
    segs.push(segment);
  }
  return segs;
}

function getDecodedLine(map: ParsedSourceMap, line: number): readonly Segment[] {
  const cached = map.decodedLines.get(line);
  if (cached) return cached;
  const decoded = decodeLine(map.rawLines[line] ?? '');
  map.decodedLines.set(line, decoded);
  return decoded;
}

// ── Lookup ───────────────────────────────────────────────────────────

/**
 * Find the segment that owns the generated position `(genLine, genCol)`
 * — the segment with the greatest `genCol ≤ genCol` on `genLine`.
 * Returns `null` when the line has no segments at all.
 */
function findSegment(segments: readonly Segment[], genCol: number): Segment | null {
  if (segments.length === 0) return null;
  let lo = 0;
  let hi = segments.length - 1;
  let best = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (segments[mid].genCol <= genCol) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return best >= 0 ? segments[best] : null;
}

export function lookupOriginalPosition(map: ParsedSourceMap, genLine: number, genCol: number): OriginalPosition | null {
  if (genLine < 0 || genLine >= map.rawLines.length) return null;
  const segments = getDecodedLine(map, genLine);
  const seg = findSegment(segments, genCol);
  if (!seg) return null;
  const source = seg.srcIdx != null ? (map.sources[seg.srcIdx] ?? null) : null;
  const name = seg.nameIdx != null ? (map.names[seg.nameIdx] ?? null) : null;
  return {
    source,
    line: seg.origLine ?? null,
    column: seg.origCol ?? null,
    name,
  };
}
