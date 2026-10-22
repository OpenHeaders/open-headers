// @vitest-environment jsdom
/**
 * The GraphQL subscription's send pulse and pills — the bar sweeps
 * through the dial, init and ack, lands blue once subscribed, green
 * on the server's complete, red on its error or close, grey on Stop;
 * the socket pill under a subscription reads neutral for the
 * executor's own close and error for the server's.
 */

import { GRAPHQL_WS_INITIAL_STATE, type GraphqlWsClientState } from '@openheaders/core/graphql';
import type { ExecutedWsSnapshot } from '@openheaders/core/types';
import {
  graphqlSubscriptionEndTone,
  graphqlSubscriptionPulse,
  graphqlSubscriptionTone,
} from '@openheaders/ui/workbench/components/graphql-request-editor/graphql-subscription';
import { SendPulseBar } from '@openheaders/ui/workbench/components/request-editor/response/SendPulse';
import type { LiveWsSession } from '@openheaders/ui/workbench/components/websocket-request-editor/useLiveWsSession';
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
    protocol: 'graphql-transport-ws',
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

const OPEN: LiveWsSession['open'] = { protocol: 'graphql-transport-ws', extensions: '' };

function state(overrides: Partial<GraphqlWsClientState>): GraphqlWsClientState {
  return { ...GRAPHQL_WS_INITIAL_STATE, ...overrides };
}

const CONNECTING = state({ phase: 'connecting' });
const SUBSCRIBED = state({ phase: 'subscribed', events: 2 });
const COMPLETED = state({ phase: 'completed', events: 3, close: { code: 1000, reason: '' } });
const STOPPED = state({ phase: 'completed', stopped: true, close: { code: 1000, reason: '' } });
const ERRORED = state({ phase: 'errored', errors: [{ message: 'no such source' }], close: { code: 1000, reason: '' } });
const SERVER_CLOSED = state({ phase: 'closed', close: { code: 4401, reason: 'Unauthorized' } });

describe('graphqlSubscriptionTone', () => {
  it('reads the phase tag: live blue, completed green, error or server close red, Stop grey', () => {
    expect(graphqlSubscriptionTone(CONNECTING)).toBe('neutral');
    expect(graphqlSubscriptionTone(SUBSCRIBED)).toBe('info');
    expect(graphqlSubscriptionTone(COMPLETED)).toBe('success');
    expect(graphqlSubscriptionTone(STOPPED)).toBe('neutral');
    expect(graphqlSubscriptionTone(ERRORED)).toBe('error');
    expect(graphqlSubscriptionTone(SERVER_CLOSED)).toBe('error');
  });
});

describe('graphqlSubscriptionEndTone', () => {
  it("reads the socket pill: the executor's own close neutral, the server's close error", () => {
    expect(graphqlSubscriptionEndTone(COMPLETED, makeSnapshot(), null)).toBe('neutral');
    expect(graphqlSubscriptionEndTone(ERRORED, makeSnapshot(), null)).toBe('neutral');
    expect(graphqlSubscriptionEndTone(STOPPED, makeSnapshot(), { closeRequestedAt: 5 })).toBe('neutral');
    expect(
      graphqlSubscriptionEndTone(
        SERVER_CLOSED,
        makeSnapshot({ close: { code: 4401, reason: '', wasClean: true } }),
        null,
      ),
    ).toBe('error');
  });

  it("keeps the socket's own reading where the protocol never spoke", () => {
    const failed = makeSnapshot({ outcome: { kind: 'failed', error: 'refused' }, close: null });
    expect(graphqlSubscriptionEndTone(GRAPHQL_WS_INITIAL_STATE, failed, null)).toBe('error');
    const aborted = makeSnapshot({ outcome: { kind: 'aborted' }, close: null });
    expect(graphqlSubscriptionEndTone(GRAPHQL_WS_INITIAL_STATE, aborted, { closeRequestedAt: 5 })).toBe('neutral');
    expect(graphqlSubscriptionEndTone(SUBSCRIBED, makeSnapshot({ close: null }), null)).toBe('error');
  });
});

