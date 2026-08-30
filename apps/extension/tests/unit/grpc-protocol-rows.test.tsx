// @vitest-environment jsdom
/**
 * The gRPC protocol rows on the Settings tab (settings parity slice
 * 6). Pins: the Connection group carries the Authority row after the
 * Unix socket and closes on the keepalive pair — the timeout row
 * rides the interval (absent interval, no row; clearing the interval
 * clears the timeout); the node sheet lists one-connection-per-call
 * beside the compression and HTTP/2 facts; the draft round-trips the
 * three fields; the browser runtime keeps the rows and renders no
 * sheet.
 */

import { registerCapability, unregisterCapability } from '@openheaders/core/capabilities';
import type { GrpcRequest } from '@openheaders/core/types';
import {
  buildGrpcRequestUpdates,
  draftFromGrpcRequest,
  type GrpcDraft,
} from '@openheaders/ui/workbench/components/grpc-request-editor/draft';
import GrpcSettingsTab from '@openheaders/ui/workbench/components/grpc-request-editor/GrpcSettingsTab';
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

const grpcRequest = (overrides: Partial<GrpcRequest> = {}): GrpcRequest => ({
  schemaVersion: 5,
  uid: 'grpc0001',
  path: 'requests/library-grpc0001',
  name: 'Watch Books',
  url: 'grpc.openheaders.io:443',
  tls: true,
  method: { service: 'library.v1.Library', rpc: 'WatchBooks' },
  message: '{}',
  metadata: [],
  ...overrides,
});

function scoped(node: React.ReactElement): React.ReactElement {
  return <EditingScopeWorkspaceProvider workspaceId="ws-1">{node}</EditingScopeWorkspaceProvider>;
}

function renderTab(request: GrpcRequest) {
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

/** Apply the updater the tab handed `setDraft` to the rendered draft. */
function applied(setDraft: ReturnType<typeof vi.fn>, draft: GrpcDraft): GrpcDraft {
  const updater = setDraft.mock.calls[0]?.[0] as (d: GrpcDraft) => GrpcDraft;
  return updater(draft);
}

describe('gRPC tab — protocol rows', () => {
  it('seats the Authority row after the Unix socket and the keepalive ping after the response size limit', () => {
    renderTab(grpcRequest());
    expect(follows(screen.getByTestId('grpc-unix-socket'), screen.getByTestId('grpc-authority'))).toBe(true);
    expect(follows(screen.getByTestId('grpc-authority'), screen.getByTestId('grpc-timeout'))).toBe(true);
    expect(follows(screen.getByTestId('grpc-response-size-limit'), screen.getByTestId('grpc-keepalive-interval'))).toBe(
      true,
    );
    expect(screen.getByPlaceholderText('The target (default)')).toBeTruthy();
    expect(screen.getByText('No pings (default)')).toBeTruthy();
  });

  it('the keepalive timeout row rides the interval', () => {
    renderTab(grpcRequest());
    expect(screen.queryByTestId('grpc-keepalive-timeout')).toBeNull();
    cleanup();
    renderTab(grpcRequest({ keepaliveIntervalMs: 30_000 }));
    expect(follows(screen.getByTestId('grpc-keepalive-interval'), screen.getByTestId('grpc-keepalive-timeout'))).toBe(
      true,
    );
    expect(screen.getByText('20 s (default)')).toBeTruthy();
  });

  it('clearing the interval clears the timeout with it', () => {
    const { draft, setDraft } = renderTab(grpcRequest({ keepaliveIntervalMs: 30_000, keepaliveTimeoutMs: 5_000 }));
    fireEvent.click(screen.getByRole('button', { name: /reset keepalive ping/i }));
    const next = applied(setDraft, draft);
    expect(next.keepaliveIntervalMs).toBeUndefined();
    expect(next.keepaliveTimeoutMs).toBeUndefined();
  });

  it('the authority row writes the override and resets to the target', () => {
    const { draft, setDraft } = renderTab(grpcRequest());
    fireEvent.change(screen.getByTestId('grpc-authority'), { target: { value: 'gateway.openheaders.io' } });
    expect(applied(setDraft, draft).authority).toBe('gateway.openheaders.io');
  });

  it('on a node runtime lists one connection per call on the sheet beside the two earlier facts', () => {
    registerCapability('requestRuntime', () => 'node');
    renderTab(grpcRequest());
    fireEvent.click(screen.getByText('3 runtime-managed'));
    expect(screen.getByTestId('grpc-managed-connection-reuse').textContent).toContain('One per call');
    expect(
      follows(screen.getByTestId('grpc-managed-http-version'), screen.getByTestId('grpc-managed-connection-reuse')),
    ).toBe(true);
  });

  it('on a browser runtime keeps the rows and renders no sheet', () => {
    renderTab(grpcRequest());
    expect(screen.getByTestId('grpc-authority')).toBeTruthy();
    expect(screen.getByTestId('grpc-keepalive-interval')).toBeTruthy();
    expect(screen.queryByText(/runtime-managed/)).toBeNull();
    expect(screen.queryByText(/browser-managed/)).toBeNull();
  });

  it('the draft round-trips the three fields', () => {
    const updates = buildGrpcRequestUpdates(
      draftFromGrpcRequest(
        grpcRequest({ authority: 'gateway.openheaders.io', keepaliveIntervalMs: 30_000, keepaliveTimeoutMs: 5_000 }),
      ),
    );
    expect(updates.authority).toBe('gateway.openheaders.io');
    expect(updates.keepaliveIntervalMs).toBe(30_000);
    expect(updates.keepaliveTimeoutMs).toBe(5_000);
    const bare = buildGrpcRequestUpdates(draftFromGrpcRequest(grpcRequest()));
    expect(bare.authority).toBeUndefined();
    expect(bare.keepaliveIntervalMs).toBeUndefined();
    expect(bare.keepaliveTimeoutMs).toBeUndefined();
  });
});
