/**
 * HAR export — compose a valid HAR 1.2 document from the panel's
 * `InspectorRequest[]` snapshot. The panel stashes the full HAR entry
 * captured by the host's network inspector on each request, so export is
 * purely a matter of wrapping the entry list in the standard HAR
 * envelope. No field remapping — the host's own HAR shape is canonical.
 */

import type { InspectorHarEntry } from '@openheaders/core/types';
import { getBuildInfo } from '@openheaders/ui/shared/build-info';
import type { InspectorRequest } from './types';

function getCreatorVersion(): string {
  return getBuildInfo().version;
}

/**
 * Minimal shape of a HAR 1.2 document — only the fields the panel
 * emits. `pages` is always empty: the panel doesn't reconstruct page
 * boundaries, so consumers should treat this as a flat entries list.
 */
export interface HarDocument {
  log: {
    version: '1.2';
    creator: { name: string; version: string };
    pages: never[];
    entries: InspectorHarEntry[];
  };
}

export function buildHar(entries: readonly InspectorRequest[]): HarDocument {
  return {
    log: {
      version: '1.2',
      creator: { name: 'Open Headers DevTools', version: getCreatorVersion() },
      pages: [],
      entries: entries.map((e) => e.harEntry),
    },
  };
}

export function serializeHar(entries: readonly InspectorRequest[]): string {
  return JSON.stringify(buildHar(entries), null, 2);
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
