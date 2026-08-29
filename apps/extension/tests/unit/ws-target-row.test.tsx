// @vitest-environment jsdom
/**
 * WsTargetRow is the URL alone — no flavor tag, no scheme lock — and
 * folds the structured params into the displayed URL the way the HTTP
 * bar does, so a row typed in the Params tab shows up as `?key=value`
 * without the executor's help.
 */

import { makeKvRow } from '@openheaders/ui/workbench/components/request-editor/KeyValueTable';
import SessionLock from '@openheaders/ui/workbench/components/shared/SessionLock';
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
  savedMessages: [],
  message: '',
  eventName: '',
  namespace: '',
  handshakePath: '',
  ackEnabled: false,
  messageFormat: 'text',
  binaryEncoding: 'base64',
  specLink: undefined,
  unixSocketPath: undefined,
  timeoutMs: undefined,
  sslVerification: true,
  clientCertificateRef: undefined,
  tlsMinVersion: undefined,
  tlsMaxVersion: undefined,
  tlsCipherSuites: undefined,
  sniServerName: undefined,
};

describe('WsTargetRow', () => {
  it('shows only the URL, with enabled params folded in and the HTTP placeholder', () => {
    const { container } = render(<WsTargetRow draft={draft} setDraft={vi.fn()} socketioFlavor={false} />);
    const input = screen.getByTestId('websocket-url-input');
    expect(input.textContent).toBe('wss://events.openheaders.io/live?room=a');
    expect(input.getAttribute('data-placeholder')).toBe('Enter URL or paste text');
    expect(container.querySelector('.ant-tag')).toBeNull();
    expect(screen.queryByTestId('websocket-scheme-lock')).toBeNull();
  });

  it('freezes the URL under a session lock — no caret, no focus, disabled styling', () => {
    render(
      <SessionLock locked>
        <WsTargetRow draft={draft} setDraft={vi.fn()} socketioFlavor={false} />
      </SessionLock>,
    );
    const input = screen.getByTestId('websocket-url-input');
    expect(input.getAttribute('contenteditable')).toBe('false');
    expect(input.getAttribute('tabindex')).toBe('-1');
    expect(input.getAttribute('aria-disabled')).toBe('true');
    expect(input.classList.contains('oh-template-input-editable--disabled')).toBe(true);
    expect(input.textContent).toBe('wss://events.openheaders.io/live?room=a');
  });

  it('joins the namespace onto the authority on the socketio flavor — a slashless namespace gains its slash', () => {
    render(
      <WsTargetRow
        draft={{ ...draft, url: 'wss://events.openheaders.io', namespace: 'admin' }}
        setDraft={vi.fn()}
        socketioFlavor
      />,
    );
    expect(screen.getByTestId('websocket-url-input').textContent).toBe('wss://events.openheaders.io/admin?room=a');
  });
});
