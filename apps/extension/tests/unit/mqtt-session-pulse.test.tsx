// @vitest-environment jsdom
/**
 * The MQTT session pane's send pulse — the bar sweeps while the session
 * dials or redials, lands on the success tint when a CONNACK takes,
 * sweeps one whole pass for a publish on the open session, and lands
 * on the end pill's tone when the session settles.
 */

import type { ExecutedMqttSnapshot } from '@openheaders/core/types';
import { mqttSessionPulse } from '@openheaders/ui/workbench/components/mqtt-request-editor/mqtt-session-pulse';
import { sessionEndTone } from '@openheaders/ui/workbench/components/mqtt-request-editor/session-display';
import type { LiveMqttSession } from '@openheaders/ui/workbench/components/mqtt-request-editor/useLiveMqttSession';
import { SendPulseBar } from '@openheaders/ui/workbench/components/request-editor/response/SendPulse';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// React registers onAnimationEnd under a vendor-prefixed name when the
// window lacks AnimationEvent, as jsdom's does.
vi.hoisted(() => {
  const scope = globalThis as unknown as { AnimationEvent?: typeof Event };
  if (typeof scope.AnimationEvent === 'undefined') scope.AnimationEvent = Event;
});

afterEach(cleanup);

function makeSnapshot(overrides: Partial<ExecutedMqttSnapshot> = {}): ExecutedMqttSnapshot {
  return {
    outcome: { kind: 'connected' },
    connack: { sessionPresent: false, reasonCode: 0 },
    clientId: 'oh-client',
    events: [],
    droppedMessages: 0,
    end: { by: 'client' },
    durationMs: 1200,
    ...overrides,
  };
}

function makeLive(overrides: Partial<LiveMqttSession> = {}): LiveMqttSession {
  return { open: null, startedAt: 1, items: [], count: 0, timestamps: [], ...overrides };
}

const OPEN: LiveMqttSession['open'] = { sessionPresent: false, reasonCode: 0, clientId: 'oh-client' };

describe('sessionEndTone', () => {
  it('reads the end pill: failures, the severed socket and the clean Disconnect on error', () => {
    expect(sessionEndTone(makeSnapshot({ outcome: { kind: 'failed', error: 'refused' }, end: null }))).toBe('error');
    expect(sessionEndTone(makeSnapshot({ end: null }))).toBe('error');
    expect(sessionEndTone(makeSnapshot({ end: { by: 'client' } }))).toBe('error');
    expect(sessionEndTone(makeSnapshot({ end: null, reconnectRefused: { attempt: 2, error: 'refused' } }))).toBe(
      'error',
    );
    expect(sessionEndTone(makeSnapshot({ end: null, reconnectExhausted: { attempts: 5 } }))).toBe('error');
  });

  it('reads a broker DISCONNECT and Stop on warning, a pre-open abort neutral', () => {
    expect(sessionEndTone(makeSnapshot({ end: { by: 'broker', reasonCode: 0x8e } }))).toBe('warning');
    expect(sessionEndTone(makeSnapshot({ stopped: true }))).toBe('warning');
    expect(sessionEndTone(makeSnapshot({ outcome: { kind: 'aborted' }, end: null }))).toBe('neutral');
  });
});

describe('mqttSessionPulse', () => {
  it('is dark before a session and in flight while dialing or redialing', () => {
    expect(mqttSessionPulse(null, null, false, false)).toEqual({ inflight: false, landing: null });
    expect(mqttSessionPulse(makeLive(), null, false, false)).toEqual({ inflight: true, landing: null });
    expect(mqttSessionPulse(makeLive({ open: OPEN }), null, true, false)).toEqual({ inflight: true, landing: null });
  });

  it('lands on success once the CONNACK takes and on the end tone once settled', () => {
    expect(mqttSessionPulse(makeLive({ open: OPEN }), null, false, false)).toEqual({
      inflight: false,
      landing: 'success',
    });
    expect(mqttSessionPulse(null, makeSnapshot(), false, false)).toEqual({ inflight: false, landing: 'error' });
    expect(mqttSessionPulse(null, makeSnapshot({ stopped: true }), false, false)).toEqual({
      inflight: false,
      landing: 'warning',
    });
  });

  it('keeps the connected landing through a publish — flight with no line at its end', () => {
    expect(mqttSessionPulse(makeLive({ open: OPEN }), null, false, true)).toEqual({
      inflight: true,
      landing: 'success',
    });
  });
});

