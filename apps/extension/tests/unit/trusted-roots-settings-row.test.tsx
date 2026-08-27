// @vitest-environment jsdom
/**
 * The read-only trusted-certificates row in the four Settings TLS
 * groups (HTTP, WS, gRPC, MQTT) — the client-certificate picker's
 * shape with nothing to pick. Pins: the count on the control face
 * from the editing-scope workspace, the zero wording with the empty
 * popup line, the roots listed read-only (disabled options), the
 * footer link firing the shell's opener (and hiding without one), no
 * knob (no value, no dot), and the honest browser note on a non-node
 * host — the HTTP tab's via its browser-managed sheet row, the other
 * three via the disabled row and its caption.
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

const MANAGE = 'Manage trusted certificates';

function openPopup(): void {
  const combobox = screen.getByRole('combobox', { name: 'Trusted certificates' });
  fireEvent.mouseDown(combobox);
  fireEvent.click(combobox);
}

describe.each(TABS)('trusted-certificates line on the %s Settings tab (node runtime)', (kind) => {
  beforeEach(() => {
    registerCapability('requestRuntime', () => 'node');
  });

  it('counts the editing-scope workspace roots on the face and lists them read-only', () => {
    renderTab(kind, 'ws-two', () => {});
    expect(screen.getByText('Trusted certificates')).toBeTruthy();
    expect(screen.getByText('2 from this workspace')).toBeTruthy();
    expect(mockUseTrustedRoots).toHaveBeenCalledWith('ws-two');
    openPopup();
    const options = screen.getAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual(['Root r1', 'Root r2']);
    expect(options.every((o) => o.getAttribute('aria-disabled') === 'true')).toBe(true);
    expect(screen.getByRole('button', { name: MANAGE })).toBeTruthy();
  });

  it('reads None on the face and the empty line in the popup, same footer link', () => {
    renderTab(kind, 'ws-none', () => {});
    expect(screen.getByText('None from this workspace')).toBeTruthy();
    openPopup();
    expect(screen.getByText('No trusted certificates in this workspace yet.')).toBeTruthy();
    expect(screen.queryAllByRole('option')).toHaveLength(0);
    expect(screen.getByRole('button', { name: MANAGE })).toBeTruthy();
  });

  it('the footer fires the shell opener; without a shell the link is absent, the row stays', () => {
    const open = vi.fn();
    renderTab(kind, 'ws-two', open);
    openPopup();
    fireEvent.click(screen.getByRole('button', { name: MANAGE }));
    expect(open).toHaveBeenCalledTimes(1);

    cleanup();
    renderTab(kind, 'ws-two');
    expect(screen.getByText('2 from this workspace')).toBeTruthy();
    openPopup();
    expect(screen.queryByRole('button', { name: MANAGE })).toBeNull();
  });

  it('is a row, not a knob — no value, no switch, no dot', () => {
    renderTab(kind, 'ws-two', () => {});
    expect(screen.queryByRole('switch', { name: 'Trusted certificates' })).toBeNull();
    expect(screen.getByRole('combobox', { name: 'Trusted certificates' }).hasAttribute('disabled')).toBe(false);
    expect(screen.queryAllByTestId('oh-setting-modified-dot')).toHaveLength(0);
  });
});

describe('trusted-certificates line on a browser host', () => {
  it.each(['ws', 'grpc', 'mqtt'] as const)('%s tab disables the row and states the honest note, no count', (kind) => {
    renderTab(kind, 'ws-two', () => {});
    expect(screen.getByText('Trusted certificates')).toBeTruthy();
    expect(screen.getByText('Browser store')).toBeTruthy();
    expect(screen.getByText(/The browser verifies with its own trust store/)).toBeTruthy();
    expect(screen.queryByText('2 from this workspace')).toBeNull();
    expect(screen.getByRole('combobox', { name: 'Trusted certificates' }).hasAttribute('disabled')).toBe(true);
    expect(screen.queryByRole('button', { name: MANAGE })).toBeNull();
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
    expect(screen.queryByRole('button', { name: MANAGE })).toBeNull();
  });
});
