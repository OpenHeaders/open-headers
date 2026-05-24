/**
 * Project the panel's `InspectorPage[]` to the on-wire `HarPage[]`
 * shape, filtered to the subset of pages actually referenced by a
 * given entries set. Lets the HAR envelope builder emit only the pages
 * that contain entries — important for the Raw Data tab's single-entry
 * export, which shouldn't carry the full page list of the recording.
 */

import type { HarPage, InspectorPage } from './types';

export function projectPagesForRefs(
  pages: readonly InspectorPage[],
  refs: ReadonlySet<string>,
): HarPage[] {
  const out: HarPage[] = [];
  for (const p of pages) {
    if (!refs.has(p.id)) continue;
    out.push({
      startedDateTime: p.startedDateTime,
      id: p.id,
      title: p.title ?? '',
      pageTimings: { ...p.pageTimings },
    });
  }
  return out;
}
