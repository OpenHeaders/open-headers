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
 *
 * The wrapper's per-frame captures (`lifecycle.messageCaptures`) join
 * here at consume time: a capture whose acted-on frame crossed the wire
 * annotates that frame (`capture`); one whose frame never crossed the
 * wire at all (receive-inject, send-drop) mints a `synthetic` row so
 * the grid shows what the page actually exchanged, not just the wire.
 */

import type { RequestLifecycle, StreamMessageCapture, WsStreamMessage } from '@openheaders/core/request-lifecycle';
import type { InspectorHarEntry } from '@openheaders/core/types';
import { base64ByteLength } from '../../../data/base64';

export interface WsDisplayFrame {
  /** Stable identity within the request — index in the source list;
   *  synthetic rows index from {@link WS_SYNTHETIC_INDEX_BASE}. */
  readonly index: number;
  readonly type: 'send' | 'receive' | 'error';
  /** Wall-clock ms. */
  readonly atMs: number;
  readonly opcode: number;
  readonly mask: boolean;
  readonly data: string;
  /** Wrapper capture joined to this frame — recorded proof of the rule's
   *  action, carrying the side the wire never saw. */
  readonly capture?: StreamMessageCapture;
  /** True for a row minted from a capture with no wire twin. */
  readonly synthetic?: boolean;
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

/** Index floor for synthetic (capture-minted) rows — far above any wire
 *  index (the stream ring caps at 5 000), and far from the quick-create
 *  `CONNECTION_FRAME` sentinel (-1). */
export const WS_SYNTHETIC_INDEX_BASE = 1_000_000;

/** Pairing window between a capture's page clock and the frame's capture
 *  clock — same posture as the background's lifecycle join. */
const CAPTURE_JOIN_SLACK_MS = 5_000;

/** The payload the acted-on frame put on the wire — `undefined` when the
 *  frame never crossed it (or a binary original was not serialized). */
function expectedWireData(c: StreamMessageCapture): string | undefined {
  if (c.op === 'replaced') return c.direction === 'send' ? c.delivered : c.original;
  if (c.op === 'dropped') return c.direction === 'receive' ? c.original : undefined;
  return c.direction === 'send' ? c.delivered : undefined;
}

/** Whether the capture's frame never crossed the wire at all. */
function isSyntheticOnly(c: StreamMessageCapture): boolean {
  return (c.op === 'injected' && c.direction === 'receive') || (c.op === 'dropped' && c.direction === 'send');
}

/**
 * Join wrapper captures onto the wire frame list: annotate each capture's
 * wire twin (matched by direction + payload + time window, greedy in
 * order, one frame per capture), and mint synthetic rows for captures
 * with no wire twin. Pure; returns the input array when nothing joins.
 */
function joinCaptures(frames: WsDisplayFrame[], captures: readonly StreamMessageCapture[]): WsDisplayFrame[] {
  if (captures.length === 0) return frames;
  const out = frames.slice();
  const claimed = new Set<number>();
  const synthetic: WsDisplayFrame[] = [];
  captures.forEach((c, ci) => {
    if (isSyntheticOnly(c)) {
      const data = c.op === 'injected' ? c.delivered : c.original;
      if (data === undefined) return;
      synthetic.push({
        index: WS_SYNTHETIC_INDEX_BASE + ci,
        type: c.direction,
        atMs: c.atMs,
        opcode: WS_OPCODE_TEXT,
        mask: false,
        data,
        capture: c,
        synthetic: true,
      });
      return;
    }
    const expected = expectedWireData(c);
    if (expected === undefined) return;
    for (let i = 0; i < out.length; i++) {
      if (claimed.has(i)) continue;
      const f = out[i]!;
      if (f.capture !== undefined || f.type !== c.direction || f.data !== expected) continue;
      if (Math.abs(f.atMs - c.atMs) > CAPTURE_JOIN_SLACK_MS) continue;
      out[i] = { ...f, capture: c };
      claimed.add(i);
      break;
    }
  });
  if (synthetic.length === 0) return out;
  return [...out, ...synthetic].sort((a, b) => a.atMs - b.atMs || a.index - b.index);
}

/** The display list — live plane first, HAR dialect fallback, wrapper
 *  captures joined onto either. */
export function wsDisplayFrames(lifecycle: RequestLifecycle, har: InspectorHarEntry | null): WsDisplayFrame[] {
  const captures = lifecycle.messageCaptures ?? [];
  const live = (lifecycle.messages ?? []).filter(isWsStreamMessage);
  if (live.length > 0) {
    return joinCaptures(
      live.map((m, index) => ({
        index,
        type: m.type,
        atMs: m.atMs,
        opcode: m.opcode,
        mask: m.mask,
        data: m.data,
      })),
      captures,
    );
  }
  const raw = har?._webSocketMessages;
  if (!Array.isArray(raw)) return joinCaptures([], captures);
  return joinCaptures(
    raw.filter(isHarWsMessage).map((m, index) => ({
      index,
      type: m.type,
      atMs: m.time * 1000,
      opcode: typeof m.opcode === 'number' ? m.opcode : WS_OPCODE_TEXT,
      mask: false,
      data: m.data ?? '',
    })),
    captures,
  );
}
