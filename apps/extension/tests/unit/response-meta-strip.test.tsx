// @vitest-environment jsdom
/**
 * ResponseMetaStrip tags — the per-run policy tags beside status/time/
 * size. Warning tags mark trust-relaxing policies the send ran under
 * (unverified TLS, lowered TLS floor, Authorization forwarded); the
 * cookie-jar tag is ATTRIBUTION — neutral tone — shown when the
 * snapshot recorded jar activity (`cookieHeaderAttached` /
 * `cookiesCaptured`), never read from live jar state.
 */

import { registerCapability, unregisterCapability } from '@openheaders/core/capabilities';
import type { ResourceTimingEntry } from '@openheaders/core/resource-timing';
import type { ExecutedRequestSnapshot } from '@openheaders/core/types';
import ResponseMetaStrip from '@openheaders/ui/workbench/components/request-editor/response/ResponseMetaStrip';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

beforeAll(() => {
  // The popover legs mount antd Popover content, whose resize tracking
  // needs a ResizeObserver jsdom does not ship (the scripts-tab-info
  // idiom).
  class ResizeObserverStub implements ResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  const scope = globalThis as unknown as { ResizeObserver?: typeof ResizeObserver };
  if (typeof scope.ResizeObserver === 'undefined') {
    scope.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
  }
});

afterEach(() => {
  unregisterCapability('requestRuntime');
  cleanup();
});

function makeTimingEntry(overrides: Partial<ResourceTimingEntry> = {}): ResourceTimingEntry {
  return {
    name: 'https://api.openheaders.io/v1/ping',
    initiatorType: 'fetch',
    nextHopProtocol: 'h2',
    startTime: 0,
    duration: 42,
    workerStart: 0,
    redirectStart: 0,
    redirectEnd: 0,
    fetchStart: 0,
    domainLookupStart: 0,
    domainLookupEnd: 0,
    connectStart: 0,
    connectEnd: 0,
    secureConnectionStart: 0,
    requestStart: 0,
    responseStart: 0,
    firstInterimResponseStart: 0,
    finalResponseHeadersStart: 0,
    responseEnd: 42,
    transferSize: 0,
    encodedBodySize: 0,
    decodedBodySize: 0,
    deliveryType: '',
    ...overrides,
  };
}

function makeSnapshot(overrides: Partial<ExecutedRequestSnapshot> = {}): ExecutedRequestSnapshot {
  return {
    status: 200,
    statusText: 'OK',
    url: 'https://api.openheaders.io/v1/ping',
    headers: [{ key: 'content-type', value: 'application/json' }],
    body: '{}',
    bodyTruncated: false,
    bodyBytes: 2,
    durationMs: 42,
    error: null,
    ...overrides,
  };
}

function renderStrip(overrides: Partial<ExecutedRequestSnapshot> = {}) {
  return render(<ResponseMetaStrip response={makeSnapshot(overrides)} />);
}

describe('ResponseMetaStrip status chip', () => {
  it('keeps the server-sent reason phrase', () => {
    renderStrip();
    expect(screen.getByTestId('oh-response-status').textContent).toBe('200 OK');
  });

  it('falls back to the canonical phrase when the wire carried none (HTTP/2)', () => {
    renderStrip({ status: 404, statusText: '' });
    expect(screen.getByTestId('oh-response-status').textContent).toBe('404 Not Found');
  });

  it('shows the bare code for a code with no curated phrase', () => {
    renderStrip({ status: 599, statusText: '' });
    expect(screen.getByTestId('oh-response-status').textContent).toBe('599');
  });
});

