/**
 * grpc-timeline-row-text — the words every non-message timeline row
 * renders, as plain strings: the script marks that ride the log and
 * the fixed rows (Request sent / Response received / ended). ONE
 * source for two readers — `GrpcMessageTimeline` paints these words,
 * and its search matches against them — so search can only ever find
 * what the row shows. No React.
 */

import type { Translate } from '@openheaders/ui/context/LocaleContext';
import { formatDurationMs } from '@openheaders/ui/shared/combo-knob';
import { inheritSourceLabel } from '../request-editor/inherited-auth';
import { GRPC_HOOK_LABEL_KEY, type GrpcScriptMarkItem } from './grpc-scripts';

/** The slice of the timeline's lifecycle the fixed rows' words read. */
export interface GrpcRowTextLifecycle {
  endedBy?: 'complete' | 'stop' | 'error' | 'lost';
  endedMessage?: string;
}

/** The script mark's line — the hook, the levels that contributed and
 *  the verdict; a failure names its error; the duration trails. */
export function scriptRowText(mark: GrpcScriptMarkItem, t: Translate): string {
  const hook = t(GRPC_HOOK_LABEL_KEY[mark.hook]);
  const levels = mark.chain
    .map((step) =>
      step.level === 'request'
        ? t('workbench.editors.request.response.meta.scriptsLevelRequest')
        : inheritSourceLabel(t, { kind: step.level, name: step.name }),
    )
    .join(' · ');
  const text = mark.succeeded
    ? t('workbench.editors.grpc.timeline.script', { hook, levels })
    : t('workbench.editors.grpc.timeline.scriptFailed', { hook, error: mark.error?.message ?? '' });
  return `${text} · ${formatDurationMs(mark.durationMs)}`;
}

/** The ended row's plain label — Completed / Stopped / Failed / Lost. */
export function endedLabel(endedBy: NonNullable<GrpcRowTextLifecycle['endedBy']>, t: Translate): string {
  switch (endedBy) {
    case 'complete':
      return t('workbench.editors.grpc.timeline.completed');
    case 'stop':
      return t('workbench.editors.grpc.timeline.stopped');
    case 'error':
      return t('workbench.editors.grpc.timeline.failed');
    case 'lost':
      return t('workbench.editors.grpc.timeline.lost');
    default: {
      const _exhaustive: never = endedBy;
      void _exhaustive;
      return '';
    }
  }
}

/** The ended row's line — the plain label on a failure or a lost
 *  connection (its explanation lives behind the chevron), the label
 *  with the end detail otherwise. */
export function endedRowText(lifecycle: GrpcRowTextLifecycle, t: Translate): string {
  if (lifecycle.endedBy === undefined) return '';
  const label = endedLabel(lifecycle.endedBy, t);
  if (lifecycle.endedBy === 'error' || lifecycle.endedBy === 'lost') return label;
  return lifecycle.endedMessage ? `${label} — ${lifecycle.endedMessage}` : label;
}

/** The fixed rows' words by entry kind — one signature, so the search
 *  reads every fixed row the same way. */
export const fixedRowText: Readonly<
  Record<'sent' | 'connected' | 'ended', (lifecycle: GrpcRowTextLifecycle, t: Translate) => string>
> = {
  sent: (_lifecycle, t) => t('workbench.editors.grpc.timeline.requestSent'),
  connected: (_lifecycle, t) => t('workbench.editors.grpc.timeline.responseReceived'),
  ended: endedRowText,
};
