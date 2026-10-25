// @vitest-environment jsdom
/**
 * SendPulse — the response pane's leading-edge bar: a looping primary
 * sweep while a send is in flight, then a full line in the status
 * pill's tone that fades, gone once the fade ends. An SSE stream rests
 * on its head's status tone once the head lands — no sweep across the
 * stream, nothing per event — and its end lands by whose doing it was:
 * the server's own close plays nothing, the user's Stop neutral, the
 * cap or deadline warning, a severed connection error.
 */

import type { ExecutedRequestSnapshot } from '@openheaders/core/types';
import SendPulse from '@openheaders/ui/workbench/components/request-editor/response/SendPulse';
import { sendPulseTone } from '@openheaders/ui/workbench/components/request-editor/response/send-pulse';
import type {
  LiveSendStream,
  LiveSseFeed,
} from '@openheaders/ui/workbench/components/request-editor/useLiveSendStream';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// React registers onAnimationEnd under a vendor-prefixed name when the
// window lacks AnimationEvent, as jsdom's does.
vi.hoisted(() => {
  const scope = globalThis as unknown as { AnimationEvent?: typeof Event };
  if (typeof scope.AnimationEvent === 'undefined') scope.AnimationEvent = Event;
});

afterEach(cleanup);

function makeSnapshot(overrides: Partial<ExecutedRequestSnapshot> = {}): ExecutedRequestSnapshot {
  return {
    status: 200,
    statusText: 'OK',
    url: 'https://api.openheaders.io/v1/ping',
    headers: [],
    body: '{}',
    bodyTruncated: false,
    bodyBytes: 2,
    durationMs: 42,
    error: null,
    ...overrides,
  };
}

function makeLiveSend(overrides: Partial<LiveSendStream> = {}): LiveSendStream {
  return {
    head: {
      status: 200,
      statusText: 'OK',
      url: 'https://api.openheaders.io/v1/events',
      headers: [{ key: 'content-type', value: 'text/event-stream' }],
    },
    startedAt: 1_000,
    tailText: '',
    totalBytes: 0,
    sse: null,
    ...overrides,
  };
}

function makeSseFeed(count = 0): LiveSseFeed {
  return { items: [], count, timestamps: [], connectedAt: 1_010 };
}

describe('sendPulseTone', () => {
  it('follows the status pill ranges', () => {
    expect(sendPulseTone(makeSnapshot({ status: 200 }))).toBe('success');
    expect(sendPulseTone(makeSnapshot({ status: 302, statusText: 'Found' }))).toBe('neutral');
    expect(sendPulseTone(makeSnapshot({ status: 404, statusText: 'Not Found' }))).toBe('warning');
    expect(sendPulseTone(makeSnapshot({ status: 500, statusText: 'Internal Server Error' }))).toBe('error');
  });

  it('reads a streamed capture by whose doing its end was, the server close leaving the status range', () => {
    const ended = (endedBy: NonNullable<ExecutedRequestSnapshot['streamedCapture']>['endedBy']) =>
      sendPulseTone(makeSnapshot({ streamedCapture: { endedBy } }));
    expect(ended('end')).toBe('success');
    expect(ended('stop')).toBe('neutral');
    expect(ended('cap')).toBe('warning');
    expect(ended('timeout')).toBe('warning');
    expect(ended('error')).toBe('error');
  });

  it('is error for a send that never completed or carries an error', () => {
    expect(sendPulseTone(makeSnapshot({ status: 0, statusText: '' }))).toBe('error');
    expect(sendPulseTone(makeSnapshot({ status: 200, error: 'aborted' }))).toBe('error');
  });

  it('is error for a 200 whose GraphQL envelope carries errors', () => {
    const errors = [{ message: 'Cannot query field', path: null, location: '1:3', code: null }];
    expect(sendPulseTone(makeSnapshot(), { errors, dataNull: true, extensionsJson: null })).toBe('error');
    expect(sendPulseTone(makeSnapshot(), { errors: [], dataNull: false, extensionsJson: null })).toBe('success');
  });

  it('is error for a 200 with a failed post-response assertion', () => {
    const scripts = (passed: boolean): ExecutedRequestSnapshot['scripts'] => ({
      postResponse: {
        succeeded: true,
        assertions: [{ name: 'status is 200', passed }],
        consoleLog: [],
        durationMs: 1,
      },
    });
    expect(sendPulseTone(makeSnapshot({ scripts: scripts(false) }))).toBe('error');
    expect(sendPulseTone(makeSnapshot({ scripts: scripts(true) }))).toBe('success');
  });
});

