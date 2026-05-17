/**
 * Server-Timing response-header parser.
 *
 * Servers can expose backend phase timings to the browser via
 * `Server-Timing: metric;dur=N;desc="text", metric2;dur=N`. Chrome's
 * DevTools surfaces this but tucked away. For backend debugging this is
 * gold — it's the only programmatic way to see what the server was
 * doing during the `wait` phase — so we surface it inline in the Timing
 * tab.
 *
 * Spec: https://w3c.github.io/server-timing/#the-server-timing-header
 */

interface HeaderEntry {
  name: string;
  value: string;
}

export interface ServerTimingMetric {
  /** Token name (e.g. `db`, `render`, `cache`). */
  name: string;
  /** Duration in milliseconds, or null when the server omitted `dur`. */
  duration: number | null;
  /** Human-readable description (from `desc=` parameter), or null. */
  description: string | null;
}

const TIMING_HEADER = 'server-timing';

/**
 * Parses every Server-Timing header in `headers` and returns the
 * concatenated metric list. Multiple `Server-Timing:` headers and
 * comma-separated entries within a single header are both flattened.
 */
export function parseServerTiming(headers: readonly HeaderEntry[] | undefined): readonly ServerTimingMetric[] {
  if (!headers || headers.length === 0) return [];
  const out: ServerTimingMetric[] = [];
  for (const h of headers) {
    if (!h?.name || h.name.toLowerCase() !== TIMING_HEADER) continue;
    const raw = h.value ?? '';
    for (const segment of splitTopLevelCommas(raw)) {
      const metric = parseMetric(segment);
      if (metric) out.push(metric);
    }
  }
  return out;
}

/**
 * Splits on top-level commas — values inside `desc="..."` quotes are
 * preserved verbatim.
 */
function splitTopLevelCommas(input: string): string[] {
  const out: string[] = [];
  let buf = '';
  let inQuote = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === '"' && input[i - 1] !== '\\') inQuote = !inQuote;
    if (ch === ',' && !inQuote) {
      const trimmed = buf.trim();
      if (trimmed) out.push(trimmed);
      buf = '';
      continue;
    }
    buf += ch;
  }
  const trailing = buf.trim();
  if (trailing) out.push(trailing);
  return out;
}

function parseMetric(segment: string): ServerTimingMetric | null {
  const parts = splitTopLevelSemis(segment);
  const nameToken = parts[0]?.trim();
  if (!nameToken) return null;
  let duration: number | null = null;
  let description: string | null = null;
  for (let i = 1; i < parts.length; i++) {
    const param = parts[i].trim();
    const eqIdx = param.indexOf('=');
    if (eqIdx < 0) continue;
    const key = param.slice(0, eqIdx).trim().toLowerCase();
    const value = param.slice(eqIdx + 1).trim();
    if (key === 'dur') {
      const num = Number.parseFloat(value);
      if (Number.isFinite(num)) duration = num;
    } else if (key === 'desc') {
      description = unquote(value);
    }
  }
  return { name: nameToken, duration, description };
}

function splitTopLevelSemis(input: string): string[] {
  const out: string[] = [];
  let buf = '';
  let inQuote = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === '"' && input[i - 1] !== '\\') inQuote = !inQuote;
    if (ch === ';' && !inQuote) {
      out.push(buf);
      buf = '';
      continue;
    }
    buf += ch;
  }
  out.push(buf);
  return out;
}

function unquote(value: string): string {
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1).replace(/\\"/g, '"');
  }
  return value;
}
