// @vitest-environment jsdom
/**
 * The limits rows and the runtime-managed sheet on the session tabs.
 * Pins: the WebSocket tab closes its Connection group on the max
 * message size (every runtime) and the handshake redirect pair (node
 * only; the max-redirects row rides the switch), the gRPC tab on the
 * response size limit; the shared sheet lists each tab's facts under
 * its own groups — the permessage-deflate offer, the socketio
 * flavor's WebSocket-only transport, the browser's never-followed
 * redirect, gRPC's no-compression + HTTP/2 — with the reveal copy
 * keyed off the runtime; the drafts round-trip the fields.
 */

import { registerCapability, unregisterCapability } from '@openheaders/core/capabilities';
import type { GrpcRequest, WebSocketRequest } from '@openheaders/core/types';
import {
  buildGrpcRequestUpdates,
  draftFromGrpcRequest,
} from '@openheaders/ui/workbench/components/grpc-request-editor/draft';
import GrpcSettingsTab from '@openheaders/ui/workbench/components/grpc-request-editor/GrpcSettingsTab';
import {
  buildWebSocketRequestUpdates,
  draftFromWebSocketRequest,
} from '@openheaders/ui/workbench/components/websocket-request-editor/draft';
import WebSocketSettingsTab from '@openheaders/ui/workbench/components/websocket-request-editor/WebSocketSettingsTab';
import { EditingScopeWorkspaceProvider } from '@openheaders/ui/workbench/hooks/EditingScopeWorkspaceContext';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
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

afterEach(() => {
  unregisterCapability('requestRuntime');
  cleanup();
});

const websocketRequest = (overrides: Partial<WebSocketRequest> = {}): WebSocketRequest => ({
  schemaVersion: 5,
  uid: 'wsrq0001',
  path: 'requests/live-events-wsrq0001',
  name: 'Live Events',
  url: 'wss://events.openheaders.io/live',
  flavor: 'raw',
  subprotocols: [],
  headers: [],
  params: [],
  message: '',
  ...overrides,
});

const grpcRequest = (overrides: Partial<GrpcRequest> = {}): GrpcRequest => ({
  schemaVersion: 5,
  uid: 'grpc0001',
  path: 'requests/library-grpc0001',
  name: 'Create Book',
  url: 'grpc.openheaders.io:443',
  tls: true,
  method: { service: 'library.v1.Library', rpc: 'CreateBook' },
  message: '{}',
  metadata: [],
  ...overrides,
});

function scoped(node: React.ReactElement): React.ReactElement {
  return <EditingScopeWorkspaceProvider workspaceId="ws-1">{node}</EditingScopeWorkspaceProvider>;
}

function renderWsTab(request: WebSocketRequest, socketioFlavor = false) {
  const setDraft = vi.fn();
  const draft = draftFromWebSocketRequest(request);
  render(scoped(<WebSocketSettingsTab draft={draft} setDraft={setDraft} socketioFlavor={socketioFlavor} />));
  return { draft, setDraft };
}

function renderGrpcTab(request: GrpcRequest) {
  const setDraft = vi.fn();
  const draft = draftFromGrpcRequest(request);
  render(
    scoped(
      <GrpcSettingsTab
        draft={draft}
        setDraft={setDraft}
        sendInvalidMessage={false}
        onSendInvalidMessageChange={() => {}}
      />,
    ),
  );
  return { draft, setDraft };
}

