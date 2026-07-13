/**
 * The panel row grids' shared keyboard walk — one clamp/start computation
 * for every grid that arrows a selection through its display order
 * (streams, the traffic table, the storage grid). Extracted at the third
 * implementation; the per-grid wiring (what "select" means, how the row
 * is revealed, when the handler stands down) stays local to each grid.
 *
 * Returns the next position in the list, or `null` when the key is not a
 * navigation key (or the list is empty) — the caller treats `null` as
 * unhandled and lets the event through. A clamped end returns the current
 * position; callers that shouldn't re-select compare against `pos`.
 *
 * `pos` is the current position, `-1` for no selection: down-going keys
 * then start at the first row, up-going at the last (streams-grid
 * semantics). `pageRows` is the caller's viewport row count for the Page
 * keys; pass `null` where a page size has no cheap answer (rows not
 * pinned-height) — the Page keys then read as unhandled.
 */
export function walkListSelection(count: number, pos: number, key: string, pageRows: number | null): number | null {
  if (count === 0) return null;
  const last = count - 1;
  switch (key) {
    case 'ArrowDown':
      return pos < 0 ? 0 : Math.min(last, pos + 1);
    case 'ArrowUp':
      return pos < 0 ? last : Math.max(0, pos - 1);
    case 'PageDown':
      return pageRows === null ? null : pos < 0 ? 0 : Math.min(last, pos + pageRows);
    case 'PageUp':
      return pageRows === null ? null : pos < 0 ? last : Math.max(0, pos - pageRows);
    case 'Home':
      return 0;
    case 'End':
      return last;
    default:
      return null;
  }
}
