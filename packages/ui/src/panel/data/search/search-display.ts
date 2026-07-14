/**
 * Search-results view model.
 *
 * The engine emits one `SearchMatch` per regex hit. A flat list of
 * matches is the wrong shape for the UI:
 *
 *   - Dense lines (e.g. `accept: image/avif, image/webp, image/apng…`
 *     with 7 "image" matches) would render as 7 near-identical rows.
 *   - Keyboard navigation needs a flat ordering across groups, which
 *     cuts across the engine's per-request grouping.
 *   - The "last ordinal equals total-matches" invariant — how the UI
 *     proves to the user that no matches are hidden — can't be
 *     expressed on the raw match array alone.
 *
 * `buildResultView` is the single transformation that turns
 * `SearchGroup[]` into render-ready data: coalesced per-line
 * {@link DisplayRow}s, grouped under each file, plus a flat pointer
 * list for arrow-key navigation. It's pure, deterministic, and
 * testable without React.
 */

import type { SearchGroup, SearchMatch } from './search-engine';

/**
 * A rendered row in the search results. When several adjacent matches
 * land on the same `(section, lineNumber)`, they collapse into one row
 * showing an ordinal range (`#832-#836`). Every match is still
 * represented by some row, so the last rendered ordinal always equals
 * the total match count.
 */
export interface DisplayRow {
  /** Global ordinal (1-based) of the first match this row covers. */
  firstOrdinal: number;
  /** Global ordinal of the last match this row covers — equal to
   *  `firstOrdinal` when the row represents a single match. */
  lastOrdinal: number;
  /** Number of underlying matches this row represents (>= 1). */
  count: number;
  section: string;
  lineNumber: number;
  /** Column of the FIRST match in the coalesced range. */
  column: number;
  /** `lineText` of the first match — sufficient context since every
   *  match in the range is on the same line. */
  lineText: string;
  /** Scroll-to target when the row is clicked — first occurrence in
   *  this section. */
  sectionIndex: number;
}

/** A render-ready bundle: one search group plus its coalesced rows. */
export interface DisplayGroup {
  group: SearchGroup;
  rows: DisplayRow[];
  /** Absolute index of this group's first display row in the flat
   *  rendered sequence. Consumers use it with per-row offset to
   *  compute the `data-global-index` attribute for keyboard nav. */
  firstFlatIndex: number;
}

/** A flat-index pointer back into `groups[i].rows[j]`. */
export interface FlatRowPointer {
  groupIndex: number;
  rowIndex: number;
}

/**
 * Everything the UI needs to render results. Derived in one pass so
 * `groups` and `flatRows` can't drift — they always describe the same
 * underlying data.
 */
export interface ResultView {
  groups: DisplayGroup[];
  flatRows: FlatRowPointer[];
  totalMatches: number;
  totalFiles: number;
}

/**
 * Coalesce adjacent matches that share `(section, lineNumber)`.
 * `ordinalStart` is 1-based; the cursor advances by 1 per underlying
 * match, not per produced row, so cross-group ordinals stay contiguous.
 */
function coalesceMatches(matches: readonly SearchMatch[], ordinalStart: number): DisplayRow[] {
  const rows: DisplayRow[] = [];
  let i = 0;
  let ordinal = ordinalStart;
  while (i < matches.length) {
    const first = matches[i];
    let j = i + 1;
    while (j < matches.length && matches[j].section === first.section && matches[j].lineNumber === first.lineNumber) {
      j++;
    }
    const count = j - i;
    rows.push({
      firstOrdinal: ordinal,
      lastOrdinal: ordinal + count - 1,
      count,
      section: first.section,
      lineNumber: first.lineNumber,
      column: first.column,
      lineText: first.lineText,
      sectionIndex: first.sectionIndex,
    });
    ordinal += count;
    i = j;
  }
  return rows;
}

/**
 * Row arrays memoized by group identity. Groups stream in append-only
 * during a run and their objects never mutate, so a group's coalesced
 * rows are stable across the re-builds each streamed batch triggers —
 * reusing the array lets `React.memo` skip re-rendering every group
 * that was already on screen. `ordinalStart` participates in the key
 * because ordinals are global: the same group at a different position
 * (a different run) coalesces to different ordinals.
 */
const rowsCache = new WeakMap<SearchGroup, { ordinalStart: number; rows: DisplayRow[] }>();

function coalescedRowsFor(group: SearchGroup, ordinalStart: number): DisplayRow[] {
  const hit = rowsCache.get(group);
  if (hit && hit.ordinalStart === ordinalStart) return hit.rows;
  const rows = coalesceMatches(group.matches, ordinalStart);
  rowsCache.set(group, { ordinalStart, rows });
  return rows;
}

/** Single-pass transformation from engine output to UI-render data. */
export function buildResultView(groups: readonly SearchGroup[]): ResultView {
  const out: DisplayGroup[] = [];
  const flatRows: FlatRowPointer[] = [];
  let ordinalCursor = 1;
  let flatCursor = 0;
  let totalMatches = 0;

  for (let g = 0; g < groups.length; g++) {
    const group = groups[g];
    const rows = coalescedRowsFor(group, ordinalCursor);
    out.push({ group, rows, firstFlatIndex: flatCursor });
    for (let r = 0; r < rows.length; r++) flatRows.push({ groupIndex: g, rowIndex: r });
    ordinalCursor += group.matches.length;
    flatCursor += rows.length;
    totalMatches += group.matches.length;
  }

  return { groups: out, flatRows, totalMatches, totalFiles: groups.length };
}
