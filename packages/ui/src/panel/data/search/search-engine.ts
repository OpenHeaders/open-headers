/**
 * Time-sliced, cancellable full-text search across inspector rows.
 *
 * ## Algorithm (host-DevTools-equivalent)
 *
 * The query compiles to a single native `RegExp` (with the `g` flag so
 * `exec` walks the string; `i` when case-insensitive). For each section
 * of each row we call `regex.exec(text)` in a tight loop — V8's
 * compiled Boyer-Moore/SIMD string search. Line numbers and surrounding
 * line text are computed inline per match; we never materialise a
 * lines array (`text.split('\n')` would be the bottleneck it used to be)
 * and never slice the full line (minified bundles are one megabyte-scale
 * line — slicing it per match used to allocate gigabytes).
 *
 * `lineText` is a bounded window around the match position:
 * `[max(lineStart, pos - ctxBefore) .. +LINE_TEXT_CAP]`. On normal
 * multi-line files this collapses to the natural line. On minified
 * bundles the match stays visible with surrounding context.
 *
 * ## Execution model (why it doesn't freeze the UI)
 *
 * In production this module runs inside a dedicated Web Worker
 * (`workers/search.worker.ts`). That alone is enough to guarantee the
 * panel's main thread is never blocked by search work.
 *
 * Even inside the worker we time-slice: the scan loop checks elapsed
 * time after each match and yields (`scheduler.yield()` if available,
 * `MessageChannel` fallback) when `BUDGET_MS` is exceeded.
 *
 * Progress reports `currentDisplayId` + `currentSection` +
 * `sectionScanned/sectionTotal` so the UI can render
 * `Searching #42 (Response) 45%` ticking up, not a frozen label.
 *
 * This module is isomorphic: it imports nothing worker-specific and
 * runs identically in the main thread (used by the inline-transport
 * fallback in non-browser test environments — see `search-transport`).
 */

import type { FilterConfig } from '../filter-engine';
import type { InspectorRow } from '../inspector-facet';
import { currentHarEntry, currentResponseBody } from '../inspector-row-projection';

/**
 * Canonical section names emitted by {@link buildSearchableText}.
 */
export const SECTION = {
  General: 'General',
  RequestHeaders: 'Request Headers',
  ResponseHeaders: 'Response Headers',
  QueryParams: 'Query Params',
  RequestBody: 'Request Body',
  Response: 'Response',
} as const;

export type SectionName = (typeof SECTION)[keyof typeof SECTION];

/**
 * Sections whose matches reference document coordinates the user can
 * navigate to (line + column inside a multi-line body). Headers, URL,
 * query params render as tables where only line has meaning.
 */
const LINE_COLUMN_SECTIONS: ReadonlySet<string> = new Set<string>([SECTION.RequestBody, SECTION.Response]);

/** True when `L:C` coordinates make sense for the given section. */
export function sectionHasLineColumn(section: string): boolean {
  return LINE_COLUMN_SECTIONS.has(section);
}

export interface SearchMatch {
  lineNumber: number;
  /**
   * 1-based column within `lineNumber` where the match begins.
   */
  column: number;
  lineText: string;
  section: string;
  /**
   * 0-based index of this match within its section.
   */
  sectionIndex: number;
}

export interface SearchGroup {
  /** `lifecycle.requestId` — stable identity of the row. */
  entryId: string;
  displayId: number;
  filename: string;
  origin: string;
  /** Wall-clock ms at which the lifecycle started. */
  timestamp: number;
  matches: SearchMatch[];
}

export interface SearchProgress {
  done: number;
  total: number;
  elapsedMs: number;
  /** Row the scanner is currently inside, or null between rows. */
  currentDisplayId?: number | null;
  /** Section of the current row being scanned (e.g. "Response"). */
  currentSection?: string | null;
  /** Byte-level progress within the current section. */
  sectionScanned?: number | null;
  sectionTotal?: number | null;
}

/** Max synchronous work between yields. */
const BUDGET_MS = 8;
/** Hard cap on matches per row — prevents 1 row from owning the whole scan. */
const MAX_MATCHES_PER_ENTRY = 500;
/** Display-cap for match line text — avoids shipping a full megabyte line to the UI. */
const LINE_TEXT_CAP = 400;
/** Context window before the match inside `lineText`. */
const LINE_CTX_BEFORE = Math.floor(LINE_TEXT_CAP / 4);

function extractFilename(url: string): { filename: string; origin: string } {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split('/').filter(Boolean);
    const filename = segments.length > 0 ? segments[segments.length - 1] : parsed.hostname;
    return { filename, origin: parsed.hostname + parsed.pathname };
  } catch {
    return { filename: url, origin: url };
  }
}

