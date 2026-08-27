// @vitest-environment jsdom
/**
 * WsHeadersTab hides the handshake's auto-generated headers behind the
 * same "N hidden" toggle the HTTP editor uses, and reveals them as
 * read-only rows in wire order — Host, Connection, Upgrade, the
 * Sec-WebSocket-* trio — with the calculated placeholder where the
 * value only exists at connect time. The set follows the dialing host:
 * undici's WebSocket handshake on the desktop app and server, Chromium's
 * on a browser host — where custom rows also carry a not-sent
 * warning since the page's WebSocket API refuses handshake headers.
 */

import { registerCapability, unregisterCapability } from '@openheaders/core/capabilities';
import type { KeyValueRow } from '@openheaders/ui/workbench/components/request-editor/KeyValueTable';
import { makeKvRow } from '@openheaders/ui/workbench/components/request-editor/KeyValueTable';
import WsHeadersTab from '@openheaders/ui/workbench/components/websocket-request-editor/WsHeadersTab';
import '@openheaders/ui/workbench/settings/schema';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

beforeAll(() => {
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
  cleanup();
  unregisterCapability('requestRuntime');
});

describe('WsHeadersTab — auto-generated handshake headers', () => {
  it('counts the thirteen node handshake headers as hidden and shows none of them by default', () => {
    registerCapability('requestRuntime', () => 'node');
    const { container } = render(<WsHeadersTab rows={[] as KeyValueRow[]} onChange={vi.fn()} />);
    const text = container.textContent ?? '';
    expect(text).toContain('13 hidden');
    expect(text).not.toContain('Sec-WebSocket-Key');
    expect(text).not.toContain('browsers cannot set them');
  });

  it('reveals the handshake rows in wire order with the calculated placeholder on connect-time values', () => {
    registerCapability('requestRuntime', () => 'node');
    const { container } = render(<WsHeadersTab rows={[] as KeyValueRow[]} onChange={vi.fn()} />);
    fireEvent.click(screen.getByText('13 hidden'));
    const text = container.textContent ?? '';
    expect(text).toContain('Hide auto-generated headers');
    const order = [
      'Host',
      'Connection',
      'Upgrade',
      'Sec-WebSocket-Key',
      'Sec-WebSocket-Version',
      'Sec-WebSocket-Extensions',
    ];
    const positions = order.map((key) => text.indexOf(key));
    expect(positions.every((pos, i) => pos >= 0 && (i === 0 || pos > positions[i - 1]))).toBe(true);
    expect(text).toContain('websocket');
    expect(text).toContain('13');
    expect(text).toContain('permessage-deflate; client_max_window_bits');
    expect(text).toContain('<calculated when request is sent>');
    expect(text).toContain('OpenHeaders/');
    expect(text).toContain('Sec-Fetch-Mode');
  });

  it('on a node host a custom row carries no warning', () => {
    registerCapability('requestRuntime', () => 'node');
    render(<WsHeadersTab rows={[makeKvRow({ key: 'X-Token', value: 'abc', enabled: true })]} onChange={vi.fn()} />);
    expect(screen.queryByTestId('oh-kv-row-warning')).toBeNull();
  });

  it("on a browser host the hidden set is the browser's twelve and a custom row is marked not sent", async () => {
    registerCapability('requestRuntime', () => 'browser');
    const { container } = render(
      <WsHeadersTab rows={[makeKvRow({ key: 'X-Token', value: 'abc', enabled: true })]} onChange={vi.fn()} />,
    );
    expect(container.textContent ?? '').toContain('12 hidden');
    const [hoverTarget] = screen.getByTestId('oh-kv-row-warning').children;
    fireEvent.mouseEnter(hoverTarget);
    expect(await screen.findByText(/^Not sent/)).toBeTruthy();
    fireEvent.click(screen.getByText('12 hidden'));
    const text = container.textContent ?? '';
    expect(text).toContain('Origin');
    expect(text).toContain('User-Agent');
    expect(text).toContain('Accept-Language');
  });
});
