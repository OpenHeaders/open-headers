/**
 * Time-sliced, cancellable full-text search across searchable docs.
 *
 * ## Algorithm (host-DevTools-equivalent)
 *
 * The query compiles to a single native `RegExp` (with the `g` flag so
 * `exec` walks the string; `i` when case-insensitive). For each section
 * of each doc we call `regex.exec(text)` in a tight loop — V8's
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
 * (`workers/search.worker.ts`) over the worker's synced doc cache —
 * the docs are flat strings, projected main-thread-side (see
 * `network-search-docs.ts`). That alone guarantees the panel's main
 * thread is never blocked by search work.
 *
 * Even inside the worker we time-slice: the scan loop checks elapsed
 * time after each match and yields (`scheduler.yield()` if available,
 * `MessageChannel` fallback) when `BUDGET_MS` is exceeded.
 *
 * Progress reports `current` + `currentSection` +
 * `sectionScanned/sectionTotal` so the UI can render
 * `Searching #42 (Response) 45%` ticking up, not a frozen label.
 *
 * This module is isomorphic: it imports nothing worker-specific and
 * runs identically in the main thread (used by the inline-transport
 * fallback in non-browser test environments — see `search-transport`).
 */

import type { TextMatchConfig } from '../text-match';
import type { SearchDoc, SearchSourceKind, SearchTarget } from './search-doc';

export { SECTION, type SectionName, sectionHasLineColumn } from './search-doc';

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
  /** Stable identity of the matched document. */
  docId: string;
  source: SearchSourceKind;
  /** What to open when a match in this group is activated. */
  target: SearchTarget;
  /** Network row number; `null` for non-network documents. */
  displayId: number | null;
  filename: string;
  origin: string;
  /** Wall-clock ms at which the document's subject started. */
  timestamp: number;
  matches: SearchMatch[];
}

export interface SearchProgress {
  done: number;
  total: number;
  elapsedMs: number;
  /** Label of the doc the scanner is currently inside (`#42` for a
   *  network row, the filename otherwise), or null between docs. */
  current?: string | null;
  /** Section of the current doc being scanned (e.g. "Response"). */
  currentSection?: string | null;
  /** Byte-level progress within the current section. */
  sectionScanned?: number | null;
  sectionTotal?: number | null;
  /** True when the scan stopped at the global match cap — more matches
   *  exist than were streamed. */
  truncated?: boolean;
}

/** Max synchronous work between yields. */
const BUDGET_MS = 8;
/** Hard cap on matches per doc — prevents 1 doc from owning the whole scan. */
const MAX_MATCHES_PER_ENTRY = 500;
/** Global cap across the whole run — a pathological query ("e" over a
 *  huge capture) stops streaming here and reports `truncated`. */
const MAX_TOTAL_MATCHES = 10_000;
/** Display-cap for match line text — avoids shipping a full megabyte line to the UI. */
const LINE_TEXT_CAP = 400;
/** Context window before the match inside `lineText`. */
const LINE_CTX_BEFORE = Math.floor(LINE_TEXT_CAP / 4);

const REGEX_ESCAPE = /[.*+?^${}()|[\]\\]/g;

/**
 * Compile the user's query into a native RegExp with the `g` flag set
 * (mandatory — `exec` otherwise loops forever on the first match).
 * Returns `null` for invalid regex or empty query.
 */