export function buildSearchableText(row: InspectorRow): Array<{ text: string; section: SectionName }> {
  const parts: Array<{ text: string; section: SectionName }> = [];
  const lc = row.lifecycle;
  const har = currentHarEntry(lc);

  const general = [lc.url, `${lc.method} ${lc.statusCode ?? ''} ${lc.statusText ?? ''}`].join('\n');
  parts.push({ text: general, section: SECTION.General });

  const reqHeaders = har?.request?.headers;
  if (reqHeaders && reqHeaders.length > 0) {
    parts.push({
      text: reqHeaders.map((h) => `${h.name}: ${h.value}`).join('\n'),
      section: SECTION.RequestHeaders,
    });
  }

  const resHeaders = har?.response?.headers;
  if (resHeaders && resHeaders.length > 0) {
    parts.push({
      text: resHeaders.map((h) => `${h.name}: ${h.value}`).join('\n'),
      section: SECTION.ResponseHeaders,
    });
  }

  const qs = har?.request?.queryString;
  if (qs && qs.length > 0) {
    parts.push({
      text: qs.map((q) => `${q.name}=${q.value}`).join('\n'),
      section: SECTION.QueryParams,
    });
  }

  const postData = har?.request?.postData;
  if (postData?.text) {
    parts.push({ text: postData.text, section: SECTION.RequestBody });
  }

  const body = currentResponseBody(lc);
  if (body?.content) {
    parts.push({ text: body.content, section: SECTION.Response });
  }

  return parts;
}

const REGEX_ESCAPE = /[.*+?^${}()|[\]\\]/g;

/**
 * Compile the user's query into a native RegExp with the `g` flag set
 * (mandatory — `exec` otherwise loops forever on the first match).
 * Returns `null` for invalid regex or empty query.
 */
export function compileMatcher(query: string, config: FilterConfig): RegExp | null {
  const trimmed = query.trim();
  if (!trimmed) return null;
  const flags = config.matchCase ? 'g' : 'gi';
  let pattern: string;
  if (config.regexMode) {
    pattern = trimmed;
  } else {
    const escaped = trimmed.replace(REGEX_ESCAPE, '\\$&');
    pattern = config.wholeWord ? `\\b${escaped}\\b` : escaped;
  }
  try {
    return new RegExp(pattern, flags);
  } catch {
    return null;
  }
}

/** Back-compat helper retained for tests. Runtime scanner does not use it. */
export function lineMatches(line: string, query: string, config: FilterConfig): boolean {
  const matcher = compileMatcher(query, config);
  if (!matcher) return false;
  matcher.lastIndex = 0;
  return matcher.test(line);
}

/** Yield to the event loop. Uses `scheduler.yield` when available. */
function yieldToEventLoop(): Promise<void> {
  const s = (globalThis as unknown as { scheduler?: { yield?: () => Promise<void> } }).scheduler;
  if (s?.yield) return s.yield();
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => {
      channel.port1.close();
      channel.port2.close();
      resolve();
    };
    channel.port2.postMessage(null);
  });
}

type SectionTickCallback = (scanned: number, total: number) => void;

async function scanSectionAsync(
  text: string,
  section: string,
  matcher: RegExp,
  cap: number,
  signal: AbortSignal,
  onTick: SectionTickCallback,
): Promise<SearchMatch[]> {
  const out: SearchMatch[] = [];
  const textLen = text.length;
  if (textLen === 0 || cap === 0) return out;

  let line = 1;
  let lineStart = 0;
  let nextNewline = text.indexOf('\n');

  matcher.lastIndex = 0;
  let chunkStart = performance.now();

  onTick(0, textLen);

  while (out.length < cap) {
    const m = matcher.exec(text);
    if (m === null) break;
    const pos = m.index;

    while (nextNewline !== -1 && nextNewline < pos) {
      line++;
      lineStart = nextNewline + 1;
      nextNewline = text.indexOf('\n', lineStart);
    }
    const lineEnd = nextNewline === -1 ? textLen : nextNewline;

    const displayStart = Math.max(lineStart, pos - LINE_CTX_BEFORE);
    const displayEnd = Math.min(lineEnd, displayStart + LINE_TEXT_CAP);
    out.push({
      lineNumber: line,
      column: pos - lineStart + 1,
      lineText: text.slice(displayStart, displayEnd),
      section,
      sectionIndex: out.length,
    });

    if (m.index === matcher.lastIndex) matcher.lastIndex++;

    if (performance.now() - chunkStart > BUDGET_MS) {
      onTick(matcher.lastIndex, textLen);
      await yieldToEventLoop();
      if (signal.aborted) return out;
      chunkStart = performance.now();
    }
  }

  onTick(textLen, textLen);
  return out;
}