describe('ResponseMetaStrip cookie-jar attribution', () => {
  it('shows no cookie-jar tag on a run without jar activity', () => {
    renderStrip();
    expect(screen.queryByTestId('oh-response-cookie-jar')).toBeNull();
  });

  it('tags a run whose jar attached a Cookie header', () => {
    renderStrip({ cookieHeaderAttached: 'session=abc123' });
    expect(screen.getByTestId('oh-response-cookie-jar').textContent).toBe('Cookie jar');
  });

  it('tags a run whose jar only stored cookies', () => {
    renderStrip({ cookiesCaptured: ['session', 'theme'] });
    expect(screen.getByTestId('oh-response-cookie-jar')).toBeTruthy();
  });

  it('renders the jar tag neutral, unlike the warning-toned policy tags', () => {
    renderStrip({ cookieHeaderAttached: 'session=abc123', authorizationForwarded: true });
    expect(screen.getByTestId('oh-response-cookie-jar').className).not.toContain('ant-tag-warning');
    expect(screen.getByTestId('oh-response-auth-forwarded').className).toContain('ant-tag-warning');
  });

  it('shows no policy tags at all on a plain run', () => {
    renderStrip();
    expect(screen.queryByTestId('oh-response-tls-unverified')).toBeNull();
    expect(screen.queryByTestId('oh-response-tls-floor-lowered')).toBeNull();
    expect(screen.queryByTestId('oh-response-auth-forwarded')).toBeNull();
  });
});

describe('ResponseMetaStrip redirect-chain attribution', () => {
  it('shows no redirects tag on a run without the rider', () => {
    renderStrip();
    expect(screen.queryByTestId('oh-response-redirects')).toBeNull();
  });

  it('shows no redirects tag when the rider is an empty list', () => {
    renderStrip({ redirectChain: [] });
    expect(screen.queryByTestId('oh-response-redirects')).toBeNull();
  });

  it('tags a redirected run with the hop count, neutral tone', () => {
    renderStrip({
      redirectChain: [
        {
          url: 'https://api.openheaders.io/v1/ping',
          method: 'GET',
          status: 302,
          statusText: 'Found',
          location: '/v2/ping',
        },
        {
          url: 'https://api.openheaders.io/v2/ping',
          method: 'GET',
          status: 302,
          statusText: 'Found',
          location: '/v3/ping',
        },
      ],
    });
    const tag = screen.getByTestId('oh-response-redirects');
    expect(tag.textContent).toBe('2 redirects');
    expect(tag.className).not.toContain('ant-tag-warning');
  });

  it('pluralizes a single hop', () => {
    renderStrip({
      redirectChain: [
        { url: 'https://api.openheaders.io/v1/ping', method: 'GET', status: 301, statusText: '', location: '/v2' },
      ],
    });
    expect(screen.getByTestId('oh-response-redirects').textContent).toBe('1 redirect');
  });
});

describe('ResponseMetaStrip proxy-route attribution', () => {
  it('shows no proxy tag on a run without the rider', () => {
    renderStrip();
    expect(screen.queryByTestId('oh-response-proxy-route')).toBeNull();
  });

  it('shows no proxy tag when the plane decided plain direct', () => {
    renderStrip({ proxyRoute: { plane: 'system', source: 'env' } });
    expect(screen.queryByTestId('oh-response-proxy-route')).toBeNull();
  });

  it('tags a proxied run neutral — attribution, not a warning', () => {
    renderStrip({
      proxyRoute: { plane: 'system', source: 'system', proxyUrl: 'http://proxy.openheaders.io:3128' },
    });
    const tag = screen.getByTestId('oh-response-proxy-route');
    expect(tag.textContent).toBe('Proxied');
    expect(tag.className).not.toContain('ant-tag-warning');
  });

  it('tags a request-plane proxied run the same way', () => {
    renderStrip({ proxyRoute: { plane: 'request', proxyUrl: 'http://proxy.openheaders.io:3128' } });
    expect(screen.getByTestId('oh-response-proxy-route').textContent).toBe('Proxied');
  });

  it('tags an ambient stand-down as bypassed — the send went direct', () => {
    renderStrip({ proxyRoute: { plane: 'system', source: 'env', standDownReason: 'unix-socket' } });
    expect(screen.getByTestId('oh-response-proxy-route').textContent).toBe('Proxy bypassed');
  });
});