export function compileMatcher(query: string, config: TextMatchConfig): RegExp | null {
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
export function lineMatches(line: string, query: string, config: TextMatchConfig): boolean {
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

async function scanDocAsync(
  doc: SearchDoc,
  matcher: RegExp,
  cap: number,
  signal: AbortSignal,
  onSection: (section: string, scanned: number, total: number) => void,
): Promise<SearchGroup | null> {
  const allMatches: SearchMatch[] = [];

  for (const { text, name } of doc.sections) {
    if (signal.aborted) return null;
    if (allMatches.length >= cap) break;
    if (!text) continue;

    const remaining = cap - allMatches.length;
    const matches = await scanSectionAsync(text, name, matcher, remaining, signal, (scanned, total) => {
      onSection(name, scanned, total);
    });
    for (const m of matches) allMatches.push(m);
  }

  if (allMatches.length === 0) return null;
  return {
    docId: doc.docId,
    source: doc.source,
    target: doc.target,
    displayId: doc.displayId,
    filename: doc.filename,
    origin: doc.origin,
    timestamp: doc.timestamp,
    matches: allMatches,
  };
}

/**
 * Sync single-doc scan — kept as a public export for tests. The live
 * panel path goes through `runSearch` which uses the async scanner.
 */
export function scanDoc(doc: SearchDoc, query: string, config: TextMatchConfig): SearchGroup | null {
  const matcher = compileMatcher(query, config);
  if (!matcher) return null;
  const allMatches: SearchMatch[] = [];

  for (const { text, name } of doc.sections) {
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
        section: name,
        sectionIndex: sectionIndex++,
      });
      if (m.index === matcher.lastIndex) matcher.lastIndex++;
      m = matcher.exec(text);
    }
  }

  if (allMatches.length === 0) return null;
  return {
    docId: doc.docId,
    source: doc.source,
    target: doc.target,
    displayId: doc.displayId,
    filename: doc.filename,
    origin: doc.origin,
    timestamp: doc.timestamp,
    matches: allMatches,
  };
}

export interface SearchCallbacks {
  onGroup: (group: SearchGroup) => void;
  onProgress: (progress: SearchProgress) => void;
  onDone: (progress: SearchProgress) => void;
}

function docLabel(doc: SearchDoc): string {
  return doc.displayId != null ? `#${doc.displayId}` : doc.filename;
}

/**
 * Run a search across `docs`. Results stream via `onGroup`; progress
 * reports at every yield boundary (up to ~125 Hz); `onDone` fires once
 * the scan completes. If `signal.aborted`, the scan stops promptly and
 * no terminal callback fires. The run stops early — `truncated` set on
 * the final progress — once `MAX_TOTAL_MATCHES` have streamed.
 */
export async function runSearch(
  docs: readonly SearchDoc[],
  query: string,
  config: TextMatchConfig,
  signal: AbortSignal,
  callbacks: SearchCallbacks,
): Promise<void> {
  const start = performance.now();
  const total = docs.length;
  const matcher = compileMatcher(query, config);

  if (!matcher) {
    callbacks.onDone({ done: 0, total, elapsedMs: 0 });
    return;
  }

  let done = 0;
  let totalMatches = 0;
  let truncated = false;
  let current: string | null = null;
  let currentSection: string | null = null;
  let sectionScanned: number | null = null;
  let sectionTotal: number | null = null;

  const reportProgress = () => {
    callbacks.onProgress({
      done,
      total,
      elapsedMs: performance.now() - start,
      current,
      currentSection,
      sectionScanned,
      sectionTotal,
    });
  };

  for (const doc of docs) {
    if (signal.aborted) return;
    if (totalMatches >= MAX_TOTAL_MATCHES) {
      truncated = true;
      break;
    }

    current = docLabel(doc);
    currentSection = null;
    sectionScanned = null;
    sectionTotal = null;
    reportProgress();

    const remaining = Math.min(MAX_MATCHES_PER_ENTRY, MAX_TOTAL_MATCHES - totalMatches);
    const group = await scanDocAsync(doc, matcher, remaining, signal, (section, scanned, total) => {
      currentSection = section;
      sectionScanned = scanned;
      sectionTotal = total;
      reportProgress();
    });
    if (signal.aborted) return;
    if (group) {
      totalMatches += group.matches.length;
      callbacks.onGroup(group);
    }
    done++;

    current = null;
    currentSection = null;
    sectionScanned = null;
    sectionTotal = null;
    reportProgress();
  }

  callbacks.onDone({ done, total, elapsedMs: performance.now() - start, ...(truncated ? { truncated } : {}) });
}
