/**
 * Resolves a list of generated call-frame positions to their original
 * source-map position via the source-map cache.
 *
 * Returns a `Map<frameKey, ResolvedFramePosition>`. The resolution is
 * partial by design — webpack-style maps usually attach `names` only to
 * function-boundary segments, so an arbitrary column inside a function
 * body resolves to a source/line/column without a name. The view shows
 * whatever is available (name when present, otherwise resolved file +
 * original line — same fallback Chrome's panel uses for
 * `(anonymous) @ load_script:64`).
 *
 * When pending fetches resolve, the cache's listener layer triggers a
 * re-render and the map fills out.
 */

import { useEffect, useReducer } from 'react';
import type { CallFrameLike } from './call-frame-meta';
import { lookupOriginalPosition } from './source-map';
import { getSourceMap, subscribeSourceMaps } from './source-map-cache';

/** Stable join key for a frame. */
export function frameKey(frame: CallFrameLike): string {
  return `${frame.url ?? ''}|${frame.lineNumber ?? -1}|${frame.columnNumber ?? -1}`;
}

/** Last path segment of a source-map source, extension kept
 *  (`webpack:///./src/hydro-analytics.ts` → `hydro-analytics.ts`) — the
 *  browser's console/Initiator-column label for a resolved position. */
export function sourceFileLabel(source: string): string {
  const stripped = source.replace(/^[^:]+:\/+/, '');
  const parts = stripped.split('/').filter(Boolean);
  return parts[parts.length - 1] ?? stripped;
}

export interface ResolvedFramePosition {
  /** Original function/identifier name from the source-map `names` array. */
  name: string | null;
  /** Original source URL/path (e.g. `webpack:///./src/runtime/load_script.js`). */
  source: string | null;
  /** Original line (0-indexed). */
  line: number | null;
  /** Original column (0-indexed). */
  column: number | null;
}

export function useResolvedFrames(frames: readonly CallFrameLike[]): ReadonlyMap<string, ResolvedFramePosition> {
  // Subscribe to cache updates — when a pending fetch resolves we
  // force a re-render so the lookup below picks up the new map.
  const [, force] = useReducer((n: number) => n + 1, 0);
  useEffect(() => subscribeSourceMaps(force), [force]);

  const out = new Map<string, ResolvedFramePosition>();
  for (const f of frames) {
    if (!f.url || f.lineNumber == null) continue;
    const map = getSourceMap(f.url);
    if (!map) continue;
    const pos = lookupOriginalPosition(map, f.lineNumber, f.columnNumber ?? 0);
    if (!pos) continue;
    // Only record positions that gave us SOMETHING useful — at least a
    // name or a source. A bare segment (genCol only) is no improvement
    // over the V8 frame.
    if (!pos.name && !pos.source) continue;
    out.set(frameKey(f), {
      name: pos.name,
      source: pos.source,
      line: pos.line,
      column: pos.column,
    });
  }
  return out;
}
