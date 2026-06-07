/**
 * HAR export — compose a valid HAR 1.2 document from inspector rows.
 *
 * Two modes share one envelope:
 *
 *   - **CDP mode (host-authoritative).** The host's own `getHAR()` is the
 *     complete byte-exact record of every request it saw — entries, field
 *     order, page binding (`pageref`), entry order, and `log.pages`. The
 *     export adopts that record verbatim (`buildHostAuthoritativeEntries` +
 *     host pages in `pagesToHarForRefs`); rows the host never saw
 *     (OOPIF/worker) keep their CDP-synthesized entry and are appended. This
 *     is what makes the export 1:1 with Chrome.
 *   - **Heuristic mode.** No host HAR to adopt: each row is one HAR entry —
 *     its lifecycle's current hop (`currentHarEntry`) — ordered by issue time
 *     with our own {@link resolvePageref} page binding and `pageToHar`
 *     projection.
 *
 * Redirect chains are already un-folded into per-hop rows upstream
 * (`buildInspectorRows` → `redirect-hop-rows.ts`), so the panel and the export
 * share one row list — a redirect leg is its own row, hence its own entry,
 * with no double-counting. Pages are filtered to those actually referenced by
 * exported entries — single-row exports don't carry the full recording's page
 * list. Skipped rows: any row with no landed HAR shell for its current hop (a
 * pending / blocked-before-headers placeholder). Nothing to serialise.
 */

import type { Page } from '@openheaders/core/page-stream';
import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import type { InspectorHarEntry, InspectorHarLog } from '@openheaders/core/types';
import { getBuildInfo } from '@openheaders/ui/shared/build-info';
import type { InspectorRowWithFires } from './inspector-row-projection';
import { currentHarEntry, resolvePageref } from './inspector-row-projection';
import { selectMainDocByPage } from './page-anchor';
import { type HarPage, pagesToHarForRefs } from './page-to-har';

function getCreatorVersion(): string {
  return getBuildInfo().version;
}

/**
 * Minimal shape of a HAR 1.2 document. Entries carry an optional
 * `pageref` so HAR consumers can group them back into navigations.
 */
export interface HarDocument {
  log: {
    version: '1.2';
    creator: { name: string; version: string };
    pages: HarPage[];
    entries: InspectorHarEntry[];
  };
}

/** Single raw HAR entry + page reference, for the Raw Data tab's
 *  single-row export which doesn't have the wrapping row. */
export interface HarEntryInput {
  harEntry: InspectorHarEntry;
  pageref?: string;
}

function withPageref(har: InspectorHarEntry, pageref: string | undefined): InspectorHarEntry {
  return pageref ? { ...har, pageref } : har;
}

/** Request headers dropped when sanitizing (carry credentials). */
const SANITIZED_REQUEST_HEADERS = new Set(['authorization', 'cookie']);
/** Response headers dropped when sanitizing (set credentials). */
const SANITIZED_RESPONSE_HEADERS = new Set(['set-cookie']);

/**
 * Strip credential-bearing data from a HAR entry for a sanitized export —
 * the same redaction the host applies (empty request/response `cookies`,
 * drop `cookie`/`authorization` request headers and `set-cookie` response
 * headers). Returns a shallow copy; the source entry is untouched.
 */
export function sanitizeHarEntry(entry: InspectorHarEntry): InspectorHarEntry {
  const dropHeaders = (headers: ReadonlyArray<{ name: string; value: string }>, drop: ReadonlySet<string>) =>
    headers.filter((h) => !drop.has(h.name.toLowerCase()));
  const out: InspectorHarEntry = { ...entry };
  if (entry.request) {
    out.request = {
      ...entry.request,
      cookies: [],
      headers: dropHeaders(entry.request.headers, SANITIZED_REQUEST_HEADERS),
    };
  }
  if (entry.response) {
    out.response = {
      ...entry.response,
      cookies: [],
      headers: dropHeaders(entry.response.headers, SANITIZED_RESPONSE_HEADERS),
    };
  }
  return out;
}

