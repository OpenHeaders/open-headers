/**
 * mqtt-timeline-row-text — the words every non-message timeline row
 * renders, as plain strings: the lifecycle items that ride the log
 * (subscribed / unsubscribed / lost / reconnecting / reconnected /
 * script) and the fixed rows (Connecting / Connected / error /
 * aborted / ended). ONE source for two readers — `MqttTimelineEntryRow`
 * paints these words (chips beside them where a row carries topics),
 * and the orchestrator's search matches against them — so search can
 * only ever find what the row shows. No React.
 */

import type { Translate } from '@openheaders/ui/context/LocaleContext';
import { formatDurationMs } from '@openheaders/ui/shared/combo-knob';
import { inheritSourceLabel } from '../request-editor/inherited-auth';
import { MQTT_HOOK_LABEL_KEY } from './mqtt-scripts';
import type { MqttTimelineItem, MqttTimelineLifecycle } from './mqtt-timeline-model';
import { connackReasonName, connectionEndMessage, grantFailureLabel } from './session-display';

type LifecycleItem = Exclude<MqttTimelineItem, { kind: 'message' }>;

/** The script mark's line — the hook, the levels that contributed and
 *  the verdict; a drop names the level, a failure its error; the
 *  attempt and the duration trail. */
export function scriptRowText(item: MqttTimelineItem & { kind: 'script' }, t: Translate): string {
  const hook = t(MQTT_HOOK_LABEL_KEY[item.hook]);
  const levels = item.chain
    .map((step) =>
      step.level === 'request'
        ? t('workbench.editors.request.response.meta.scriptsLevelRequest')
        : inheritSourceLabel(t, { kind: step.level, name: step.name }),
    )
    .join(' · ');
  const text =
    item.droppedBy !== undefined
      ? t('workbench.editors.mqtt.timeline.scriptDropped', { hook, level: item.droppedBy })
      : item.succeeded
        ? t('workbench.editors.mqtt.timeline.script', { hook, levels })
        : t('workbench.editors.mqtt.timeline.scriptFailed', { hook, error: item.error?.message ?? '' });
  const attempt =
    item.attempt !== undefined && item.attempt > 0
      ? ` · ${t('workbench.editors.mqtt.timeline.scriptAttempt', { attempt: item.attempt })}`
      : '';
  return `${text}${attempt} · ${formatDurationMs(item.durationMs)}`;
}

/** The dropped connection's line — how it ended, verbatim. */
export function lostRowText(item: MqttTimelineItem & { kind: 'lost' }, t: Translate): string {
  return `${t('workbench.editors.mqtt.timeline.lost')} — ${connectionEndMessage(item.end, t)}`;
}

/** One redial's line — asked for, on its wait, or without a stated
 *  wait; the previous attempt's failure beside it when there was one. */
export function reconnectingRowText(item: MqttTimelineItem & { kind: 'reconnecting' }, t: Translate): string {
  const text = item.forced
    ? t('workbench.editors.mqtt.timeline.reconnectingNow', { attempt: item.attempt })
    : item.delayMs === undefined
      ? t('workbench.editors.mqtt.timeline.reconnecting', { attempt: item.attempt })
      : t('workbench.editors.mqtt.timeline.reconnectingAfter', {
          attempt: item.attempt,
          delay: formatDurationMs(item.delayMs),
        });
  return item.error !== undefined ? `${text} — ${item.error}` : text;
}

/** The reconnected line — with the count a fresh session dropped. */
export function reconnectedRowText(item: MqttTimelineItem & { kind: 'reconnected' }, t: Translate): string {
  const base = t('workbench.editors.mqtt.timeline.reconnected');
  if (item.dropped === undefined) return base;
  return `${base} — ${t(
    item.dropped === 1
      ? 'workbench.editors.mqtt.timeline.reconnectedDroppedOne'
      : 'workbench.editors.mqtt.timeline.reconnectedDroppedMany',
    { count: item.dropped },
  )}`;
}

/** The words of any lifecycle item that rides the log — for the
 *  subscription rows the prefix plus the topic filters (and a failed
 *  grant's label), which the row paints as chips. */
