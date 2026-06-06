/**
 * HAR export — compose a valid HAR 1.2 document from inspector rows.
 *
 * Each row is one HAR entry: its lifecycle's current hop
 * (`currentHarEntry`). Redirect chains are already un-folded into per-hop
 * rows upstream (`buildInspectorRows` → `redirect-hop-rows.ts`), so the
 * panel and the export share one row list and one expansion — a redirect
 * leg is its own row, hence its own entry, with no double-counting. The
 * exporter attaches the page reference resolved from the page-stream
 * snapshot and wraps the flat entry list in the standard envelope. Pages
 * are projected via `pageToHar` (see `./page-to-har`) and filtered to those
 * actually referenced by exported entries — single-row exports don't carry
 * the full recording's page list.
 *
 * Skipped rows: any row with no landed HAR shell for its current hop (a
 * pending / blocked-before-headers placeholder). Nothing to serialise.
 */

import type { Page } from '@openheaders/core/page-stream';
import type { InspectorHarEntry } from '@openheaders/core/types';
import { getBuildInfo } from '@openheaders/ui/shared/build-info';
import type { InspectorRowWithFires } from './inspector-row-projection';
import { currentHarEntry, resolvePageref } from './inspector-row-projection';
import { type HarPage, pagesToHarForRefs, pageToHar } from './page-to-har';

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

function collectRefs(entries: readonly { pageref?: string }[]): Set<string> {
  const refs = new Set<string>();
  for (const e of entries) if (e.pageref) refs.add(e.pageref);
  return refs;
}

export function buildHar(
  rows: readonly InspectorRowWithFires[],
  pages: readonly Page[] = [],
  sanitize = false,
): HarDocument {
  const entries: InspectorHarEntry[] = [];
  const refs = new Set<string>();
  for (const row of rows) {
    const lc = row.lifecycle;
    // One entry per row: the lifecycle's current hop. Redirect legs are
    // their own rows upstream, so each contributes its own entry exactly
    // once. Skip rows whose current hop has no HAR shell (pending /
    // blocked-before-headers placeholders) — nothing to serialise.
    const entry = currentHarEntry(lc);
    if (entry === null) continue;
    const pageref = resolvePageref(lc, pages);
    if (pageref) refs.add(pageref);
    entries.push(withPageref(sanitize ? sanitizeHarEntry(entry) : entry, pageref ?? undefined));
  }
  return {
    log: {
      version: '1.2',
      creator: { name: 'Open Headers DevTools', version: getCreatorVersion() },
      pages: pagesToHarForRefs(pages, refs),
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
): HarDocument {
  const refs = collectRefs(entries);
  return {
    log: {
      version: '1.2',
      creator: { name: 'Open Headers DevTools', version: getCreatorVersion() },
      pages: projectInputPages(pages, refs),
      entries: entries.map((e) => withPageref(sanitize ? sanitizeHarEntry(e.harEntry) : e.harEntry, e.pageref)),
    },
  };
}

function projectInputPages(pages: readonly Page[], refs: ReadonlySet<string>): HarPage[] {
  const out: HarPage[] = [];
  for (const page of pages) {
    if (!refs.has(page.id)) continue;
    out.push(pageToHar(page));
  }
  return out;
}

export function serializeHar(
  rows: readonly InspectorRowWithFires[],
  pages: readonly Page[] = [],
  sanitize = false,
): string {
  return JSON.stringify(buildHar(rows, pages, sanitize), null, 2);
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