/**
 * Sort key for export entry order: the row's current HAR hop `startedDateTime`
 * parsed to ms (the host's authoritative issue instant). Rows with no landed
 * HAR shell are skipped from the output anyway; they fall back to the
 * lifecycle's own start so the comparator stays total.
 */
function rowEntryStartMs(row: InspectorRowWithFires): number {
  const entry = currentHarEntry(row.lifecycle);
  const parsed = entry ? Date.parse(entry.startedDateTime) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : row.lifecycle.startedAtMs;
}

function collectRefs(entries: readonly { pageref?: string }[]): Set<string> {
  const refs = new Set<string>();
  for (const e of entries) if (e.pageref) refs.add(e.pageref);
  return refs;
}

/**
 * Host-authoritative reconciliation (CDP mode). The host's own
 * `chrome.devtools.network` HAR is byte-identical to what its "Save all as
 * HAR" writes; our CDP synthesis is a faithful reconstruction but cannot
 * reproduce every field the host emits — request-header *order* most
 * visibly, because `chrome.debugger` delivers CDP header objects key-sorted
 * (a `base::Value::Dict`), destroying the on-the-wire order the host keeps.
 *
 * When the panel can read the host HAR (it runs as a DevTools panel page),
 * each exported row is matched to its host entry and the host entry is used
 * verbatim — byte parity for every request the host saw. Rows with no host
 * match (out-of-process iframes / workers the `chrome.devtools.network` feed
 * never sees) keep their CDP-synthesized entry, so CDP's wider coverage is
 * preserved. Host and CDP observe the *same* live session, so the join is
 * tight: same `(method, url)` and a `startedDateTime` that shares a base
 * `wallTime` (sub-ms apart at worst).
 */
const STARTED_MATCH_TOLERANCE_MS = 50;

interface HostEntrySlot {
  readonly entry: InspectorHarEntry;
  readonly startedMs: number;
  consumed: boolean;
}

/**
 * Build a one-shot matcher over the host HAR entries. `match` returns the
 * closest unconsumed host entry sharing the row's `(method, url)` within
 * {@link STARTED_MATCH_TOLERANCE_MS}, consuming it so repeated beacons to the
 * same URL each pair to a distinct host entry. `undefined` when the host
 * never saw this request (an OOPIF/worker row keeps its CDP entry).
 */
export function createHostEntryMatcher(
  hostEntries: readonly InspectorHarEntry[],
): (method: string, url: string, startedMs: number) => InspectorHarEntry | undefined {
  const byKey = new Map<string, HostEntrySlot[]>();
  for (const entry of hostEntries) {
    const req = entry.request;
    if (!req) continue;
    const key = hostMatchKey(req.method, req.url);
    const slot: HostEntrySlot = { entry, startedMs: Date.parse(entry.startedDateTime), consumed: false };
    const list = byKey.get(key);
    if (list) list.push(slot);
    else byKey.set(key, [slot]);
  }
  return (method, url, startedMs) => {
    const list = byKey.get(hostMatchKey(method, url));
    if (list === undefined) return undefined;
    let best: HostEntrySlot | undefined;
    let bestDelta = Number.POSITIVE_INFINITY;
    for (const slot of list) {
      if (slot.consumed) continue;
      const delta = Number.isFinite(slot.startedMs) ? Math.abs(slot.startedMs - startedMs) : Number.POSITIVE_INFINITY;
      if (delta < bestDelta) {
        best = slot;
        bestDelta = delta;
      }
    }
    if (best === undefined || bestDelta > STARTED_MATCH_TOLERANCE_MS) return undefined;
    best.consumed = true;
    return best.entry;
  };
}

