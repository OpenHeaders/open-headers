/**
 * ws-timeline-row-text — the words every non-frame timeline row
 * renders, as plain strings: the lifecycle facts that ride the log
 * (script / lost / ack timeout / reconnecting / reconnected) and the
 * fixed rows (Connecting / Connected / error / aborted / ended). ONE
 * source for two readers — `WsMessageTimeline` paints these words, and
 * its search matches against them — so search can only ever find what
 * the row shows. No React.
 */

import { wsCloseCodePhrase } from '@openheaders/core/utils';
import type { Translate } from '@openheaders/ui/context/LocaleContext';
import { formatDurationMs } from '@openheaders/ui/shared/combo-knob';
import { inheritSourceLabel } from '../request-editor/inherited-auth';
import type { WsTimelineLifecycleItem } from './ws-lifecycle';
import { WS_HOOK_LABEL_KEY } from './ws-scripts';

/** The slice of the timeline's lifecycle the fixed rows' words read. */
export interface WsRowTextLifecycle {
  handshake?: { url?: string };
  errorMessage?: string;
  aborted?: true;
  endedBy?: 'close' | 'stop';
}

/** The script mark's line — the hook, the levels that contributed and
 *  the verdict; a drop names the level, a failure its error; the
 *  attempt and the duration trail. */
export function scriptRowText(item: WsTimelineLifecycleItem & { kind: 'script' }, t: Translate): string {
  const hook = t(WS_HOOK_LABEL_KEY[item.hook]);
  const levels = item.chain
    .map((step) =>
      step.level === 'request'
        ? t('workbench.editors.request.response.meta.scriptsLevelRequest')
        : inheritSourceLabel(t, { kind: step.level, name: step.name }),
    )
    .join(' · ');
  const text =
    item.droppedBy !== undefined
      ? t('workbench.editors.websocket.timeline.scriptDropped', { hook, level: item.droppedBy })
      : item.succeeded
        ? t('workbench.editors.websocket.timeline.script', { hook, levels })
        : t('workbench.editors.websocket.timeline.scriptFailed', { hook, error: item.error?.message ?? '' });
  const attempt =
    item.attempt !== undefined && item.attempt > 0
      ? ` · ${t('workbench.editors.websocket.timeline.scriptAttempt', { attempt: item.attempt })}`
      : '';
  return `${text}${attempt} · ${formatDurationMs(item.durationMs)}`;
}

/** The dropped connection's line — how it ended, verbatim. */
export function lostRowText(item: WsTimelineLifecycleItem & { kind: 'lost' }, t: Translate): string {
  const phrase = item.close !== null ? wsCloseCodePhrase(item.close.code) : null;
  const detail = item.idle
    ? t('workbench.editors.websocket.timeline.lostIdle')
    : item.close === null
      ? t('workbench.editors.websocket.session.noCloseFrame')
      : item.close.reason !== ''
        ? `${item.close.code} — ${item.close.reason}`
        : phrase !== null
          ? `${item.close.code} ${phrase}`
          : String(item.close.code);
  return `${t('workbench.editors.websocket.timeline.lost')} — ${detail}`;
}

/** A Socket.IO ack wait that ran out — the id names the ↑ event. */
export function ackTimeoutRowText(item: WsTimelineLifecycleItem & { kind: 'ackTimeout' }, t: Translate): string {
  return t('workbench.editors.websocket.timeline.ackTimeout', {
    ackId: item.ackId,
    timeout: formatDurationMs(item.timeoutMs),
  });
}

/** One redial's line — on its wait, or asked for early; the previous
 *  attempt's classified failure beside it. */
export function reconnectingRowText(item: WsTimelineLifecycleItem & { kind: 'reconnecting' }, t: Translate): string {
  const text = item.forced
    ? t('workbench.editors.websocket.timeline.reconnectingNow', { attempt: item.attempt })
    : t('workbench.editors.websocket.timeline.reconnectingAfter', {
        attempt: item.attempt,
        delay: formatDurationMs(item.delayMs),
      });
  return item.error !== undefined ? `${text} — ${item.error}` : text;
}

/** The Connected row's twin for a reconnect attempt that took. */
export function reconnectedRowText(lifecycle: WsRowTextLifecycle, t: Translate): string {
  return lifecycle.handshake?.url !== undefined
    ? t('workbench.editors.websocket.timeline.reconnectedTo', { url: lifecycle.handshake.url })
    : t('workbench.editors.websocket.timeline.reconnected');
}

/** The words of any lifecycle fact that rides the log. */
export function lifecycleItemText(item: WsTimelineLifecycleItem, lifecycle: WsRowTextLifecycle, t: Translate): string {
  switch (item.kind) {
    case 'script':
      return scriptRowText(item, t);
    case 'lost':
      return lostRowText(item, t);
    case 'ackTimeout':
      return ackTimeoutRowText(item, t);
    case 'reconnecting':
      return reconnectingRowText(item, t);
    case 'reconnected':
      return reconnectedRowText(lifecycle, t);
    default: {
      const _exhaustive: never = item;
      void _exhaustive;
      return '';
    }
  }
}

/** The Connected row's line — with the URL once the handshake names it. */
export function connectedRowText(lifecycle: WsRowTextLifecycle, t: Translate): string {
  return lifecycle.handshake?.url !== undefined
    ? t('workbench.editors.websocket.timeline.connectedTo', { url: lifecycle.handshake.url })
    : t('workbench.editors.websocket.timeline.connected');
}

/** The ended row's line — Disconnected (from the URL) / Stopped. */
export function endedRowText(lifecycle: WsRowTextLifecycle, t: Translate): string {
  switch (lifecycle.endedBy) {
    case 'close':
      return lifecycle.handshake?.url !== undefined
        ? t('workbench.editors.websocket.timeline.disconnectedFrom', { url: lifecycle.handshake.url })
        : t('workbench.editors.websocket.timeline.disconnected');
    case 'stop':
      return t('workbench.editors.websocket.timeline.stopped');
    default:
      return '';
  }
}

/** The error-slot row's line — the neutral aborted row, or the
 *  classified failure (named by its URL once the handshake had one). */
export function errorRowText(lifecycle: WsRowTextLifecycle, t: Translate): string {
  if (lifecycle.aborted === true) return t('workbench.editors.websocket.timeline.aborted');
  if (lifecycle.errorMessage === undefined) return '';
  const url = lifecycle.handshake?.url;
  return url !== undefined
    ? t('workbench.editors.websocket.timeline.couldNotConnect', { url })
    : lifecycle.errorMessage;
}

/** The fixed rows' words by entry kind — one signature, so the search
 *  reads every fixed row the same way. */
export const fixedRowText: Readonly<
  Record<'sent' | 'connected' | 'error' | 'ended', (lifecycle: WsRowTextLifecycle, t: Translate) => string>
> = {
  sent: (_lifecycle, t) => t('workbench.editors.websocket.timeline.connecting'),
  connected: connectedRowText,
  error: errorRowText,
  ended: endedRowText,
};
