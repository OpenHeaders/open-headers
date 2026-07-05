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
  { key: 'length', label: 'Length', defaultWidth: 64, minWidth: 44 },
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

/**
 * The grid-template shared by the header row and every frame row. A
 * user-dragged column becomes a fixed pixel track; otherwise the Data
 * column stretches and Length / Time hold their defaults.
 */
export function wsGridTemplate(widths: Partial<Record<WsColumnKey, number>>): string {
  const tracks = WS_COLUMNS.map((c) => {
    const override = widths[c.key];
    if (override != null) return `${override}px`;
    return c.stretch ? `minmax(${c.defaultWidth}px, 1fr)` : `${c.defaultWidth}px`;
  });
  return `${WS_FIRE_RAIL_PX}px ${WS_DIR_RAIL_PX}px ${tracks.join(' ')}`;
}
