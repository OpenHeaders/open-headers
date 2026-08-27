// @vitest-environment jsdom
/**
 * HeadersTab's auto-generated section follows the dialing host: a
 * browser host lists the page fetch's headers (Cache-Control first,
 * the browser's own User-Agent), a node host the undici client's
 * (no Cache-Control, User-Agent undici, Accept-Language and
 * Sec-Fetch-Mode) — every node row but Content-Length yielding to a
 * same-key user row.
 */

import { registerCapability, unregisterCapability } from '@openheaders/core/capabilities';
import type { AuthConfig, RequestBody } from '@openheaders/core/types';
import HeadersTab from '@openheaders/ui/workbench/components/request-editor/HeadersTab';
import type { KeyValueRow } from '@openheaders/ui/workbench/components/request-editor/KeyValueTable';
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

const NO_BODY: RequestBody = { type: 'none' };
const NO_AUTH: AuthConfig = { type: 'none' };

function renderTab(rows: KeyValueRow[] = []) {
  return render(<HeadersTab rows={rows} onChange={vi.fn()} body={NO_BODY} auth={NO_AUTH} onAuthChange={vi.fn()} />);
}

describe('HeadersTab — auto-generated rows per host', () => {
  it('on a browser host lists the page fetch headers with Cache-Control and the browser user agent', () => {
    registerCapability('requestRuntime', () => 'browser');
    const { container } = renderTab();
    fireEvent.click(screen.getByText('6 hidden'));
    const text = container.textContent ?? '';
    expect(text).toContain('Cache-Control');
    expect(text).toContain('Mozilla');
    expect(text).not.toContain('undici');
    expect(text).not.toContain('Sec-Fetch-Mode');
  });

  it('on a node host lists the undici client headers in wire order without Cache-Control', () => {
    registerCapability('requestRuntime', () => 'node');
    const { container } = renderTab();
    fireEvent.click(screen.getByText('7 hidden'));
    const text = container.textContent ?? '';
    expect(text).not.toContain('Cache-Control');
    expect(text).not.toContain('Mozilla');
    const order = [
      'Host',
      'Connection',
      'Accept',
      'Accept-Language',
      'Sec-Fetch-Mode',
      'User-Agent',
      'Accept-Encoding',
    ];
    const positions = order.map((key) => text.indexOf(key));
    expect(positions.every((pos, i) => pos >= 0 && (i === 0 || pos > positions[i - 1]))).toBe(true);
    expect(text).toContain('undici');
    expect(text).toContain('br, gzip, deflate');
    expect(text).toContain('cors');
  });
});