const follows = (a: HTMLElement, b: HTMLElement): boolean =>
  (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

describe('WebSocket tab — limits rows', () => {
  it('on a node runtime closes the Connection group on the size cap and the redirect switch; the cap row rides the switch', () => {
    registerCapability('requestRuntime', () => 'node');
    const { draft, setDraft } = renderWsTab(websocketRequest());
    const timeout = screen.getByTestId('websocket-timeout');
    const size = screen.getByTestId('websocket-max-message-size');
    const redirects = screen.getByTestId('websocket-follow-redirects');
    expect(follows(timeout, size)).toBe(true);
    expect(follows(size, redirects)).toBe(true);
    expect(screen.queryByTestId('websocket-max-redirects')).toBeNull();
    fireEvent.click(redirects);
    const updater = setDraft.mock.calls[0]?.[0] as (d: typeof draft) => typeof draft;
    expect(updater(draft).followRedirects).toBe(true);
  });

  it('shows the max-redirects row once the switch is on', () => {
    registerCapability('requestRuntime', () => 'node');
    renderWsTab(websocketRequest({ followRedirects: true, maxRedirects: 3 }));
    const cap = screen.getByTestId('websocket-max-redirects');
    expect(follows(screen.getByTestId('websocket-follow-redirects'), cap)).toBe(true);
  });

  it('on a browser runtime keeps the size cap and states the never-followed redirect on the sheet', () => {
    renderWsTab(websocketRequest());
    expect(screen.getByTestId('websocket-max-message-size')).toBeTruthy();
    expect(screen.queryByTestId('websocket-follow-redirects')).toBeNull();
    fireEvent.click(screen.getByText('2 browser-managed'));
    expect(screen.getByTestId('websocket-managed-compression').textContent).toContain('Offered');
    expect(screen.getByTestId('websocket-managed-follow-redirects').textContent).toContain('Never');
  });

  it('the node sheet lists the compression offer, and the socketio flavor its WebSocket-only transport under its group', () => {
    registerCapability('requestRuntime', () => 'node');
    renderWsTab(websocketRequest());
    fireEvent.click(screen.getByText('1 runtime-managed'));
    expect(screen.getByText(/Fixed by the app’s network runtime/)).toBeTruthy();
    expect(screen.getByTestId('websocket-managed-compression').textContent).toContain('Compression');
    expect(screen.queryByTestId('websocket-managed-transport')).toBeNull();
    cleanup();
    renderWsTab(websocketRequest({ flavor: 'socketio' }), true);
    fireEvent.click(screen.getByText('2 runtime-managed'));
    expect(screen.getByTestId('websocket-managed-transport').textContent).toContain('WebSocket only');
  });

  it('the draft round-trips the three fields; the redirect switch reads off by default', () => {
    const tuned = websocketRequest({ maxMessageBytes: 65_536, followRedirects: true, maxRedirects: 5 });
    const updates = buildWebSocketRequestUpdates(draftFromWebSocketRequest(tuned));
    expect(updates).toMatchObject({ maxMessageBytes: 65_536, followRedirects: true, maxRedirects: 5 });
    const bare = buildWebSocketRequestUpdates(draftFromWebSocketRequest(websocketRequest()));
    expect(bare.followRedirects).toBe(false);
    expect(bare.maxMessageBytes).toBeUndefined();
    expect(bare.maxRedirects).toBeUndefined();
  });
});

describe('gRPC tab — limits rows', () => {
  it('closes the Connection group on the response size limit and lists no-compression + HTTP/2 on the node sheet', () => {
    registerCapability('requestRuntime', () => 'node');
    renderGrpcTab(grpcRequest());
    expect(follows(screen.getByTestId('grpc-timeout'), screen.getByTestId('grpc-response-size-limit'))).toBe(true);
    fireEvent.click(screen.getByText('3 runtime-managed'));
    expect(screen.getByTestId('grpc-managed-compression').textContent).toContain('None');
    expect(screen.getByTestId('grpc-managed-http-version').textContent).toContain('HTTP/2');
  });

  it('on a browser runtime keeps the row and renders no sheet', () => {
    renderGrpcTab(grpcRequest());
    expect(screen.getByTestId('grpc-response-size-limit')).toBeTruthy();
    expect(screen.queryByText(/browser-managed/)).toBeNull();
  });

  it('the draft round-trips the response size limit', () => {
    const updates = buildGrpcRequestUpdates(draftFromGrpcRequest(grpcRequest({ maxResponseBytes: 4_096 })));
    expect(updates.maxResponseBytes).toBe(4_096);
    expect(buildGrpcRequestUpdates(draftFromGrpcRequest(grpcRequest())).maxResponseBytes).toBeUndefined();
  });
});
