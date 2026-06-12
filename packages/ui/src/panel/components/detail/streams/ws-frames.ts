/**
 * WebSocket frame display projection — the Messages grid's row model
 * and its cell vocabulary, matching the host's Messages tab:
 *
 *   - Data cell: text frames show their payload verbatim; binary frames
 *     show the opcode label ("Binary Message"), never raw base64; error
 *     frames show the transport error message; control frames (close /
 *     ping / pong) show their opcode label.
 *   - Length cell: text frames count characters (bare number); binary
 *     frames format the decoded byte size ("4 B"); error frames read
 *     "N/A".
 *
 * Two sources, one shape: `lifecycle.messages` (the live plane,
 * preferred) with the HAR `_webSocketMessages` dialect as the fallback
 * for entries that arrived with frames already attached (e.g. imports).
 */

import type { RequestLifecycle, WsStreamMessage } from '@openheaders/core/request-lifecycle';
import type { InspectorHarEntry } from '@openheaders/core/types';
import { base64ByteLength } from '../../../data/base64';

export interface WsDisplayFrame {
  /** Stable identity within the request — index in the source list. */
  readonly index: number;
  readonly type: 'send' | 'receive' | 'error';
  /** Wall-clock ms. */
  readonly atMs: number;
  readonly opcode: number;
  readonly mask: boolean;
  readonly data: string;
}

const OPCODE_LABEL: Record<number, string> = {
  0: 'Continuation Frame',
  1: 'Text Message',
  2: 'Binary Message',
  8: 'Connection Close Message',
  9: 'Ping Message',
  10: 'Pong Message',
};

export const WS_OPCODE_TEXT = 1;
export const WS_OPCODE_BINARY = 2;

/** "<label> (Opcode N[, mask])" — the row tooltip. */
export function opcodeDescription(opcode: number, mask: boolean): string {
  const label = OPCODE_LABEL[opcode] ?? '';
  return mask ? `${label} (Opcode ${opcode}, mask)`.trim() : `${label} (Opcode ${opcode})`.trim();
}

/** The Data cell text — see the module doc for the per-opcode shape. */
export function frameDataLabel(frame: WsDisplayFrame): string {
  if (frame.type === 'error') return frame.data;
  if (frame.opcode === WS_OPCODE_TEXT) return frame.data;
  return OPCODE_LABEL[frame.opcode] ?? `Opcode ${frame.opcode}`;
}

/**
 * Byte count formatted on the host's scale — bare bytes below 1000,
 * then 1000-based kB / MB with one decimal under 100 units.
 */
export function formatFrameBytes(bytes: number): string {
  if (bytes < 1000) return `${bytes} B`;
  const kb = bytes / 1000;
  if (kb < 100) return `${kb.toFixed(1)} kB`;
  if (kb < 1000) return `${Math.round(kb)} kB`;
  const mb = kb / 1000;
  if (mb < 100) return `${mb.toFixed(1)} MB`;
  return `${Math.round(mb).toLocaleString()} MB`;
}

/** The Length cell text — see the module doc for the per-opcode shape. */
export function frameLengthLabel(frame: WsDisplayFrame): string {
  if (frame.type === 'error') return 'N/A';
  if (frame.opcode === WS_OPCODE_BINARY) return formatFrameBytes(base64ByteLength(frame.data));
  return String(frame.data.length);
}

function isWsStreamMessage(m: { kind: string }): m is WsStreamMessage {
  return m.kind === 'ws';
}

/** HAR-dialect frame — `time` is wall-clock SECONDS (unlike HAR's ms). */
function isHarWsMessage(
  v: unknown,
): v is { type: 'send' | 'receive' | 'error'; time: number; opcode?: number; data?: string } {
  if (!v || typeof v !== 'object') return false;
  const r = v as Record<string, unknown>;
  return (r.type === 'send' || r.type === 'receive' || r.type === 'error') && typeof r.time === 'number';
}

/** The display list — live plane first, HAR dialect fallback. */
export function wsDisplayFrames(lifecycle: RequestLifecycle, har: InspectorHarEntry | null): WsDisplayFrame[] {
  const live = (lifecycle.messages ?? []).filter(isWsStreamMessage);
  if (live.length > 0) {
    return live.map((m, index) => ({
      index,
      type: m.type,
      atMs: m.atMs,
      opcode: m.opcode,
      mask: m.mask,
      data: m.data,
    }));
  }
  const raw = har?._webSocketMessages;
  if (!Array.isArray(raw)) return [];
  return raw.filter(isHarWsMessage).map((m, index) => ({
    index,
    type: m.type,
    atMs: m.time * 1000,
    opcode: typeof m.opcode === 'number' ? m.opcode : WS_OPCODE_TEXT,
    mask: false,
    data: m.data ?? '',
  }));
}
