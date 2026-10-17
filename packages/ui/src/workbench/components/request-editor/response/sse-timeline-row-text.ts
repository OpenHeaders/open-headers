/**
 * sse-timeline-row-text — the words the event list's lifecycle rows
 * render, as plain strings: the Connected row and the ended row (how
 * the stream ended, with the failure text when it failed). ONE source
 * for two readers — `ResponseSseEventList` paints these words, and its
 * search matches against them — so search can only ever find what the
 * row shows. No React.
 */

import type { Translate } from '@openheaders/ui/context/LocaleContext';

/** How the stream ended — drives the ended lifecycle row. */
export type SseStreamEndedBy = 'end' | 'stop' | 'cap' | 'timeout' | 'error';

/** The slice of the list's lifecycle the fixed rows' words read. */
export interface SseRowTextLifecycle {
  /** Connection target — the send's (final) URL. */
  url: string;
  /** Absent while frames are still arriving — the live phase. */
  endedBy?: SseStreamEndedBy;
  /** Failure text riding `endedBy: 'error'`. */
  endedMessage?: string;
}

/** The ended row's plain label — Closed / Stopped / Capped / Timed out / Failed. */
export function endedLabel(endedBy: SseStreamEndedBy, t: Translate): string {
  switch (endedBy) {
    case 'end':
      return t('workbench.editors.request.response.sse.closed');
    case 'stop':
      return t('workbench.editors.request.response.sse.stopped');
    case 'cap':
      return t('workbench.editors.request.response.sse.capped');
    case 'timeout':
      return t('workbench.editors.request.response.sse.timedOut');
    case 'error':
      return t('workbench.editors.request.response.sse.failed');
    default: {
      const _exhaustive: never = endedBy;
      void _exhaustive;
      return '';
    }
  }
}

/** The Connected row's line — the stream's URL. */
export function connectedRowText(lifecycle: SseRowTextLifecycle, t: Translate): string {
  return t('workbench.editors.request.response.sse.connected', { url: lifecycle.url });
}

/** The ended row's line — the label, with the failure text after it. */
export function endedRowText(lifecycle: SseRowTextLifecycle, t: Translate): string {
  if (lifecycle.endedBy === undefined) return '';
  const label = endedLabel(lifecycle.endedBy, t);
  return lifecycle.endedMessage ? `${label} — ${lifecycle.endedMessage}` : label;
}

/** The fixed rows' words by entry kind — one signature, so the search
 *  reads every fixed row the same way. */
export const fixedRowText: Readonly<
  Record<'connected' | 'ended', (lifecycle: SseRowTextLifecycle, t: Translate) => string>
> = {
  connected: connectedRowText,
  ended: endedRowText,
};