describe('ResponseMetaStrip streamed-capture attribution', () => {
  it('shows no streamed tag on a run without the rider', () => {
    renderStrip();
    expect(screen.queryByTestId('oh-response-streamed')).toBeNull();
  });

  it('tags a user-stopped capture neutral — the user asked for the partial body', () => {
    renderStrip({ streamedCapture: { endedBy: 'stop' } });
    const tag = screen.getByTestId('oh-response-streamed');
    expect(tag.textContent).toBe('Stopped');
    expect(tag.className).not.toContain('ant-tag-warning');
  });

  it('tags a naturally-ended stream neutral (the capture is complete)', () => {
    renderStrip({ streamedCapture: { endedBy: 'end' } });
    const tag = screen.getByTestId('oh-response-streamed');
    expect(tag.textContent).toBe('Stream ended');
    expect(tag.className).not.toContain('ant-tag-warning');
  });

  it('labels timeout / cap / error ends distinctly, warning-toned (surprise ends)', () => {
    renderStrip({ streamedCapture: { endedBy: 'timeout' } });
    expect(screen.getByTestId('oh-response-streamed').textContent).toBe('Timed out mid-stream');
    expect(screen.getByTestId('oh-response-streamed').className).toContain('ant-tag-warning');
    cleanup();
    renderStrip({ streamedCapture: { endedBy: 'cap' } });
    expect(screen.getByTestId('oh-response-streamed').textContent).toBe('Stream capped');
    cleanup();
    renderStrip({ streamedCapture: { endedBy: 'error', message: 'connection reset' } });
    expect(screen.getByTestId('oh-response-streamed').textContent).toBe('Stream failed');
  });
});

describe('ResponseMetaStrip time and size facts', () => {
  it('rolls the duration up past a minute instead of raw ms', () => {
    renderStrip({ durationMs: 104_642 });
    expect(screen.getByTestId('oh-response-duration').textContent).toBe('1 m 44.6 s');
  });

  it('keeps short durations in ms', () => {
    renderStrip();
    expect(screen.getByTestId('oh-response-duration').textContent).toBe('42 ms');
  });

  it('shows the captured bytes for a streamed capture even when a timing entry reports a transfer size', () => {
    renderStrip({
      streamedCapture: { endedBy: 'stop' },
      bodyBytes: 4096,
      timing: makeTimingEntry({ transferSize: 300 }),
    });
    expect(screen.getByText('4.0 KB')).toBeTruthy();
  });

  it('leads with the wire transfer size on an ordinary (non-streamed) run', () => {
    renderStrip({ bodyBytes: 4096, timing: makeTimingEntry({ transferSize: 300 }) });
    expect(screen.getByText('300 B')).toBeTruthy();
  });
});

describe('ResponseMetaStrip size popover notes', () => {
  const requestSize = { headersBytes: 196, bodyBytes: 0 };

  it('names the runtime as the header-adding actor on a node send — and drops the wire-sizes note', async () => {
    registerCapability('requestRuntime', () => 'node');
    renderStrip({ requestSize });
    fireEvent.mouseEnter(screen.getByText('2 B'));
    expect(await screen.findByText(/the runtime adds its own/)).toBeTruthy();
    expect(screen.queryByText(/the browser adds its own/)).toBeNull();
    expect(screen.queryByText(/not reported by the app/)).toBeNull();
  });

  it('keeps the browser actor and the TAO-gated wire-sizes note on a browser send', async () => {
    renderStrip({ requestSize });
    fireEvent.mouseEnter(screen.getByText('2 B'));
    expect(await screen.findByText(/the browser adds its own/)).toBeTruthy();
    expect(screen.getByText(/no Timing-Allow-Origin/)).toBeTruthy();
  });
});

describe('ResponseMetaStrip timing popover honesty note', () => {
  it('drops the folded-into-Waiting note when the ladder carries instrumented legs — the QUIC shape included', async () => {
    renderStrip({ phaseTimings: { dnsMs: 56, tlsMs: 239, waitingMs: 125, downloadMs: 1 } });
    fireEvent.mouseEnter(screen.getByTestId('oh-response-duration'));
    expect(await screen.findByText('TLS handshake')).toBeTruthy();
    expect(screen.queryByText(/not observable per send/)).toBeNull();
  });

  it('keeps the note on an uninstrumented node ladder — the legs really do sit inside Waiting', async () => {
    renderStrip({ phaseTimings: { waitingMs: 100, downloadMs: 5 } });
    fireEvent.mouseEnter(screen.getByTestId('oh-response-duration'));
    expect(await screen.findByText(/not observable per send/)).toBeTruthy();
  });
});