export function lifecycleItemText(item: LifecycleItem, t: Translate): string {
  switch (item.kind) {
    case 'subscribed':
      return [
        t('workbench.editors.mqtt.timeline.subscribed'),
        ...item.grants.map((grant) => {
          const failure = grantFailureLabel(grant.reasonCode, t);
          return failure !== null ? `${grant.topicFilter} (${failure})` : grant.topicFilter;
        }),
      ].join(' ');
    case 'unsubscribed':
      return [t('workbench.editors.mqtt.timeline.unsubscribed'), ...item.topicFilters].join(' ');
    case 'lost':
      return lostRowText(item, t);
    case 'reconnecting':
      return reconnectingRowText(item, t);
    case 'reconnected':
      return reconnectedRowText(item, t);
    case 'script':
      return scriptRowText(item, t);
    default: {
      const _exhaustive: never = item;
      void _exhaustive;
      return '';
    }
  }
}

/** The ended row's line — Disconnected / Stopped, with the end detail. */
export function endedRowText(lifecycle: MqttTimelineLifecycle, t: Translate): string {
  const base =
    lifecycle.endedBy === 'close'
      ? t('workbench.editors.mqtt.timeline.disconnected')
      : t('workbench.editors.mqtt.timeline.stopped');
  return lifecycle.endedMessage ? `${base} — ${lifecycle.endedMessage}` : base;
}

/** The error-slot row's line — the neutral aborted row, or the
 *  classified failure verbatim. */
export function errorRowText(lifecycle: MqttTimelineLifecycle, t: Translate): string {
  if (lifecycle.aborted === true) return t('workbench.editors.mqtt.timeline.aborted');
  return lifecycle.errorMessage ?? '';
}

/** The CONNACK block's words — the facts a Connected / Reconnected /
 *  refused row shows behind its chevron, as the block paints them. */
export function connackDetailText(connack: NonNullable<MqttTimelineLifecycle['connack']>): string {
  return [
    'CONNACK',
    'cmd: connack',
    `length: ${connack.remainingLength !== undefined ? String(connack.remainingLength) : '—'}`,
    `reasonCode: ${connack.reasonCode}${connack.reasonName !== undefined ? ` (${connack.reasonName})` : ''}`,
    `sessionPresent: ${connack.sessionPresent ? 'true' : 'false'}`,
  ].join('\n');
}

/** The words behind a lifecycle item's chevron — a reconnected row's
 *  own CONNACK block (the version lens names its code); the rest have
 *  no detail. */
export function lifecycleItemDetailText(item: LifecycleItem, v5: boolean): string {
  if (item.kind !== 'reconnected') return '';
  const reasonName = connackReasonName(item.reasonCode, v5);
  return connackDetailText({
    reasonCode: item.reasonCode,
    ...(reasonName !== undefined ? { reasonName } : {}),
    sessionPresent: item.sessionPresent,
    remainingLength: item.remainingLength,
  });
}

/** The words behind a fixed row's chevron — the Connected row's and a
 *  refusal's CONNACK block; the rest have no detail. */
export function fixedRowDetailText(kind: keyof typeof fixedRowText, lifecycle: MqttTimelineLifecycle): string {
  if ((kind === 'connected' || kind === 'error') && lifecycle.connack !== undefined) {
    return connackDetailText(lifecycle.connack);
  }
  return '';
}

/** The fixed rows' words by entry kind — one signature, so the search
 *  reads every fixed row the same way. */
export const fixedRowText: Readonly<
  Record<
    'sent' | 'connected' | 'abortedEnd' | 'error' | 'ended',
    (lifecycle: MqttTimelineLifecycle, t: Translate) => string
  >
> = {
  sent: (_lifecycle, t) => t('workbench.editors.mqtt.timeline.connecting'),
  connected: (_lifecycle, t) => t('workbench.editors.mqtt.timeline.connected'),
  abortedEnd: (_lifecycle, t) => t('workbench.editors.mqtt.timeline.abortedDisconnected'),
  error: errorRowText,
  ended: endedRowText,
};
