// @vitest-environment jsdom
/**
 * The read-only trusted-certificates line in the four Settings TLS
 * groups (HTTP, WS, gRPC, MQTT). Pins: the count from the
 * editing-scope workspace, the zero wording with the same link, the
 * Manage link firing the shell's opener (and hiding without one), no
 * knob (no switch, no dot), and the honest browser note on a non-node
 * host — the HTTP tab's via its browser-managed sheet row, the other
 * three via the row itself.
 */

import { registerCapability, unregisterCapability } from '@openheaders/core/capabilities';
import type { GrpcRequest, MqttRequest, TrustedRoot, WebSocketRequest } from '@openheaders/core/types';
import { draftFromGrpcRequest } from '@openheaders/ui/workbench/components/grpc-request-editor/draft';
import GrpcSettingsTab from '@openheaders/ui/workbench/components/grpc-request-editor/GrpcSettingsTab';
import { draftFromMqttRequest } from '@openheaders/ui/workbench/components/mqtt-request-editor/draft';
import MqttSettingsTab from '@openheaders/ui/workbench/components/mqtt-request-editor/MqttSettingsTab';
import SettingsTab from '@openheaders/ui/workbench/components/request-editor/SettingsTab';
import { draftFromWebSocketRequest } from '@openheaders/ui/workbench/components/websocket-request-editor/draft';
import WebSocketSettingsTab from '@openheaders/ui/workbench/components/websocket-request-editor/WebSocketSettingsTab';
import { EditingScopeWorkspaceProvider } from '@openheaders/ui/workbench/hooks/EditingScopeWorkspaceContext';
import { OpenTrustedRootsProvider } from '@openheaders/ui/workbench/hooks/OpenTrustedRootsContext';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockUseTrustedRoots } = vi.hoisted(() => ({ mockUseTrustedRoots: vi.fn() }));

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

function makeRoot(uid: string): TrustedRoot {
  return {
    uid,
    name: `Root ${uid}`,
    certPem: `-----BEGIN CERTIFICATE-----\n${uid}\n-----END CERTIFICATE-----`,
    addedAt: '2026-08-27T00:00:00.000Z',
  };
}

const ROOTS_BY_WORKSPACE: Record<string, TrustedRoot[]> = {
  'ws-two': [makeRoot('r1'), makeRoot('r2')],
  'ws-none': [],
};

beforeEach(() => {
  mockUseTrustedRoots.mockReset();
  mockUseTrustedRoots.mockImplementation((workspaceId: string | null) =>
    workspaceId === null ? [] : (ROOTS_BY_WORKSPACE[workspaceId] ?? []),
  );
});

afterEach(() => {
  unregisterCapability('requestRuntime');
  cleanup();
});

const websocketRequest: WebSocketRequest = {
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
  messageFormat: 'json',
};

const grpcRequest: GrpcRequest = {
  schemaVersion: 5,
  uid: 'grpc0001',
  path: 'requests/library-grpc0001',
  name: 'Create Book',
  url: 'grpc.openheaders.io:443',
  tls: true,
  method: { service: 'library.v1.Library', rpc: 'CreateBook' },
  message: '{}',
  metadata: [],
};

const mqttRequest: MqttRequest = {
  schemaVersion: 5,
  uid: 'mqrq0001',
  path: 'requests/lighting-mqrq0001',
  name: 'Lighting',
  url: 'mqtts://broker.openheaders.io:8883',
  topic: 'streetlights/1/lumens',
  payload: '',
  payloadFormat: 'json',
  qos: 0,
  retain: false,
  topics: [],
  savedMessages: [],
  userProperties: [],
};

type TabKind = 'http' | 'ws' | 'grpc' | 'mqtt';

