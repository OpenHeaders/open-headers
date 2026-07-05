/**
 * Messages grid column model — the Data | Length | Time tracks behind
 * the WebSocket frame grid, plus the direction rail. Mirrors the
 * traffic table's `columns.ts` in miniature: per-column defaults and
 * resize floors, and a track resolver that turns user width overrides
 * into the grid-template the header and every row share.
 */

export type WsColumnKey = 'data' | 'length' | 'time';

export interface WsColumnDef {
  key: WsColumnKey;
  label: string;
  /** Fixed default track (px); `stretch` columns default to a 1fr track. */
  defaultWidth: number;
  /** Hard floor for user resizing. */
  minWidth: number;
  stretch?: boolean;
}

export const WS_COLUMNS: readonly WsColumnDef[] = [
  { key: 'data', label: 'Data', defaultWidth: 140, minWidth: 100, stretch: true },
  // Wide enough that the "Length" label never ellipsizes — the header
  // cell reserves a lane for the hover (i) beside the label.
  { key: 'length', label: 'Length', defaultWidth: 84, minWidth: 64 },
  { key: 'time', label: 'Time', defaultWidth: 92, minWidth: 64 },
];

export function wsColumnMinWidth(key: WsColumnKey): number {
  const def = WS_COLUMNS.find((c) => c.key === key);
  return def ? def.minWidth : 40;
}

/** Width of the leading fire-dot rail (same track as the traffic table's). */
export const WS_FIRE_RAIL_PX = 14;

/** Width of the direction rail (arrow glyphs). */
export const WS_DIR_RAIL_PX = 20;

/** View-menu layout for the grid — same vocabulary as the traffic
 * table's `devpanelNetwork.layout` (and the shared setting schema). */
export type WsGridLayout = 'compact' | 'wide';

/**
 * The grid-template shared by the header row and every frame row. A
 * user-dragged column becomes a fixed pixel track; otherwise the
 * tracks mirror the traffic table's `columnTrack` per layout —
 * `compact` fits every column inside the pane width (fixed columns
 * shrink to their floors, Data absorbs the slack, never a horizontal
 * scroll); `wide` holds the defaults and caps Data at 3× so the grid
 * scrolls horizontally when the pane runs out.
 */
export function wsGridTemplate(widths: Partial<Record<WsColumnKey, number>>, layout: WsGridLayout): string {
  const tracks = WS_COLUMNS.map((c) => {
    const override = widths[c.key];
    if (override != null) return `${override}px`;
    if (layout === 'compact') {
      return c.stretch ? `minmax(${c.minWidth}px, 1fr)` : `minmax(${c.minWidth}px, ${c.defaultWidth}px)`;
    }
    return c.stretch ? `minmax(${c.defaultWidth}px, ${c.defaultWidth * 3}px)` : `${c.defaultWidth}px`;
  });
  return `${WS_FIRE_RAIL_PX}px ${WS_DIR_RAIL_PX}px ${tracks.join(' ')}`;
}
