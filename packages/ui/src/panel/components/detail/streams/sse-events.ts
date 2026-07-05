/**
 * SSE event display projection — the EventStream grid's row model, twin
 * of `ws-frames.ts` for server-sent events.
 *
 * Two sources, one display shape:
 *   - `lifecycle.messages` (kind `sse`) — the LIVE plane, preferred
 *     whenever present; carries per-event wall-clock times.
 *   - the finished response body — the heuristic fallback: parse the SSE
 *     wire format out of the body text once the host delivers it. These
 *     events carry no time (the wire format has none), so their Time
 *     cells stay empty; for long-running streams that never finish the
 *     body stays empty, and this leg honestly shows nothing until close.
 *
 * The wrapper's per-event captures (`lifecycle.messageCaptures`) join
 * here at consume time. SSE is receive-only: modify/drop act after wire
 * capture, so a `replaced`/`dropped` capture annotates its wire twin
 * (matched by event name + original payload + time window); `injected`
 * events never cross the wire at all and mint a `synthetic` row.
 */

import type { RequestLifecycle, SseStreamMessage, StreamMessageCapture } from '@openheaders/core/request-lifecycle';
import { WS_SYNTHETIC_INDEX_BASE } from './ws-frames';

export interface SseDisplayEvent {
  /** Stable identity within the request — index in the source list;
   *  synthetic rows index from {@link WS_SYNTHETIC_INDEX_BASE}. */
  readonly index: number;
  readonly id?: string;
  readonly eventName: string;
  readonly data: string;
  /** Wall-clock ms — live plane only; body-parsed events carry none. */
  readonly atMs?: number;
  /** Wrapper capture joined to this event — recorded proof of the rule's
   *  action, carrying the side the wire never saw. */
  readonly capture?: StreamMessageCapture;
  /** True for a row minted from a capture with no wire twin. */
  readonly synthetic?: boolean;
}

/** Parse the SSE wire format (`id:` / `event:` / `data:` blocks) out of
 *  a finished response body. */
export function parseSseBody(body: string): Omit<SseDisplayEvent, 'index'>[] {
  if (!body) return [];
  const out: Omit<SseDisplayEvent, 'index'>[] = [];
  const blocks = body.split(/\r?\n\r?\n/);
  for (const block of blocks) {
    if (!block.trim()) continue;
    let id: string | undefined;
    let eventName = 'message';
    const dataLines: string[] = [];
    for (const raw of block.split(/\r?\n/)) {
      const line = raw.replace(/\r$/, '');
      if (!line || line.startsWith(':')) continue;
      const colon = line.indexOf(':');
      const field = colon === -1 ? line : line.slice(0, colon);
      let value = colon === -1 ? '' : line.slice(colon + 1);
      if (value.startsWith(' ')) value = value.slice(1);
      if (field === 'id') id = value;
      else if (field === 'event') eventName = value || 'message';
      else if (field === 'data') dataLines.push(value);
    }
    if (dataLines.length === 0 && !id) continue;
    out.push({ id, eventName, data: dataLines.join('\n') });
  }
  return out;
}

function isSseStreamMessage(m: { kind: string }): m is SseStreamMessage {
  return m.kind === 'sse';
}

/** Pairing window between a capture's page clock and the event's capture
 *  clock — same posture as the background's lifecycle join. */
const CAPTURE_JOIN_SLACK_MS = 5_000;

/**
 * Join wrapper captures onto the wire event list: annotate each
 * `replaced`/`dropped` capture's wire twin (matched by event name +
 * original payload + time window, greedy in order, one event per
 * capture — time-anchored, so body-parsed rows without a clock are
 * never annotated), and mint synthetic rows for `injected` captures.
 * Pure; returns the input array when nothing joins.
 */
function joinCaptures(events: SseDisplayEvent[], captures: readonly StreamMessageCapture[]): SseDisplayEvent[] {
  if (captures.length === 0) return events;
  const out = events.slice();
  const claimed = new Set<number>();
  const synthetic: SseDisplayEvent[] = [];
  captures.forEach((c, ci) => {
    const eventName = c.eventName ?? 'message';
    if (c.op === 'injected') {
      if (c.delivered === undefined) return;
      synthetic.push({
        index: WS_SYNTHETIC_INDEX_BASE + ci,
        eventName,
        data: c.delivered,
        atMs: c.atMs,
        capture: c,
        synthetic: true,
      });
      return;
    }
    if (c.original === undefined) return;
    for (let i = 0; i < out.length; i++) {
      if (claimed.has(i)) continue;
      const ev = out[i]!;
      if (ev.capture !== undefined || ev.eventName !== eventName || ev.data !== c.original) continue;
      if (ev.atMs === undefined || Math.abs(ev.atMs - c.atMs) > CAPTURE_JOIN_SLACK_MS) continue;
      out[i] = { ...ev, capture: c };
      claimed.add(i);
      break;
    }
  });
  if (synthetic.length === 0) return out;
  return [...out, ...synthetic].sort((a, b) => (a.atMs ?? 0) - (b.atMs ?? 0) || a.index - b.index);
}

/** The display list — live plane first, body-parse fallback, wrapper
 *  captures joined onto either. */
export function sseDisplayEvents(lifecycle: RequestLifecycle, body: string): SseDisplayEvent[] {
  const captures = lifecycle.messageCaptures ?? [];
  const live = (lifecycle.messages ?? []).filter(isSseStreamMessage);
  if (live.length > 0) {
    return joinCaptures(
      live.map((m, index) => ({
        index,
        id: m.eventId || undefined,
        eventName: m.eventName,
        data: m.data,
        atMs: m.atMs,
      })),
      captures,
    );
  }
  return joinCaptures(
    parseSseBody(body).map((ev, index) => ({ ...ev, index })),
    captures,
  );
}
