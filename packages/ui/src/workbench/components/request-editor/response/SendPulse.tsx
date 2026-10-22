/**
 * SendPulse — the response pane's leading edge lit by the send: a
 * looping primary sweep while the exchange is in flight; on settle the
 * sweep dissolves into a full line in the status pill's tone that fades.
 */

import type { ExecutedRequestSnapshot } from '@openheaders/core/types';
import { theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { RequestEditorLayout } from '../useRequestEditorLayout';
import type { GraphqlResponseFacts } from './graphql-response';
import { type PillTone, toneHue } from './response-status';
import { type SendPulsePhase, sendPulseTone } from './send-pulse';
import './send-pulse.css';

export function useSendPulse(
  sending: boolean,
  response: ExecutedRequestSnapshot | null,
  graphql?: GraphqlResponseFacts | null,
): { phase: SendPulsePhase; tone: PillTone | null; finish: () => void } {
  const [settled, setSettled] = useState<PillTone | null>(null);
  const awaitingRef = useRef(false);

  useEffect(() => {
    if (sending) {
      awaitingRef.current = true;
      setSettled(null);
      return;
    }
    if (!awaitingRef.current || response === null) return;
    awaitingRef.current = false;
    setSettled(sendPulseTone(response, graphql));
  }, [sending, response, graphql]);

  const finish = useCallback(() => setSettled(null), []);
  return { phase: sending ? 'inflight' : settled === null ? 'idle' : 'settled', tone: settled, finish };
}

const SendPulse: React.FC<{
  sending: boolean;
  response: ExecutedRequestSnapshot | null;
  layout: RequestEditorLayout;
  graphql?: GraphqlResponseFacts | null;
}> = ({ sending, response, layout, graphql }) => {
  const { token } = theme.useToken();
  const { phase, tone, finish } = useSendPulse(sending, response, graphql);
  if (phase === 'idle') return null;
  const axis = layout === 'vertical' ? 'x' : 'y';
  const lineColor = tone === null || tone === 'neutral' ? token.colorTextTertiary : toneHue(token, tone);
  return (
    <div
      className="oh-send-pulse"
      data-testid="oh-send-pulse"
      data-axis={axis}
      data-phase={phase}
      data-tone={tone ?? undefined}
      aria-hidden="true"
      onAnimationEnd={finish}
    >
      <span
        className="oh-send-pulse-sweep"
        style={{
          background: `linear-gradient(${axis === 'x' ? '90deg' : '180deg'}, transparent, ${token.colorPrimary}, transparent)`,
        }}
      />
      <span className="oh-send-pulse-line" style={{ background: lineColor }} />
    </div>
  );
};

export default SendPulse;