/** Join key for host↔row reconciliation: method + fragment-stripped URL. */
function hostMatchKey(method: string, url: string): string {
  const hash = url.indexOf('#');
  return `${method}\n${hash < 0 ? url : url.slice(0, hash)}`;
}

/** A built entry list plus the set of page refs those entries carry. */
interface EntriesWithRefs {
  readonly entries: InspectorHarEntry[];
  readonly refs: ReadonlySet<string>;
}

/**
 * CDP-mode (host-authoritative) entry list. The host's own `getHAR()` is the
 * complete, byte-exact record of every request it saw — entries, on-the-wire
 * field order, page association (`pageref`), and the entry *order* itself. We
 * adopt that record wholesale: each exported row is matched to a host entry,
 * and the matched host entries are emitted **verbatim in the host's own
 * order**, keeping their host `pageref`. Rows the host never saw
 * (out-of-process iframes / workers, absent from the `chrome.devtools.network`
 * feed) keep their CDP-synthesized entry and are appended after the host block
 * — Chrome has no reference position for them, so issue order is the natural
 * choice. This is what makes the CDP export 1:1 with Chrome instead of three
 * heuristics (entry order, page order, page binding) each chasing it.
 */
function buildHostAuthoritativeEntries(
  rows: readonly InspectorRowWithFires[],
  pages: readonly Page[],
  sanitize: boolean,
  hostEntries: readonly InspectorHarEntry[],
): EntriesWithRefs {
  const matchHost = createHostEntryMatcher(hostEntries);
  const matchedHostEntries = new Set<InspectorHarEntry>();
  const synthOnlyRows: InspectorRowWithFires[] = [];
  for (const row of rows) {
    const synth = currentHarEntry(row.lifecycle);
    if (synth === null) continue;
    const host = synth.request
      ? matchHost(synth.request.method, synth.request.url, Date.parse(synth.startedDateTime))
      : undefined;
    if (host !== undefined) matchedHostEntries.add(host);
    else synthOnlyRows.push(row);
  }
  const entries: InspectorHarEntry[] = [];
  const refs = new Set<string>();
  // Matched host entries, verbatim, in the host's own array order — its
  // `getHAR()` order is the authoritative entry sequence (it groups by page
  // load, which our own issue-time sort can't reproduce across navigations).
  for (const hostEntry of hostEntries) {
    if (!matchedHostEntries.has(hostEntry)) continue;
    if (hostEntry.pageref) refs.add(hostEntry.pageref);
    entries.push(sanitize ? sanitizeHarEntry(hostEntry) : hostEntry);
  }
  // Synth-only augmentation (OOPIF/worker rows the host HAR never carried),
  // appended in issue order with our own heuristic page binding.
  const orderedSynth = [...synthOnlyRows].sort(
    (a, b) => rowEntryStartMs(a) - rowEntryStartMs(b) || a.displayId - b.displayId,
  );
  for (const row of orderedSynth) {
    const synth = currentHarEntry(row.lifecycle);
    if (synth === null) continue;
    const pageref = resolvePageref(row.lifecycle, pages);
    if (pageref) refs.add(pageref);
    entries.push(withPageref(sanitize ? sanitizeHarEntry(synth) : synth, pageref ?? undefined));
  }
  return { entries, refs };
}

/**
 * Heuristic-mode (CDP-synthesized) entry list — the path with no host HAR to
 * adopt (non-DevTools hosts, or a `getHAR()` that returned nothing). Each row
 * contributes its lifecycle's current hop, ordered by HAR `startedDateTime`
 * (issue order) with `displayId` (discovery rank) as the sub-ms tiebreak, and
 * the page binding comes from our own {@link resolvePageref} heuristic.
 */
