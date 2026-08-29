// @vitest-environment jsdom
/**
 * The Socket.IO protocol rows on the WebSocket settings tab. Pins:
 * the socketio flavor's group carries the protocol revision select
 * (v5 default, v4 for 1.x / 2.x servers) and the ack timeout after
 * the namespace, the Subprotocols row leaves with the flavor (engine.io
 * negotiates none) and no longer counts as a Connection modification,
 * the raw flavor shows neither; the draft round-trips both fields.
 */

import type { WebSocketRequest } from '@openheaders/core/types';
import {
  buildWebSocketRequestUpdates,
  draftFromWebSocketRequest,
} from '@openheaders/ui/workbench/components/websocket-request-editor/draft';
import WebSocketSettingsTab from '@openheaders/ui/workbench/components/websocket-request-editor/WebSocketSettingsTab';
import { EditingScopeWorkspaceProvider } from '@openheaders/ui/workbench/hooks/EditingScopeWorkspaceContext';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

const { mockUseTrustedRoots, mockUseDeviceTrust } = vi.hoisted(() => ({
  mockUseTrustedRoots: vi.fn(() => []),
  mockUseDeviceTrust: vi.fn(() => ({ certificates: [], ready: true })),
}));

vi.mock('@openheaders/ui/shared/device-trust', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@openheaders/ui/shared/device-trust')>()),
  useDeviceTrust: () => mockUseDeviceTrust(),
}));

vi.mock('@openheaders/ui/shared/hooks/readers/useTrustedRoots', () => ({
  useTrustedRoots: mockUseTrustedRoots,
}));

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

afterEach(cleanup);

const websocketRequest = (overrides: Partial<WebSocketRequest> = {}): WebSocketRequest => ({
  schemaVersion: 5,
  uid: 'wsrq0001',
  path: 'requests/live-events-wsrq0001',
  name: 'Live Events',
  url: 'wss://events.openheaders.io',
  flavor: 'socketio',
  subprotocols: [],
  headers: [],
  params: [],
  message: '',
  ...overrides,
});

function renderWsTab(request: WebSocketRequest) {
  const setDraft = vi.fn();
  const draft = draftFromWebSocketRequest(request);
  render(
    <EditingScopeWorkspaceProvider workspaceId="ws-1">
      <WebSocketSettingsTab draft={draft} setDraft={setDraft} socketioFlavor={request.flavor === 'socketio'} />
    </EditingScopeWorkspaceProvider>,
  );
  return { draft, setDraft };
}

const follows = (a: HTMLElement, b: HTMLElement): boolean =>
  (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

describe('WebSocket tab — Socket.IO protocol rows', () => {
  it('seats the protocol select and the ack timeout after the namespace, the v5 default as the placeholder', () => {
    renderWsTab(websocketRequest());
    const namespace = screen.getByTestId('websocket-namespace');
    const protocol = screen.getByTestId('websocket-socketio-protocol');
    const ack = screen.getByTestId('websocket-ack-timeout');
    expect(follows(namespace, protocol)).toBe(true);
    expect(follows(protocol, ack)).toBe(true);
    expect(screen.getByText('v5 (default)')).toBeTruthy();
    expect(screen.getByText('No timeout (default)')).toBeTruthy();
  });

  it('hides the Subprotocols row on the socketio flavor and shows it on raw', () => {
    renderWsTab(websocketRequest());
    expect(screen.queryByTestId('websocket-subprotocols')).toBeNull();
    cleanup();
    renderWsTab(websocketRequest({ flavor: 'raw', url: 'wss://events.openheaders.io/live' }));
    expect(screen.getByTestId('websocket-subprotocols')).toBeTruthy();
    expect(screen.queryByTestId('websocket-socketio-protocol')).toBeNull();
    expect(screen.queryByTestId('websocket-ack-timeout')).toBeNull();
  });

  it('picking v4 writes the revision 4 onto the draft; clearing it restores the default', () => {
    const { draft, setDraft } = renderWsTab(websocketRequest());
    const select = screen.getByRole('combobox', { name: 'Protocol' });
    fireEvent.mouseDown(select);
    fireEvent.click(select);
    fireEvent.click(screen.getByText('v4 — Socket.IO 1.x / 2.x servers'));
    const updater = setDraft.mock.calls[0]?.[0] as (d: typeof draft) => typeof draft;
    expect(updater(draft).socketioProtocol).toBe(4);
  });

  it('the draft round-trips both fields and reads absent as the defaults', () => {
    const tuned = websocketRequest({ socketioProtocol: 4, ackTimeoutMs: 5_000 });
    expect(buildWebSocketRequestUpdates(draftFromWebSocketRequest(tuned))).toMatchObject({
      socketioProtocol: 4,
      ackTimeoutMs: 5_000,
    });
    const bare = buildWebSocketRequestUpdates(draftFromWebSocketRequest(websocketRequest()));
    expect(bare.socketioProtocol).toBeUndefined();
    expect(bare.ackTimeoutMs).toBeUndefined();
  });
});
