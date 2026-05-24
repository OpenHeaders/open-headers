/**
 * HAR export — compose a valid HAR 1.2 document from the panel's
 * `InspectorRequest[]` snapshot. The panel stashes the full HAR entry
 * captured by the host's network inspector on each request, so export is
 * mostly a matter of wrapping the entry list in the standard HAR
 * envelope. No field remapping — the host's own HAR shape is canonical.
 *
 * Page grouping (`log.pages[]` + per-entry `pageref`) is derived from
 * the store's `PageTracker`. The envelope only emits pages that are
 * actually referenced by the entries in the export — the Raw Data
 * tab's single-entry export shouldn't carry the full page list of the
 * recording.
 */

import type { InspectorHarEntry } from '@openheaders/core/types';
import { getBuildInfo } from '@openheaders/ui/shared/build-info';
import { type HarPage, type InspectorPage, projectPagesForRefs } from './pages';
import type { InspectorRequest } from './types';

function getCreatorVersion(): string {
  return getBuildInfo().version;
}

/**
 * Minimal shape of a HAR 1.2 document — only the fields the panel
 * emits. Entries carry an optional `pageref` so HAR consumers can
 * group them back into navigations.
 */
export interface HarDocument {
  log: {
    version: '1.2';
    creator: { name: string; version: string };
    pages: HarPage[];
    entries: InspectorHarEntry[];
  };
}

/** Entry input for builders that don't have the full `InspectorRequest`
 *  wrapper (e.g. Raw Data tab single-entry export). */
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

export function buildHar(entries: readonly InspectorRequest[], pages: readonly InspectorPage[] = []): HarDocument {
  const refs = collectRefs(entries);
  return {
    log: {
      version: '1.2',
      creator: { name: 'Open Headers DevTools', version: getCreatorVersion() },
      pages: projectPagesForRefs(pages, refs),
      entries: entries.map((e) => withPageref(e.harEntry, e.pageref)),
    },
  };
}

/**
 * Same envelope as `buildHar`, but takes raw `HarEntryInput[]`. Used
 * by the Raw Data tab which only has access to a single entry, not the
 * surrounding `InspectorRequest` wrapper. Keeps creator name / version
 * / pages shape in lockstep with the "Copy all as HAR" export.
 */
export function buildHarFromEntries(
  entries: readonly HarEntryInput[],
  pages: readonly InspectorPage[] = [],
): HarDocument {
  const refs = collectRefs(entries);
  return {
    log: {
      version: '1.2',
      creator: { name: 'Open Headers DevTools', version: getCreatorVersion() },
      pages: projectPagesForRefs(pages, refs),
      entries: entries.map((e) => withPageref(e.harEntry, e.pageref)),
    },
  };
}

export function serializeHar(
  entries: readonly InspectorRequest[],
  pages: readonly InspectorPage[] = [],
): string {
  return JSON.stringify(buildHar(entries, pages), null, 2);
}

/**
 * Produce a filename matching DevTools' export convention:
 *   <host>-YYYY-MM-DDTHH-MM-SS.har
 * Falls back to `network` when no entries are available to infer host from.
 */
export function suggestHarFilename(entries: readonly InspectorRequest[]): string {
  let host = 'network';
  for (const e of entries) {
    try {
      host = new URL(e.url).hostname || host;
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