describe('graphqlSubscriptionPulse', () => {
  it('is in flight through the dial, init and ack, then rests on the phase tone', () => {
    expect(graphqlSubscriptionPulse(GRAPHQL_WS_INITIAL_STATE, null, null, null)).toEqual({
      inflight: false,
      landing: null,
    });
    expect(graphqlSubscriptionPulse(GRAPHQL_WS_INITIAL_STATE, makeLive(), null, null)).toEqual({
      inflight: true,
      landing: null,
    });
    expect(graphqlSubscriptionPulse(CONNECTING, makeLive({ open: OPEN }), null, null)).toEqual({
      inflight: true,
      landing: null,
    });
    expect(graphqlSubscriptionPulse(SUBSCRIBED, makeLive({ open: OPEN }), null, null)).toEqual({
      inflight: false,
      landing: 'info',
    });
  });

  it('lands on the protocol end once settled, on the socket where the protocol never spoke', () => {
    expect(graphqlSubscriptionPulse(COMPLETED, null, makeSnapshot(), null).landing).toBe('success');
    expect(graphqlSubscriptionPulse(ERRORED, null, makeSnapshot(), null).landing).toBe('error');
    expect(graphqlSubscriptionPulse(STOPPED, null, makeSnapshot(), { closeRequestedAt: 5 }).landing).toBe('neutral');
    const failed = makeSnapshot({ outcome: { kind: 'failed', error: 'refused' }, close: null });
    expect(graphqlSubscriptionPulse(GRAPHQL_WS_INITIAL_STATE, null, failed, null).landing).toBe('error');
    expect(graphqlSubscriptionPulse(SUBSCRIBED, null, makeSnapshot({ close: null }), null).landing).toBe('error');
  });
});

describe('SendPulseBar on a subscription', () => {
  const at = (s: GraphqlWsClientState, live: LiveWsSession | null, snapshot: ExecutedWsSnapshot | null) => (
    <SendPulseBar {...graphqlSubscriptionPulse(s, live, snapshot, null)} axis="x" />
  );

  it('sweeps to the ack, lands blue, lands green on the server complete, and plays nothing more at settle', () => {
    const { rerender } = render(at(GRAPHQL_WS_INITIAL_STATE, makeLive(), null));
    expect(screen.getByTestId('oh-send-pulse').dataset.phase).toBe('inflight');

    rerender(at(CONNECTING, makeLive({ open: OPEN }), null));
    expect(screen.getByTestId('oh-send-pulse').dataset.phase).toBe('inflight');

    rerender(at(SUBSCRIBED, makeLive({ open: OPEN }), null));
    expect(screen.getByTestId('oh-send-pulse').dataset.tone).toBe('info');
    fireEvent.animationEnd(screen.getByTestId('oh-send-pulse'));
    expect(screen.queryByTestId('oh-send-pulse')).toBeNull();

    rerender(at(state({ phase: 'completed', events: 3 }), makeLive({ open: OPEN }), null));
    expect(screen.getByTestId('oh-send-pulse').dataset.tone).toBe('success');
    fireEvent.animationEnd(screen.getByTestId('oh-send-pulse'));

    rerender(at(COMPLETED, null, makeSnapshot()));
    expect(screen.queryByTestId('oh-send-pulse')).toBeNull();
  });

  it('lands red when the server answers error, grey when the user stops', () => {
    const { rerender } = render(at(SUBSCRIBED, makeLive({ open: OPEN }), null));
    rerender(at(state({ phase: 'errored', errors: [] }), makeLive({ open: OPEN }), null));
    expect(screen.getByTestId('oh-send-pulse').dataset.tone).toBe('error');
    cleanup();

    const { rerender: again } = render(at(SUBSCRIBED, makeLive({ open: OPEN }), null));
    again(at(STOPPED, null, makeSnapshot()));
    expect(screen.getByTestId('oh-send-pulse').dataset.tone).toBe('neutral');
  });
});
