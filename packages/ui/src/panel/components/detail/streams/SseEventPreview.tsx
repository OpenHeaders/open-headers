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

import { type InfoPopoverContent, InfoTrigger } from '@openheaders/ui/shared/info-popover';
import type { MessageFrameAttribution } from '../../../data/message-fire-rail';
import {
  RESPONSE_MODIFIED_LABEL,
  RESPONSE_ORIGINAL_LABEL,
  WS_RECV_DROPPED_LABEL,
} from '../override-labels';
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
const INFERRED_MODIFIED_INFO: InfoPopoverContent = {
  title: 'Derived, not captured',
  kicker: 'EventStream',
  summary: "This side shows the rule's replacement payload — the capture plane only ever saw the wire event.",
  description:
    'The wire recorded the original event; the modification happened inside the page after capture. That this ' +
    "exact event took the replacement is inferred from the rule's event selector, matching the amber fire dot.",
};

/** The Dropped caption's (i) — the drop, like the replacement, happens
 *  inside the page after wire capture, so it is selector-inferred too. */
const INFERRED_DROPPED_INFO: InfoPopoverContent = {
  title: 'Dropped, inferred',
  kicker: 'EventStream',
  summary: 'The wire recorded this event, but the rule stopped its delivery inside the page.',
  description:
    'The drop happens after capture, so nothing can record the non-delivery itself. That this exact event was ' +
    "dropped is inferred from the rule's event selector, matching the amber fire dot.",
};

export default function SseEventPreview({ event, attribution = null }: SseEventPreviewProps) {
  if (!event) {
    return (
      <div className="dt-msg-preview-empty">
        <strong>No event selected</strong>
        <span className="dt-col-muted">Select an event to browse its content.</span>
      </div>
    );
  }

  const modification = attribution?.modification ?? null;
  if (modification && modification.kind !== 'replaced-on-wire') {
    const inferredInfo =
      attribution?.tier === 'inferred' ? (
        <InfoTrigger content={modification.kind === 'dropped' ? INFERRED_DROPPED_INFO : INFERRED_MODIFIED_INFO} />
      ) : undefined;

    if (modification.kind === 'dropped') {
      return (
        <div className="dt-msg-preview-dual">
          <SplitBodyView
            startLabel={RESPONSE_ORIGINAL_LABEL}
            start={<TextPayload text={event.data} />}
            endLabel={WS_RECV_DROPPED_LABEL}
            end={
              <div className="dt-msg-preview-content">
                <span className="dt-col-muted">
                  The rule dropped this event — it reached the browser but was never delivered to the page.
                </span>
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
          startLabel={RESPONSE_ORIGINAL_LABEL}
          start={<TextPayload text={event.data} />}
          endLabel={RESPONSE_MODIFIED_LABEL}
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
        <div className="dt-msg-preview-synthetic-note">
          Synthetic event — injected by a rule inside the page; it never crossed the wire.
        </div>
        <TextPayload text={event.data} />
      </>
    );
  }

  return <TextPayload text={event.data} />;
}
