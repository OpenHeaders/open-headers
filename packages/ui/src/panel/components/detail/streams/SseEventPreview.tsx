/**
 * SseEventPreview — the EventStream tab's lower pane: the full payload
 * of the selected event. Twin of `MessagePreview` collapsed to the SSE
 * contract: data is always text (the `TextPayload` JSON | Raw viewer),
 * and every rule action is receive-side — a modified event splits
 * Original | Modified with the response delivery-path captions (the
 * wire holds the original; the replacement was delivered in the page),
 * a dropped event keeps its wire row with the never-delivered caption,
 * and an injected event is wholly rule-authored (synthetic banner, no
 * two sides to split).
 */

import { useT, type Translate } from '@openheaders/ui/context/LocaleContext';
import { type InfoPopoverContent, InfoTrigger } from '@openheaders/ui/shared/info-popover';
import { useMemo } from 'react';
import type { MessageFrameAttribution } from '../../../data/message-fire-rail';
import { overrideLabels } from '../override-labels';
import SplitBodyView from '../SplitBodyView';
import { TextPayload } from './MessagePreview';
import type { SseDisplayEvent } from './sse-events';

interface SseEventPreviewProps {
  event: SseDisplayEvent | null;
  /** Fire-rail attribution for the event — a derivable modification
   *  flips the pane into the Original | Modified split. */
  attribution?: MessageFrameAttribution | null;
}

/** The Modified caption's (i) — shown only at the inferred tier, where
 *  the split renders a derived payload rather than a captured one. */
function inferredModifiedInfo(t: Translate): InfoPopoverContent {
  return {
    title: t('panel.inspector.sse.inferredModified.title'),
    kicker: t('panel.inspector.sections.eventStream'),
    summary: t('panel.inspector.sse.inferredModified.summary'),
    description: t('panel.inspector.sse.inferredModified.description'),
  };
}

/** The Dropped caption's (i) — the drop, like the replacement, happens
 *  inside the page after wire capture, so it is selector-inferred too. */
function inferredDroppedInfo(t: Translate): InfoPopoverContent {
  return {
    title: t('panel.inspector.sse.inferredDropped.title'),
    kicker: t('panel.inspector.sections.eventStream'),
    summary: t('panel.inspector.sse.inferredDropped.summary'),
    description: t('panel.inspector.sse.inferredDropped.description'),
  };
}

export default function SseEventPreview({ event, attribution = null }: SseEventPreviewProps) {
  const t = useT();
  const labels = useMemo(() => overrideLabels(t), [t]);
  if (!event) {
    return (
      <div className="dt-msg-preview-empty">
        <strong>{t('panel.inspector.streams.preview.noEventTitle')}</strong>
        <span className="dt-col-muted">{t('panel.inspector.streams.preview.noEventHint')}</span>
      </div>
    );
  }

  const modification = attribution?.modification ?? null;
  if (modification && modification.kind !== 'replaced-on-wire') {
    const inferredInfo =
      attribution?.tier === 'inferred' ? (
        <InfoTrigger content={modification.kind === 'dropped' ? inferredDroppedInfo(t) : inferredModifiedInfo(t)} />
      ) : undefined;

    if (modification.kind === 'dropped') {
      return (
        <div className="dt-msg-preview-dual">
          <SplitBodyView
            startLabel={labels.responseOriginal}
            start={<TextPayload text={event.data} />}
            endLabel={labels.wsRecvDropped}
            end={
              <div className="dt-msg-preview-content">
                <span className="dt-col-muted">{t('panel.inspector.sse.preview.droppedPane')}</span>
              </div>
            }
            headerAction={inferredInfo}
          />
        </div>
      );
    }

    return (
      <div className="dt-msg-preview-dual">
        <SplitBodyView
          startLabel={labels.responseOriginal}
          start={<TextPayload text={event.data} />}
          endLabel={labels.responseModified}
          end={<TextPayload text={modification.modified} />}
          headerAction={inferredInfo}
        />
      </div>
    );
  }

  // A synthetic injected event has no two sides to split — the whole
  // payload is rule-authored; the banner carries its provenance.
  if (event.synthetic) {
    return (
      <>
        <div className="dt-msg-preview-synthetic-note">{t('panel.inspector.sse.preview.syntheticNote')}</div>
        <TextPayload text={event.data} />
      </>
    );
  }

  return <TextPayload text={event.data} />;
}