describe('SendPulse', () => {
  it('renders nothing before the first send', () => {
    render(<SendPulse sending={false} response={null} layout="vertical" />);
    expect(screen.queryByTestId('oh-send-pulse')).toBeNull();
  });

  it('sweeps in flight, settles in the status tone, then clears when the fade ends', () => {
    const { rerender } = render(<SendPulse sending={true} response={null} layout="vertical" />);
    const bar = screen.getByTestId('oh-send-pulse');
    expect(bar.dataset.phase).toBe('inflight');
    expect(bar.dataset.axis).toBe('x');
    expect(bar.dataset.tone).toBeUndefined();

    rerender(<SendPulse sending={false} response={makeSnapshot()} layout="vertical" />);
    expect(screen.getByTestId('oh-send-pulse').dataset.phase).toBe('settled');
    expect(screen.getByTestId('oh-send-pulse').dataset.tone).toBe('success');

    fireEvent.animationEnd(screen.getByTestId('oh-send-pulse'));
    expect(screen.queryByTestId('oh-send-pulse')).toBeNull();
  });

  it('settles in the warning tone for a 4xx and the error tone for a 5xx', () => {
    const { rerender } = render(<SendPulse sending={true} response={null} layout="vertical" />);
    rerender(<SendPulse sending={false} response={makeSnapshot({ status: 404 })} layout="vertical" />);
    expect(screen.getByTestId('oh-send-pulse').dataset.tone).toBe('warning');

    rerender(<SendPulse sending={true} response={null} layout="vertical" />);
    rerender(<SendPulse sending={false} response={makeSnapshot({ status: 500 })} layout="vertical" />);
    expect(screen.getByTestId('oh-send-pulse').dataset.tone).toBe('error');
  });

  it('runs along the pane edge in the side-by-side layout', () => {
    render(<SendPulse sending={true} response={null} layout="horizontal" />);
    expect(screen.getByTestId('oh-send-pulse').dataset.axis).toBe('y');
  });

  it('does not settle for a response that arrives without a send', () => {
    render(<SendPulse sending={false} response={makeSnapshot()} layout="vertical" />);
    expect(screen.queryByTestId('oh-send-pulse')).toBeNull();
  });

  /** Sends an SSE stream through its head landing and the events that
   *  follow, the bar dark again, then settles it the given way. */
  function streamSse(endedBy: NonNullable<ExecutedRequestSnapshot['streamedCapture']>['endedBy']): void {
    const { rerender } = render(
      <SendPulse sending={true} response={null} live={makeLiveSend({ head: null })} layout="vertical" />,
    );
    expect(screen.getByTestId('oh-send-pulse').dataset.phase).toBe('inflight');

    rerender(
      <SendPulse sending={true} response={null} live={makeLiveSend({ sse: makeSseFeed() })} layout="vertical" />,
    );
    const bar = screen.getByTestId('oh-send-pulse');
    expect(bar.dataset.phase).toBe('settled');
    expect(bar.dataset.tone).toBe('success');
    fireEvent.animationEnd(bar);
    expect(screen.queryByTestId('oh-send-pulse')).toBeNull();

    rerender(
      <SendPulse sending={true} response={null} live={makeLiveSend({ sse: makeSseFeed(21) })} layout="vertical" />,
    );
    expect(screen.queryByTestId('oh-send-pulse')).toBeNull();

    rerender(
      <SendPulse
        sending={false}
        response={makeSnapshot({ streamedCapture: { endedBy } })}
        live={null}
        layout="vertical"
      />,
    );
  }

  it('sweeps until an SSE head lands, rests on its status tone, plays nothing per event nor for the server close', () => {
    streamSse('end');
    expect(screen.queryByTestId('oh-send-pulse')).toBeNull();
  });

  it('lands an SSE stream the user stopped in the neutral tone', () => {
    streamSse('stop');
    expect(screen.getByTestId('oh-send-pulse').dataset.phase).toBe('settled');
    expect(screen.getByTestId('oh-send-pulse').dataset.tone).toBe('neutral');
  });

  it('lands an SSE stream the cap or the deadline ended in the warning tone', () => {
    streamSse('cap');
    expect(screen.getByTestId('oh-send-pulse').dataset.tone).toBe('warning');
    cleanup();
    streamSse('timeout');
    expect(screen.getByTestId('oh-send-pulse').dataset.tone).toBe('warning');
  });

  it('lands an SSE stream severed mid-body in the error tone', () => {
    streamSse('error');
    expect(screen.getByTestId('oh-send-pulse').dataset.tone).toBe('error');
  });

  it('keeps the sweep across a plain body stream whose head is not event-stream', () => {
    render(
      <SendPulse
        sending={true}
        response={null}
        live={makeLiveSend({
          head: { status: 200, statusText: 'OK', url: 'https://api.openheaders.io/v1/log', headers: [] },
        })}
        layout="vertical"
      />,
    );
    expect(screen.getByTestId('oh-send-pulse').dataset.phase).toBe('inflight');
  });
});
