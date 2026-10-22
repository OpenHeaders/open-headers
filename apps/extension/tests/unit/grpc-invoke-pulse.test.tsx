// @vitest-environment jsdom
/**
 * The gRPC result pane's send pulse — a unary invoke sweeps until its
 * snapshot lands in the status pill's tone; a streaming invoke rests on
 * the STREAMING tint from the moment it begins, sweeps one whole pass
 * per upstream message, and lands on the pill's tone at the end. The pill's tone itself: OK green, a server status red, the
 * user's own Stop grey.
 */

import type { ExecutedGrpcSnapshot } from '@openheaders/core/types';
import {
  grpcInvokePulse,
  grpcInvokeTone,
} from '@openheaders/ui/workbench/components/grpc-request-editor/grpc-invoke-pulse';
import {
  grpcDisplayStatus,
  grpcStatusTone,
} from '@openheaders/ui/workbench/components/grpc-request-editor/grpc-status-tone';
import type { LiveGrpcStream } from '@openheaders/ui/workbench/components/grpc-request-editor/useLiveGrpcStream';
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

function makeSnapshot(overrides: Partial<ExecutedGrpcSnapshot> = {}): ExecutedGrpcSnapshot {
  return {
    httpStatus: 200,
    headers: [],
    trailers: [{ key: 'grpc-status', value: '0' }],
    grpcStatus: 0,
    grpcStatusSource: 'trailers',
    messages: [],
    bodyTruncated: false,
    bodyBytes: 0,
    durationMs: 12,
    error: null,
    ...overrides,
  };
}

function makeLive(overrides: Partial<LiveGrpcStream> = {}): LiveGrpcStream {
  return {
    head: null,
    startedAt: 1,
    items: [],
    count: 0,
    timestamps: [],
    scriptMarks: [],
    scriptMarkTimestamps: [],
    ...overrides,
  };
}

const HEAD: LiveGrpcStream['head'] = { httpStatus: 200, headers: [] };

describe('grpcStatusTone', () => {
  it('shows the wire status, else the local code, else 1 CANCELLED for a Stop', () => {
    expect(grpcDisplayStatus({ status: 5 })).toBe(5);
    expect(grpcDisplayStatus({ status: null, localStatus: 14, error: 'refused' })).toBe(14);
    expect(grpcDisplayStatus({ status: null, stopped: true })).toBe(1);
    expect(grpcDisplayStatus({ status: null })).toBeNull();
  });

  it('paints OK green, a server or local status red, a failure red, a Stop or no status grey', () => {
    expect(grpcStatusTone({ status: 0 })).toBe('success');
    expect(grpcStatusTone({ status: 5 })).toBe('error');
    expect(grpcStatusTone({ status: null, localStatus: 14, error: 'refused' })).toBe('error');
    expect(grpcStatusTone({ status: null, error: 'refused' })).toBe('error');
    expect(grpcStatusTone({ status: null, connectionError: 'reset' })).toBe('error');
    expect(grpcStatusTone({ status: null, stopped: true })).toBe('neutral');
    // A Stop before the head: the local 1 CANCELLED beside the stop message.
    expect(grpcStatusTone({ status: null, localStatus: 1, error: 'Call stopped before a response arrived.' })).toBe(
      'neutral',
    );
    expect(grpcStatusTone({ status: null })).toBe('neutral');
    // A Stop after the server already answered keeps the server's word.
    expect(grpcStatusTone({ status: 1, stopped: true })).toBe('error');
  });
});

describe('grpcInvokeTone', () => {
  it('reads the snapshot through the pill, and a failed After response assertion as error', () => {
    expect(grpcInvokeTone(makeSnapshot())).toBe('success');
    expect(grpcInvokeTone(makeSnapshot({ grpcStatus: 3, grpcMessage: 'bad name' }))).toBe('error');
    expect(grpcInvokeTone(makeSnapshot({ grpcStatus: null, grpcStatusSource: null, stopped: true }))).toBe('neutral');
    expect(
      grpcInvokeTone(
        makeSnapshot({
          grpcStatus: null,
          grpcStatusSource: null,
          localStatus: 1,
          error: 'Call stopped before a response arrived.',
        }),
      ),
    ).toBe('neutral');
    const fold = (passed: boolean): ExecutedGrpcSnapshot['scripts'] => ({
      afterResponse: {
        succeeded: true,
        consoleLog: [],
        assertions: [{ name: 'has title', passed }],
        durationMs: 1,
        chain: [],
      },
    });
    expect(grpcInvokeTone(makeSnapshot({ scripts: fold(false) }))).toBe('error');
    expect(grpcInvokeTone(makeSnapshot({ scripts: fold(true) }))).toBe('success');
  });
});