describe('SendPulseBar on a session', () => {
  const at = (
    live: LiveMqttSession | null,
    snapshot: ExecutedMqttSnapshot | null,
    reconnecting = false,
    publishing = false,
  ) => <SendPulseBar {...mqttSessionPulse(live, snapshot, reconnecting, publishing)} axis="x" />;

  it('sweeps while connecting, lands green, sweeps again while reconnecting, lands again, then ends in the end tone', () => {
    const { rerender } = render(at(makeLive(), null));
    expect(screen.getByTestId('oh-send-pulse').dataset.phase).toBe('inflight');

    rerender(at(makeLive({ open: OPEN }), null));
    expect(screen.getByTestId('oh-send-pulse').dataset.phase).toBe('settled');
    expect(screen.getByTestId('oh-send-pulse').dataset.tone).toBe('success');
    fireEvent.animationEnd(screen.getByTestId('oh-send-pulse'));
    expect(screen.queryByTestId('oh-send-pulse')).toBeNull();

    rerender(at(makeLive({ open: OPEN }), null, true));
    expect(screen.getByTestId('oh-send-pulse').dataset.phase).toBe('inflight');

    rerender(at(makeLive({ open: OPEN }), null));
    expect(screen.getByTestId('oh-send-pulse').dataset.tone).toBe('success');

    rerender(at(null, makeSnapshot({ end: { by: 'broker', reasonCode: 0x8e } })));
    expect(screen.getByTestId('oh-send-pulse').dataset.phase).toBe('settled');
    expect(screen.getByTestId('oh-send-pulse').dataset.tone).toBe('warning');
    fireEvent.animationEnd(screen.getByTestId('oh-send-pulse'));
    expect(screen.queryByTestId('oh-send-pulse')).toBeNull();
  });

  it('sweeps one whole pass for a publish on the open session and plays no line', () => {
    const { rerender } = render(at(makeLive({ open: OPEN }), null));
    expect(screen.queryByTestId('oh-send-pulse')).toBeNull();

    rerender(at(makeLive({ open: OPEN }), null, false, true));
    const bar = screen.getByTestId('oh-send-pulse');
    expect(bar.dataset.phase).toBe('inflight');
    // A pass ending mid-publish does not shorten the one owed after it.
    fireEvent.animationIteration(bar);
    expect(bar.dataset.phase).toBe('inflight');

    // The ack lands before the pass ends — the sweep runs to its end.
    rerender(at(makeLive({ open: OPEN }), null, false, false));
    expect(screen.getByTestId('oh-send-pulse').dataset.phase).toBe('inflight');
    expect(screen.getByTestId('oh-send-pulse').dataset.tone).toBeUndefined();
    fireEvent.animationIteration(screen.getByTestId('oh-send-pulse'));
    expect(screen.queryByTestId('oh-send-pulse')).toBeNull();
  });

  it('lands on the end tone when the session ends mid-publish', () => {
    const { rerender } = render(at(makeLive({ open: OPEN }), null, false, true));
    rerender(at(null, makeSnapshot()));
    expect(screen.getByTestId('oh-send-pulse').dataset.phase).toBe('settled');
    expect(screen.getByTestId('oh-send-pulse').dataset.tone).toBe('error');
  });

  it('lands on the end tone straight from a dial that failed, and stays dark on a pane restored with its snapshot', () => {
    const { rerender } = render(at(makeLive(), null));
    rerender(at(null, makeSnapshot({ outcome: { kind: 'failed', error: 'refused' }, end: null })));
    expect(screen.getByTestId('oh-send-pulse').dataset.tone).toBe('error');
    cleanup();

    render(at(null, makeSnapshot()));
    expect(screen.queryByTestId('oh-send-pulse')).toBeNull();
  });
});