function buildSynthEntries(
  rows: readonly InspectorRowWithFires[],
  pages: readonly Page[],
  sanitize: boolean,
): EntriesWithRefs {
  const entries: InspectorHarEntry[] = [];
  const refs = new Set<string>();
  const ordered = [...rows].sort((a, b) => rowEntryStartMs(a) - rowEntryStartMs(b) || a.displayId - b.displayId);
  for (const row of ordered) {
    // One entry per row: the lifecycle's current hop. Redirect legs are their
    // own rows upstream, so each contributes its own entry exactly once. Skip
    // rows whose current hop has no HAR shell (pending / blocked-before-headers
    // placeholders) — nothing to serialise.
    const synth = currentHarEntry(row.lifecycle);
    if (synth === null) continue;
    const pageref = resolvePageref(row.lifecycle, pages);
    if (pageref) refs.add(pageref);
    entries.push(withPageref(sanitize ? sanitizeHarEntry(synth) : synth, pageref ?? undefined));
  }
  return { entries, refs };
}

export function buildHar(
  rows: readonly InspectorRowWithFires[],
  pages: readonly Page[] = [],
  sanitize = false,
  docLifecycles?: readonly RequestLifecycle[],
  hostHar?: InspectorHarLog,
): HarDocument {
  // Resolve each page's main document from the full lifecycle list (not just
  // the exported subset — a single non-document export still needs its page's
  // document to anchor the block). Defaults to the exported rows' lifecycles.
  const docByPage = selectMainDocByPage(pages, docLifecycles ?? rows.map((r) => r.lifecycle));
  // CDP mode (host HAR present): adopt the host's entries, page binding, and
  // entry order wholesale; the page block likewise comes from the host's own
  // `log.pages`. Heuristic mode: CDP-synthesized entries + our page projection.
  const { entries, refs } =
    hostHar !== undefined
      ? buildHostAuthoritativeEntries(rows, pages, sanitize, hostHar.entries)
      : buildSynthEntries(rows, pages, sanitize);
  return {
    log: {
      version: '1.2',
      creator: { name: 'Open Headers DevTools', version: getCreatorVersion() },
      pages: pagesToHarForRefs(pages, refs, docByPage, hostHar?.pages),
      entries,
    },
  };
}

/**
 * Same envelope as `buildHar`, but takes raw `HarEntryInput[]`. Used by
 * the Raw Data tab which has access to a single entry (the row's
 * current hop). Keeps creator name / version / pages shape in lockstep
 * with the "Copy all as HAR" export.
 */
export function buildHarFromEntries(
  entries: readonly HarEntryInput[],
  pages: readonly Page[] = [],
  sanitize = false,
  docLifecycles: readonly RequestLifecycle[] = [],
): HarDocument {
  const refs = collectRefs(entries);
  const docByPage = selectMainDocByPage(pages, docLifecycles);
  return {
    log: {
      version: '1.2',
      creator: { name: 'Open Headers DevTools', version: getCreatorVersion() },
      pages: pagesToHarForRefs(pages, refs, docByPage),
      entries: entries.map((e) => withPageref(sanitize ? sanitizeHarEntry(e.harEntry) : e.harEntry, e.pageref)),
    },
  };
}

export function serializeHar(
  rows: readonly InspectorRowWithFires[],
  pages: readonly Page[] = [],
  sanitize = false,
  docLifecycles?: readonly RequestLifecycle[],
  hostHar?: InspectorHarLog,
): string {
  return JSON.stringify(buildHar(rows, pages, sanitize, docLifecycles, hostHar), null, 2);
}

/**
 * Produce a filename matching the host DevTools' export convention:
 *   <host>-YYYY-MM-DDTHH-MM-SS.har
 * Falls back to `network` when no entries are available to infer host.
 */
export function suggestHarFilename(rows: readonly InspectorRowWithFires[]): string {
  let host = 'network';
  for (const row of rows) {
    try {
      host = new URL(row.lifecycle.url).hostname || host;
      break;
    } catch {
      // Skip non-parseable urls (chrome-extension:// etc).
    }
  }
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp =
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
    `T${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  return `${host}-${stamp}.har`;
}