async function scanRowAsync(
  row: InspectorRow,
  matcher: RegExp,
  cap: number,
  signal: AbortSignal,
  onSection: (section: string, scanned: number, total: number) => void,
): Promise<SearchGroup | null> {
  const sections = buildSearchableText(row);
  const allMatches: SearchMatch[] = [];

  for (const { text, section } of sections) {
    if (signal.aborted) return null;
    if (allMatches.length >= cap) break;
    if (!text) continue;

    const remaining = cap - allMatches.length;
    const matches = await scanSectionAsync(text, section, matcher, remaining, signal, (scanned, total) => {
      onSection(section, scanned, total);
    });
    for (const m of matches) allMatches.push(m);
  }

  if (allMatches.length === 0) return null;
  const lc = row.lifecycle;
  const { filename, origin } = extractFilename(lc.url);
  return {
    entryId: lc.requestId,
    displayId: row.displayId,
    filename,
    origin,
    timestamp: lc.startedAtMs,
    matches: allMatches,
  };
}

/**
 * Sync single-row scan — kept as a public export for tests. The live
 * panel path goes through `runSearch` which uses the async scanner.
 */
export function scanEntry(row: InspectorRow, query: string, config: FilterConfig): SearchGroup | null {
  const matcher = compileMatcher(query, config);
  if (!matcher) return null;
  const sections = buildSearchableText(row);
  const allMatches: SearchMatch[] = [];

  for (const { text, section } of sections) {
    if (allMatches.length >= MAX_MATCHES_PER_ENTRY) break;
    if (!text) continue;

    const textLen = text.length;
    let line = 1;
    let lineStart = 0;
    let nextNewline = text.indexOf('\n');
    let sectionIndex = 0;
    matcher.lastIndex = 0;

    let m: RegExpExecArray | null = matcher.exec(text);
    while (m !== null && allMatches.length < MAX_MATCHES_PER_ENTRY) {
      const pos = m.index;
      while (nextNewline !== -1 && nextNewline < pos) {
        line++;
        lineStart = nextNewline + 1;
        nextNewline = text.indexOf('\n', lineStart);
      }
      const lineEnd = nextNewline === -1 ? textLen : nextNewline;
      const displayStart = Math.max(lineStart, pos - LINE_CTX_BEFORE);
      const displayEnd = Math.min(lineEnd, displayStart + LINE_TEXT_CAP);
      allMatches.push({
        lineNumber: line,
        column: pos - lineStart + 1,
        lineText: text.slice(displayStart, displayEnd),
        section,
        sectionIndex: sectionIndex++,
      });
      if (m.index === matcher.lastIndex) matcher.lastIndex++;
      m = matcher.exec(text);
    }
  }

  if (allMatches.length === 0) return null;
  const lc = row.lifecycle;
  const { filename, origin } = extractFilename(lc.url);
  return {
    entryId: lc.requestId,
    displayId: row.displayId,
    filename,
    origin,
    timestamp: lc.startedAtMs,
    matches: allMatches,
  };
}

export interface SearchCallbacks {
  onGroup: (group: SearchGroup) => void;
  onProgress: (progress: SearchProgress) => void;
  onDone: (progress: SearchProgress) => void;
}

/**
 * Run a search across `rows`. Results stream via `onGroup`; progress
 * reports at every yield boundary (up to ~125 Hz); `onDone` fires once
 * the scan completes. If `signal.aborted`, the scan stops promptly and
 * no terminal callback fires.
 */
export async function runSearch(
  rows: readonly InspectorRow[],
  query: string,
  config: FilterConfig,
  signal: AbortSignal,
  callbacks: SearchCallbacks,
): Promise<void> {
  const start = performance.now();
  const total = rows.length;
  const matcher = compileMatcher(query, config);

  if (!matcher) {
    callbacks.onDone({ done: 0, total, elapsedMs: 0 });
    return;
  }

  let done = 0;
  let currentDisplayId: number | null = null;
  let currentSection: string | null = null;
  let sectionScanned: number | null = null;
  let sectionTotal: number | null = null;

  const reportProgress = () => {
    callbacks.onProgress({
      done,
      total,
      elapsedMs: performance.now() - start,
      currentDisplayId,
      currentSection,
      sectionScanned,
      sectionTotal,
    });
  };

  for (const row of rows) {
    if (signal.aborted) return;

    currentDisplayId = row.displayId;
    currentSection = null;
    sectionScanned = null;
    sectionTotal = null;
    reportProgress();

    const group = await scanRowAsync(row, matcher, MAX_MATCHES_PER_ENTRY, signal, (section, scanned, total) => {
      currentSection = section;
      sectionScanned = scanned;
      sectionTotal = total;
      reportProgress();
    });
    if (signal.aborted) return;
    if (group) callbacks.onGroup(group);
    done++;

    currentDisplayId = null;
    currentSection = null;
    sectionScanned = null;
    sectionTotal = null;
    reportProgress();
  }

  callbacks.onDone({ done, total, elapsedMs: performance.now() - start });
}
