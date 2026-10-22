/**
 * Session-resilience display helpers for the WebSocket editor — the
 * MQTT editor's `reconnectingAt` / `sessionEndedMessage` twins over
 * the WS snapshot's `lifecycle` facts: whether the live session is
 * between reconnect attempts (the badge, the header's Reconnect now,
 * the Send gate), the timeline's per-fact row items (live facts
 * stamped from the wire, materialized ones joined positionally with
 * their session-only times and re-indexed under the rolling
 * retention), and the ended row's "reconnect gave up" detail.
 */

import type { ExecutedWsLifecycle, ExecutedWsSnapshot } from '@openheaders/core/types';
import type { Translate } from '@openheaders/ui/context/LocaleContext';
import type { PillTone } from '../request-editor/response/response-status';
import type { WsSessionTiming } from './useLiveWsSession';

/** One timeline lifecycle row — the fact plus its session-only host
 *  stamp when one was observed. `atIndex` is already the display
 *  index (rolled-off messages subtracted). */
export type WsTimelineLifecycleItem = ExecutedWsLifecycle & { atMs?: number };

/** True while the last reconnect fact is a drop or an attempt still
 *  dialing — the session is in flight but no connection is up. Ack
 *  timeouts and script marks are session facts, not reconnect facts;
 *  they never move the badge. */
export function reconnectingAt(lifecycle: readonly ExecutedWsLifecycle[]): boolean {
  for (let i = lifecycle.length - 1; i >= 0; i--) {
    const kind = lifecycle[i].kind;
    if (kind === 'ackTimeout' || kind === 'script') continue;
    return kind !== 'reconnected';
  }
  return false;
}

/** The live feed's facts as timeline rows — absolute capture indexes
 *  ARE display indexes on the live log (nothing rolls off there). */
export function liveLifecycleItems(
  lifecycle: readonly ExecutedWsLifecycle[],
  timestamps: readonly number[],
): WsTimelineLifecycleItem[] {
  return lifecycle.map((item, i) => {
    const atMs = timestamps[i];
    return atMs !== undefined ? { ...item, atMs } : item;
  });
}

/** The settled snapshot's facts as timeline rows — re-indexed under
 *  the retention window and joined with the session-only stamps the
 *  editor retained at materialization. */
export function snapshotLifecycleItems(
  snapshot: ExecutedWsSnapshot,
  timestamps: readonly number[] | undefined,
): WsTimelineLifecycleItem[] {
  return (snapshot.lifecycle ?? []).map((item, i) => {
    const atMs = timestamps?.[i];
    const atIndex = Math.max(0, item.atIndex - snapshot.droppedMessages);
    return { ...item, atIndex, ...(atMs !== undefined ? { atMs } : {}) };
  });
}

/** The ended row's detail when auto-reconnect spent its attempt cap —
 *  the attempts dialed and the last classified failure. */
export function reconnectExhaustedMessage(exhausted: { attempts: number; error?: string }, t: Translate): string {
  const attemptsText =
    exhausted.attempts === 1
      ? t('workbench.editors.websocket.session.reconnectAttemptsOne')
      : t('workbench.editors.websocket.session.reconnectAttemptsMany', { count: exhausted.attempts });
  return exhausted.error === undefined
    ? t('workbench.editors.websocket.session.reconnectExhausted', { attempts: attemptsText })
    : t('workbench.editors.websocket.session.reconnectExhaustedReason', {
        attempts: attemptsText,
        reason: exhausted.error,
      });
}

/** The settled pill's tone — the one reading the pill and the pane's
 *  send pulse both paint, by whose doing the end was: what the user
 *  asked for (Disconnect, Stop, a cancel before the handshake)
 *  neutral; a close the server sent on the warning tint; a handshake
 *  failure, a socket that ended with no Close frame and a spent
 *  reconnect loop on the error tint. The snapshot's close record does
 *  not say who sent it — the editor's Disconnect-click stamp does. */
export function wsSessionEndTone(
  snapshot: Pick<ExecutedWsSnapshot, 'outcome' | 'close' | 'stopped' | 'reconnectExhausted'>,
  timing: Pick<WsSessionTiming, 'closeRequestedAt'> | null,
): PillTone {
  if (snapshot.outcome.kind === 'aborted') return 'neutral';
  if (snapshot.outcome.kind === 'failed' || snapshot.reconnectExhausted !== undefined) return 'error';
  if (snapshot.stopped === true || timing?.closeRequestedAt !== undefined) return 'neutral';
  return snapshot.close === null ? 'error' : 'warning';
}