function tabElement(kind: TabKind): React.ReactElement {
  switch (kind) {
    case 'http':
      return <SettingsTab value={{}} onChange={() => {}} />;
    case 'ws':
      return (
        <WebSocketSettingsTab
          draft={draftFromWebSocketRequest(websocketRequest)}
          setDraft={() => {}}
          socketioFlavor={false}
        />
      );
    case 'grpc':
      return (
        <GrpcSettingsTab
          draft={draftFromGrpcRequest(grpcRequest)}
          setDraft={() => {}}
          sendInvalidMessage={false}
          onSendInvalidMessageChange={() => {}}
        />
      );
    case 'mqtt':
      return <MqttSettingsTab draft={draftFromMqttRequest(mqttRequest)} setDraft={() => {}} v5 />;
  }
}

function renderTab(kind: TabKind, workspaceId: string, openTrustedRoots?: () => void) {
  const scoped = (
    <EditingScopeWorkspaceProvider workspaceId={workspaceId}>{tabElement(kind)}</EditingScopeWorkspaceProvider>
  );
  return render(
    openTrustedRoots ? (
      <OpenTrustedRootsProvider openTrustedRoots={openTrustedRoots}>{scoped}</OpenTrustedRootsProvider>
    ) : (
      scoped
    ),
  );
}

const TABS: TabKind[] = ['http', 'ws', 'grpc', 'mqtt'];

describe.each(TABS)('trusted-certificates line on the %s Settings tab (node runtime)', (kind) => {
  beforeEach(() => {
    registerCapability('requestRuntime', () => 'node');
  });

  it('counts the editing-scope workspace roots and offers Manage', () => {
    renderTab(kind, 'ws-two', () => {});
    expect(screen.getByText('Trusted certificates')).toBeTruthy();
    expect(screen.getByText('2 from this workspace')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Manage' })).toBeTruthy();
    expect(mockUseTrustedRoots).toHaveBeenCalledWith('ws-two');
  });

  it('reads None with the same link when the workspace has no roots', () => {
    renderTab(kind, 'ws-none', () => {});
    expect(screen.getByText('None from this workspace')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Manage' })).toBeTruthy();
  });

  it('Manage fires the shell opener; without a shell the link is absent, the line stays', () => {
    const open = vi.fn();
    renderTab(kind, 'ws-two', open);
    fireEvent.click(screen.getByRole('button', { name: 'Manage' }));
    expect(open).toHaveBeenCalledTimes(1);

    cleanup();
    renderTab(kind, 'ws-two');
    expect(screen.getByText('2 from this workspace')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Manage' })).toBeNull();
  });

  it('is a line, not a knob — no switch, no dot', () => {
    renderTab(kind, 'ws-two', () => {});
    expect(screen.queryByRole('switch', { name: 'Trusted certificates' })).toBeNull();
    expect(screen.queryAllByTestId('oh-setting-modified-dot')).toHaveLength(0);
  });
});

describe('trusted-certificates line on a browser host', () => {
  it.each(['ws', 'grpc', 'mqtt'] as const)('%s tab states the honest note with no count and no link', (kind) => {
    renderTab(kind, 'ws-two', () => {});
    expect(screen.getByText('Trusted certificates')).toBeTruthy();
    expect(screen.getByText(/The browser verifies with its own trust store/)).toBeTruthy();
    expect(screen.queryByText('2 from this workspace')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Manage' })).toBeNull();
    // The list is never read for a host that cannot apply it.
    expect(mockUseTrustedRoots).toHaveBeenCalledWith(null);
  });

  it('http tab carries the note as a browser-managed sheet row', () => {
    renderTab('http', 'ws-two', () => {});
    expect(screen.queryByText('Trusted certificates')).toBeNull();
    fireEvent.click(screen.getByText('11 browser-managed'));
    const row = screen.getByTestId('oh-managed-trusted-roots-row');
    expect(row.textContent).toContain('Trusted certificates');
    expect(row.textContent).toContain('Browser store');
    expect(screen.queryByRole('button', { name: 'Manage' })).toBeNull();
  });
});