describe('grpcInvokePulse', () => {
  it('is dark before an invoke, in flight during a unary invoke, landed on its snapshot', () => {
    expect(
      grpcInvokePulse({ invoking: false, response: null, responseShape: 'unary', live: null, sending: false }),
    ).toEqual({ inflight: false, landing: null });
    expect(
      grpcInvokePulse({ invoking: true, response: null, responseShape: 'unary', live: null, sending: false }),
    ).toEqual({ inflight: true, landing: null });
    expect(
      grpcInvokePulse({
        invoking: false,
        response: makeSnapshot(),
        responseShape: 'unary',
        live: null,
        sending: false,
      }),
    ).toEqual({ inflight: false, landing: 'success' });
  });

  it('on a stream: resting on info from the moment it begins, in flight only per upstream send', () => {
    const base = { invoking: true, response: null, responseShape: 'stream' as const };
    expect(grpcInvokePulse({ ...base, live: null, sending: false })).toEqual({ inflight: true, landing: null });
    expect(grpcInvokePulse({ ...base, live: makeLive(), sending: false })).toEqual({
      inflight: false,
      landing: 'info',
    });
    expect(grpcInvokePulse({ ...base, live: makeLive({ head: HEAD }), sending: false })).toEqual({
      inflight: false,
      landing: 'info',
    });
    expect(grpcInvokePulse({ ...base, live: makeLive({ head: HEAD }), sending: true })).toEqual({
      inflight: true,
      landing: 'info',
    });
  });
});

describe('SendPulseBar on a gRPC invoke', () => {
  it('sweeps through a unary invoke and lands red on a server status', () => {
    const { rerender } = render(
      <SendPulseBar
        {...grpcInvokePulse({ invoking: true, response: null, responseShape: 'unary', live: null, sending: false })}
        axis="x"
      />,
    );
    expect(screen.getByTestId('oh-send-pulse').dataset.phase).toBe('inflight');
    rerender(
      <SendPulseBar
        {...grpcInvokePulse({
          invoking: false,
          response: makeSnapshot({ grpcStatus: 5 }),
          responseShape: 'unary',
          live: null,
          sending: false,
        })}
        axis="x"
      />,
    );
    expect(screen.getByTestId('oh-send-pulse').dataset.phase).toBe('settled');
    expect(screen.getByTestId('oh-send-pulse').dataset.tone).toBe('error');
  });

  it('on a stream: lands blue as it begins, sweeps one pass per send, lands grey on Stop', () => {
    const at = (live: LiveGrpcStream | null, response: ExecutedGrpcSnapshot | null, sending = false) => (
      <SendPulseBar
        {...grpcInvokePulse({ invoking: response === null, response, responseShape: 'stream', live, sending })}
        axis="x"
      />
    );
    const { rerender } = render(at(null, null));
    expect(screen.getByTestId('oh-send-pulse').dataset.phase).toBe('inflight');

    rerender(at(makeLive(), null));
    expect(screen.getByTestId('oh-send-pulse').dataset.tone).toBe('info');
    fireEvent.animationEnd(screen.getByTestId('oh-send-pulse'));
    expect(screen.queryByTestId('oh-send-pulse')).toBeNull();

    rerender(at(makeLive({ head: HEAD }), null, true));
    expect(screen.getByTestId('oh-send-pulse').dataset.phase).toBe('inflight');
    rerender(at(makeLive({ head: HEAD }), null));
    expect(screen.getByTestId('oh-send-pulse').dataset.phase).toBe('inflight');
    fireEvent.animationIteration(screen.getByTestId('oh-send-pulse'));
    expect(screen.queryByTestId('oh-send-pulse')).toBeNull();

    rerender(at(null, makeSnapshot({ grpcStatus: null, grpcStatusSource: null, stopped: true })));
    expect(screen.getByTestId('oh-send-pulse').dataset.phase).toBe('settled');
    expect(screen.getByTestId('oh-send-pulse').dataset.tone).toBe('neutral');
  });
});
