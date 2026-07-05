/**
 * EventStream grid column model — the Id | Type | Data | Time tracks
 * behind the SSE event grid, plus the leading fire rail. Twin of
 * `ws-grid.ts` (there is no direction rail: server-sent events only
 * ever travel server → page).
 */

import type { WsGridLayout } from './ws-grid';

export type SseColumnKey = 'id' | 'type' | 'data' | 'time';

export interface SseColumnDef {
  key: SseColumnKey;
  label: string;
  /** Fixed default track (px); `stretch` columns default to a 1fr track. */
  defaultWidth: number;
  /** Hard floor for user resizing. */
  minWidth: number;
  stretch?: boolean;
}

export const SSE_COLUMNS: readonly SseColumnDef[] = [
  { key: 'id', label: 'Id', defaultWidth: 64, minWidth: 44 },
  { key: 'type', label: 'Type', defaultWidth: 96, minWidth: 64 },
  { key: 'data', label: 'Data', defaultWidth: 140, minWidth: 100, stretch: true },
  { key: 'time', label: 'Time', defaultWidth: 92, minWidth: 64 },
];

export function sseColumnMinWidth(key: SseColumnKey): number {
  const def = SSE_COLUMNS.find((c) => c.key === key);
  return def ? def.minWidth : 40;
}

/** Width of the leading fire-dot rail (same track as the traffic table's). */
export const SSE_FIRE_RAIL_PX = 14;

/** The grid-template shared by the header row and every event row —
 *  same track resolver as `wsGridTemplate`, minus the direction rail. */
export function sseGridTemplate(widths: Partial<Record<SseColumnKey, number>>, layout: WsGridLayout): string {
  const tracks = SSE_COLUMNS.map((c) => {
    const override = widths[c.key];
    if (override != null) return `${override}px`;
    if (layout === 'compact') {
      return c.stretch ? `minmax(${c.minWidth}px, 1fr)` : `minmax(${c.minWidth}px, ${c.defaultWidth}px)`;
    }
    return c.stretch ? `minmax(${c.defaultWidth}px, ${c.defaultWidth * 3}px)` : `${c.defaultWidth}px`;
  });
  return `${SSE_FIRE_RAIL_PX}px ${tracks.join(' ')}`;
}
