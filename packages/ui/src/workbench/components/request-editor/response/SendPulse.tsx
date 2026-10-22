/**
 * SendPulse — a result pane's leading edge lit by the exchange: a
 * looping primary sweep while it is in flight; when it lands somewhere
 * new the sweep dissolves into a full line in that state's tone that
 * fades. Flight that ends back on the same state (a publish on an open
 * session) plays no line — the sweep finishes the pass it is on and
 * goes dark.
 *
 * `SendPulseBar` is the bar itself, driven by two facts any protocol
 * can state — in flight or not, and the tone of what it rests on. The
 * default export is the HTTP/GraphQL reading of those facts off the
 * send flag and the settled snapshot; the session editors derive
 * theirs from their live feed and settled snapshot.
 */

import type { ExecutedRequestSnapshot } from '@openheaders/core/types';
import { theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { RequestEditorLayout } from '../useRequestEditorLayout';
import type { GraphqlResponseFacts } from './graphql-response';
import { type PillTone, toneHue } from './response-status';
import { type SendPulseDrive, type SendPulsePhase, sendPulseTone } from './send-pulse';
import './send-pulse.css';

export type SendPulseAxis = 'x' | 'y';

/** Under reduced motion the sweep is a still bar — there is no pass
 *  to finish. */
function reducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

/** The bar's phase off the drive: in flight clears any line; a landing
 *  that differs from the last one plays the line once (the state the
 *  bar mounts on never plays — a pane restored with its last answer
 *  stays dark). Flight that ends with no line to play holds the sweep
 *  until its current pass ends, so a near-instant exchange still reads
 *  as one whole sweep. */
export function useSendPulse(
  inflight: boolean,
  landing: PillTone | null,
): { phase: SendPulsePhase; tone: PillTone | null; finish: () => void; passEnd: () => void } {
  const [settled, setSettled] = useState<PillTone | null>(null);
  const [passOwed, setPassOwed] = useState(false);
  const lastLandingRef = useRef(landing);
  const inflightRef = useRef(inflight);
  inflightRef.current = inflight;

  useEffect(() => {
    const last = lastLandingRef.current;
    lastLandingRef.current = landing;
    if (inflight) {
      setSettled(null);
      setPassOwed(!reducedMotion());
      return;
    }
    if (landing === null || landing === last) return;
    setSettled(landing);
    setPassOwed(false);
  }, [inflight, landing]);

  const finish = useCallback(() => setSettled(null), []);
  const passEnd = useCallback(() => {
    if (!inflightRef.current) setPassOwed(false);
  }, []);
  const phase: SendPulsePhase =
    inflight || (settled === null && passOwed) ? 'inflight' : settled === null ? 'idle' : 'settled';
  return { phase, tone: settled, finish, passEnd };
}

export const SendPulseBar: React.FC<SendPulseDrive & { axis: SendPulseAxis }> = ({ inflight, landing, axis }) => {
  const { token } = theme.useToken();
  const { phase, tone, finish, passEnd } = useSendPulse(inflight, landing);
  if (phase === 'idle') return null;
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
      onAnimationIteration={passEnd}
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

const SendPulse: React.FC<{
  sending: boolean;
  response: ExecutedRequestSnapshot | null;
  layout: RequestEditorLayout;
  graphql?: GraphqlResponseFacts | null;
}> = ({ sending, response, layout, graphql }) => (
  <SendPulseBar
    inflight={sending}
    landing={response === null ? null : sendPulseTone(response, graphql)}
    axis={layout === 'vertical' ? 'x' : 'y'}
  />
);

export default SendPulse;
