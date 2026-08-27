// @vitest-environment jsdom
/**
 * WsTargetRow is the URL alone — no flavor tag, no scheme lock — and
 * folds the structured params into the displayed URL the way the HTTP
 * bar does, so a row typed in the Params tab shows up as `?key=value`
 * without the executor's help.
 */

import { makeKvRow } from '@openheaders/ui/workbench/components/request-editor/KeyValueTable';
import type { WebSocketDraft } from '@openheaders/ui/workbench/components/websocket-request-editor/draft';
import WsTargetRow from '@openheaders/ui/workbench/components/websocket-request-editor/WsTargetRow';
import '@openheaders/ui/workbench/settings/schema';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  cleanup();
});

const draft: WebSocketDraft = {
  description: '',
  url: 'wss://events.openheaders.io/live',
  subprotocols: [],
  headers: [],
  params: [
    makeKvRow({ key: 'room', value: 'a', enabled: true }),
    makeKvRow({ key: 'off', value: 'x', enabled: false }),
  ],
  auth: { type: 'none' },
  events: [],
  message: '',
  eventName: '',
  namespace: '',
  ackEnabled: false,
  messageFormat: 'text',
  specLink: undefined,
  unixSocketPath: undefined,
  timeoutMs: undefined,
  sslVerification: true,
};

describe('WsTargetRow', () => {
  it('shows only the URL, with enabled params folded in and the HTTP placeholder', () => {
    const { container } = render(<WsTargetRow draft={draft} setDraft={vi.fn()} />);
    const input = screen.getByTestId('websocket-url-input');
    expect(input.textContent).toBe('wss://events.openheaders.io/live?room=a');
    expect(input.getAttribute('data-placeholder')).toBe('Enter URL or paste text');
    expect(container.querySelector('.ant-tag')).toBeNull();
    expect(screen.queryByTestId('websocket-scheme-lock')).toBeNull();
  });
});
