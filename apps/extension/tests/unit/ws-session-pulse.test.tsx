// @vitest-environment jsdom
/**
 * The WebSocket session pane's send pulse — the bar sweeps while the
 * session dials or redials, lands on the success tint when the
 * handshake settles, sweeps one whole pass for a message sent on the
 * open session, and lands on the settled pill's tone at the end.
 */

import type { ExecutedWsSnapshot } from '@openheaders/core/types';
import { SendPulseBar } from '@openheaders/ui/workbench/components/request-editor/response/SendPulse';
import type { LiveWsSession } from '@openheaders/ui/workbench/components/websocket-request-editor/useLiveWsSession';
import { wsSessionEndTone } from '@openheaders/ui/workbench/components/websocket-request-editor/ws-lifecycle';
import { wsSessionPulse } from '@openheaders/ui/workbench/components/websocket-request-editor/ws-session-pulse';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// React registers onAnimationEnd under a vendor-prefixed name when the
// window lacks AnimationEvent, as jsdom's does.
vi.hoisted(() => {
  const scope = globalThis as unknown as { AnimationEvent?: typeof Event };
  if (typeof scope.AnimationEvent === 'undefined') scope.AnimationEvent = Event;
});

afterEach(cleanup);

function makeSnapshot(overrides: Partial<ExecutedWsSnapshot> = {}): ExecutedWsSnapshot {
  return {
    outcome: { kind: 'connected' },
    protocol: '',
    extensions: '',
    messages: [],
    droppedMessages: 0,
    close: { code: 1000, reason: '', wasClean: true },
    durationMs: 1200,
    ...overrides,
  };
}

function makeLive(overrides: Partial<LiveWsSession> = {}): LiveWsSession {
  return {
    open: null,
    startedAt: 1,
    items: [],
    count: 0,
    timestamps: [],
    lifecycle: [],
    lifecycleTimestamps: [],
    ...overrides,
  };
}

const OPEN: LiveWsSession['open'] = { protocol: '', extensions: '' };
/** The user clicked Disconnect — the plane's stamp. */
const USER_CLOSED = { closeRequestedAt: 50 };

describe('wsSessionEndTone', () => {
  it('reads the settled pill: what the user asked for is neutral', () => {
    expect(wsSessionEndTone(makeSnapshot(), USER_CLOSED)).toBe('neutral');
    expect(wsSessionEndTone(makeSnapshot({ stopped: true }), null)).toBe('neutral');
    expect(wsSessionEndTone(makeSnapshot({ outcome: { kind: 'aborted' }, close: null }), USER_CLOSED)).toBe('neutral');
  });

  it('reads the settled pill: the server closing is warning, a failure or a missing Close frame error', () => {
    expect(wsSessionEndTone(makeSnapshot({ close: { code: 1008, reason: 'policy', wasClean: true } }), null)).toBe(
      'warning',
    );
    expect(wsSessionEndTone(makeSnapshot(), null)).toBe('warning');
    expect(wsSessionEndTone(makeSnapshot({ outcome: { kind: 'failed', error: 'refused' }, close: null }), null)).toBe(
      'error',
    );
    expect(wsSessionEndTone(makeSnapshot({ close: null }), null)).toBe('error');
    expect(wsSessionEndTone(makeSnapshot({ close: null, reconnectExhausted: { attempts: 5 } }), null)).toBe('error');
  });
});

describe('wsSessionPulse', () => {
  it('is dark before a session, in flight while dialing or redialing, landed once the handshake settles', () => {
    expect(wsSessionPulse(null, null, null, false, false)).toEqual({ inflight: false, landing: null });
    expect(wsSessionPulse(makeLive(), null, null, false, false)).toEqual({ inflight: true, landing: null });
    expect(wsSessionPulse(makeLive({ open: OPEN }), null, null, true, false)).toEqual({
      inflight: true,
      landing: null,
    });
    expect(wsSessionPulse(makeLive({ open: OPEN }), null, null, false, false)).toEqual({
      inflight: false,
      landing: 'success',
    });
  });

  it('keeps the connected landing through a send, and lands on the pill tone once settled', () => {
    expect(wsSessionPulse(makeLive({ open: OPEN }), null, null, false, true)).toEqual({
      inflight: true,
      landing: 'success',
    });
    expect(wsSessionPulse(null, makeSnapshot(), USER_CLOSED, false, false)).toEqual({
      inflight: false,
      landing: 'neutral',
    });
    expect(wsSessionPulse(null, makeSnapshot(), null, false, false)).toEqual({ inflight: false, landing: 'warning' });
    expect(wsSessionPulse(null, makeSnapshot({ close: null }), null, false, false)).toEqual({
      inflight: false,
      landing: 'error',
    });
  });
});

describe('SendPulseBar on a WebSocket session', () => {
  const at = (
    live: LiveWsSession | null,
    snapshot: ExecutedWsSnapshot | null,
    timing: { closeRequestedAt?: number } | null = null,
    reconnecting = false,
    sending = false,
  ) => <SendPulseBar {...wsSessionPulse(live, snapshot, timing, reconnecting, sending)} axis="x" />;

  it('sweeps while connecting, lands green, sweeps one whole pass for a send, then lands grey on Disconnect', () => {
    const { rerender } = render(at(makeLive(), null));
    expect(screen.getByTestId('oh-send-pulse').dataset.phase).toBe('inflight');

    rerender(at(makeLive({ open: OPEN }), null));
    expect(screen.getByTestId('oh-send-pulse').dataset.tone).toBe('success');
    fireEvent.animationEnd(screen.getByTestId('oh-send-pulse'));
    expect(screen.queryByTestId('oh-send-pulse')).toBeNull();

    rerender(at(makeLive({ open: OPEN }), null, null, false, true));
    expect(screen.getByTestId('oh-send-pulse').dataset.phase).toBe('inflight');
    rerender(at(makeLive({ open: OPEN }), null));
    expect(screen.getByTestId('oh-send-pulse').dataset.phase).toBe('inflight');
    fireEvent.animationIteration(screen.getByTestId('oh-send-pulse'));
    expect(screen.queryByTestId('oh-send-pulse')).toBeNull();

    rerender(at(null, makeSnapshot(), USER_CLOSED));
    expect(screen.getByTestId('oh-send-pulse').dataset.phase).toBe('settled');
    expect(screen.getByTestId('oh-send-pulse').dataset.tone).toBe('neutral');
  });

  it('lands amber when the server closes the open session', () => {
    const { rerender } = render(at(makeLive({ open: OPEN }), null));
    rerender(at(null, makeSnapshot({ close: { code: 1008, reason: 'policy', wasClean: true } })));
    expect(screen.getByTestId('oh-send-pulse').dataset.tone).toBe('warning');
  });

  it('plays the error line for a send the session refused', () => {
    const connected = makeLive({ open: OPEN });
    const { rerender } = render(
      <SendPulseBar {...wsSessionPulse(connected, null, null, false, true)} failures={0} axis="x" />,
    );
    rerender(<SendPulseBar {...wsSessionPulse(connected, null, null, false, false)} failures={1} axis="x" />);
    expect(screen.getByTestId('oh-send-pulse').dataset.phase).toBe('settled');
    expect(screen.getByTestId('oh-send-pulse').dataset.tone).toBe('error');
  });

  it('stays dark on a pane restored with its snapshot, failures counted or not', () => {
    render(<SendPulseBar {...wsSessionPulse(null, makeSnapshot(), null, false, false)} failures={3} axis="x" />);
    expect(screen.queryByTestId('oh-send-pulse')).toBeNull();
  });
});
