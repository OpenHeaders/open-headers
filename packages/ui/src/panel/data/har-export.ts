/**
 * HAR export — compose a valid HAR 1.2 document from inspector rows.
 *
 * Each row carries a lifecycle whose `har` map holds one HAR shell per
 * redirect hop. The exporter walks every hop in order, attaches the
 * page reference resolved from the page-stream snapshot, and wraps the
 * flat entry list in the standard envelope. Pages are projected via
 * `pageToHar` (see `./page-to-har`) and filtered to those actually
 * referenced by exported entries — single-row exports don't carry the
 * full recording's page list.
 *
 * Skipped rows: any row whose only HAR shell is for an aborted
 * placeholder (no terminal phase, no real wire data). The check is
 * purely structural — if `lifecycle.har` is empty AND the phase is
 * `pending`, there's nothing to serialise.
 */

import type { Page } from '@openheaders/core/page-stream';
import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import type { InspectorHarEntry } from '@openheaders/core/types';
import { getBuildInfo } from '@openheaders/ui/shared/build-info';
import type { InspectorRowWithFires } from './inspector-row-projection';
import { resolvePageref } from './inspector-row-projection';
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

function collectRefs(entries: readonly { pageref?: string }[]): Set<string> {
  const refs = new Set<string>();
  for (const e of entries) if (e.pageref) refs.add(e.pageref);
  return refs;
}

/**
 * Walk every hop of a lifecycle's `har` map in ascending hop order,
 * stamping the resolved pageref onto each hop's entry. Hop 0 is the
 * original request; hop N is the request after the Nth redirect.
 */
function lifecycleHopEntries(lc: RequestLifecycle, pageref: string | null): InspectorHarEntry[] {
  if (lc.har.size === 0) return [];
  const ref = pageref ?? undefined;
  const sortedHops = [...lc.har.keys()].sort((a, b) => a - b);
  return sortedHops.map((hop) => withPageref(lc.har.get(hop) as InspectorHarEntry, ref));
}

export function buildHar(
  rows: readonly InspectorRowWithFires[],
  pages: readonly Page[] = [],
): HarDocument {
  const entries: InspectorHarEntry[] = [];
  const refs = new Set<string>();
  for (const row of rows) {
    const lc = row.lifecycle;
    // Skip rows with no HAR shell at all (pure pending / blocked-
    // before-headers placeholders). Nothing to serialise.
    if (lc.har.size === 0) continue;
    const pageref = resolvePageref(lc, pages);
    if (pageref) refs.add(pageref);
    for (const entry of lifecycleHopEntries(lc, pageref)) entries.push(entry);
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
): HarDocument {
  const refs = collectRefs(entries);
  return {
    log: {
      version: '1.2',
      creator: { name: 'Open Headers DevTools', version: getCreatorVersion() },
      pages: projectInputPages(pages, refs),
      entries: entries.map((e) => withPageref(e.harEntry, e.pageref)),
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

export function serializeHar(rows: readonly InspectorRowWithFires[], pages: readonly Page[] = []): string {
  return JSON.stringify(buildHar(rows, pages), null, 2);
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
