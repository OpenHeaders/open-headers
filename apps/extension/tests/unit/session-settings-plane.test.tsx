// @vitest-environment jsdom
/**
 * The three session Settings tabs (WebSocket · MQTT · gRPC) on the
 * ANCESTOR PLANE — the request rows of the settings-inheritance
 * cascade: an inherited knob reads as the placeholder (a switch as its
 * effective state) with the "Inherited from …" line and the Edit in
 * parent opener; an own value shadows it (explicit wins — whatever
 * the value); the reset arrow clears back to inherit; the tab's draft
 * seam passes the tri-state knobs straight through (a toggle writes the
 * explicit boolean, a reset writes `undefined`, the request-only
 * strings keep their '' ↔ absent mapping).
 */

import { registerCapability, unregisterCapability } from '@openheaders/core/capabilities';
import type { GrpcRequest, InheritedSettingSource, MqttRequest, WebSocketRequest } from '@openheaders/core/types';
import { draftFromGrpcRequest } from '@openheaders/ui/workbench/components/grpc-request-editor/draft';
import GrpcSettingsTab from '@openheaders/ui/workbench/components/grpc-request-editor/GrpcSettingsTab';
import { draftFromMqttRequest } from '@openheaders/ui/workbench/components/mqtt-request-editor/draft';
import MqttSettingsTab from '@openheaders/ui/workbench/components/mqtt-request-editor/MqttSettingsTab';
import type { InheritedSettingsView } from '@openheaders/ui/workbench/components/shared/inherited-settings/inherited-settings';
import { draftFromWebSocketRequest } from '@openheaders/ui/workbench/components/websocket-request-editor/draft';
import WebSocketSettingsTab from '@openheaders/ui/workbench/components/websocket-request-editor/WebSocketSettingsTab';
import { EditingScopeWorkspaceProvider } from '@openheaders/ui/workbench/hooks/EditingScopeWorkspaceContext';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
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
  flavor: 'socketio',
  subprotocols: [],
  headers: [],
  params: [],
  message: '',
  ...overrides,
});

const mqttRequest = (overrides: Partial<MqttRequest> = {}): MqttRequest => ({
  schemaVersion: 5,
  uid: 'mqrq0001',
  path: 'requests/telemetry-mqrq0001',
  name: 'Telemetry',
  url: 'mqtts://broker.openheaders.io:8883',
  topic: 'devices/1/telemetry',
  payload: '{}',
  topics: [],
  savedMessages: [],
  userProperties: [],
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

/** A collection ‘Payments’ supplying `settings` — the view the editors
 *  derive off the request's ancestry. */
function collectionView(
  settings: InheritedSettingsView['settings'],
  onOpenSource?: InheritedSettingsView['onOpenSource'],
): InheritedSettingsView {
  const sources: InheritedSettingSource[] = (Object.keys(settings) as InheritedSettingSource['key'][]).map((key) => ({
    key,
    level: 'collection',
    uid: 'col00001',
    name: 'Payments',
  }));
  return { settings, sources, onOpenSource };
}

function scoped(node: React.ReactElement): React.ReactElement {
  return <EditingScopeWorkspaceProvider workspaceId="ws-1">{node}</EditingScopeWorkspaceProvider>;
}

/** The draft the tab's `setDraft` updater produces from `draft`. */
function nextDraft<D>(setDraft: ReturnType<typeof vi.fn>, draft: D): D {
  const updater = setDraft.mock.calls.at(-1)?.[0] as (d: D) => D;
  return updater(draft);
}

describe('WebSocket Settings tab on the ancestor plane', () => {
  it('inherited knobs read as placeholders / effective switches with the line and the opener; nothing dots', () => {
    registerCapability('requestRuntime', () => 'node');
    const onOpenSource = vi.fn();
    const draft = draftFromWebSocketRequest(websocketRequest());
    render(
      scoped(
        <WebSocketSettingsTab
          draft={draft}
          setDraft={vi.fn()}
          socketioFlavor
          inherited={collectionView(
            { timeoutMs: 30_000, sslVerification: false, autoReconnect: true, handshakePath: '/ws/' },
            onOpenSource,
          )}
        />,
      ),
    );
    expect(screen.getByText('30 s')).toBeTruthy();
    expect((screen.getByTestId('websocket-handshake-path') as HTMLInputElement).placeholder).toBe('/ws/');
    expect(screen.getByRole('switch', { name: 'SSL certificate verification' }).getAttribute('aria-checked')).toBe(
      'false',
    );
    // The dependent reconnect rows follow the EFFECTIVE switch — on.
    expect(screen.getByRole('switch', { name: 'Reconnect automatically' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByTestId('websocket-reconnect-period')).toBeTruthy();
    const notes = screen.getAllByTestId('oh-inherited-setting-note');
    // DOM order — the groups' order (Connection · resilience · Socket.IO · TLS).
    expect(notes.map((n) => n.getAttribute('data-key'))).toEqual([
      'timeoutMs',
      'autoReconnect',
      'handshakePath',
      'sslVerification',
    ]);
    fireEvent.click(within(notes[0]).getByTestId('oh-inherited-setting-edit-in-parent'));
    expect(onOpenSource).toHaveBeenCalledWith('collection', 'col00001', 'Payments');
    // Nothing inherited is the request's own — no reset on those rows
    // (the namespace, request-only, is the URL's own path and does reset).
    for (const label of [
      'Connect timeout',
      'SSL certificate verification',
      'Handshake path',
      'Reconnect automatically',
    ]) {
      expect(screen.queryByRole('button', { name: `Reset ${label} to default` })).toBeNull();
    }
  });

  it('a toggle on the plane writes the explicit boolean into the draft; reset writes undefined (inherit)', () => {
    registerCapability('requestRuntime', () => 'node');
    const setDraft = vi.fn();
    const draft = draftFromWebSocketRequest(websocketRequest({ flavor: 'raw' }));
    render(
      scoped(
        <WebSocketSettingsTab
          draft={draft}
          setDraft={setDraft}
          socketioFlavor={false}
          inherited={collectionView({ sslVerification: false })}
        />,
      ),
    );
    fireEvent.click(screen.getByRole('switch', { name: 'SSL certificate verification' }));
    // Explicit wins: the request now pins verification ON over the
    // collection's off — an explicit `true`, never a "default" absence.
    expect(nextDraft(setDraft, draft).sslVerification).toBe(true);
    cleanup();
    const own = draftFromWebSocketRequest(websocketRequest({ flavor: 'raw', sslVerification: true, timeoutMs: 5_000 }));
    render(
      scoped(
        <WebSocketSettingsTab
          draft={own}
          setDraft={setDraft}
          socketioFlavor={false}
          inherited={collectionView({ sslVerification: false, timeoutMs: 30_000 })}
        />,
      ),
    );
    expect(screen.queryByTestId('oh-inherited-setting-note')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Reset SSL certificate verification to default' }));
    expect(nextDraft(setDraft, own).sslVerification).toBeUndefined();
    fireEvent.click(screen.getByRole('button', { name: 'Reset Connect timeout to default' }));
    const cleared = nextDraft(setDraft, own);
    expect(cleared.timeoutMs).toBeUndefined();
    // The request-only namespace keeps its concrete '' spelling.
    expect(cleared.namespace).toBe('');
    expect(cleared.subprotocols).toEqual([]);
  });
});

describe('MQTT Settings tab on the ancestor plane', () => {
  it('an inherited Clean Start off reads as the effective switch with the line; a toggle writes explicit on; reset clears', () => {
    const setDraft = vi.fn();
    const draft = draftFromMqttRequest(mqttRequest());
    render(
      scoped(
        <MqttSettingsTab
          draft={draft}
          setDraft={setDraft}
          v5
          inherited={collectionView({ cleanStart: false, keepAlive: 30 })}
        />,
      ),
    );
    const cleanStart = screen.getByRole('switch', { name: 'Clean Start' });
    expect(cleanStart.getAttribute('aria-checked')).toBe('false');
    expect(screen.getByText('30 s')).toBeTruthy();
    expect(screen.getAllByTestId('oh-inherited-setting-note').map((n) => n.getAttribute('data-key'))).toEqual([
      'cleanStart',
      'keepAlive',
    ]);
    fireEvent.click(cleanStart);
    const toggled = nextDraft(setDraft, draft);
    expect(toggled.cleanStart).toBe(true);
    expect(toggled.clientId).toBe('');
    cleanup();
    const own = draftFromMqttRequest(mqttRequest({ cleanStart: true }));
    render(
      scoped(<MqttSettingsTab draft={own} setDraft={setDraft} v5 inherited={collectionView({ cleanStart: false })} />),
    );
    expect(screen.queryByTestId('oh-inherited-setting-note')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Reset Clean Start to default' }));
    expect(nextDraft(setDraft, own).cleanStart).toBeUndefined();
  });
});

describe('gRPC Settings tab on the ancestor plane', () => {
  it('inherited transport knobs read as placeholders with the line; an own timeout shadows and resets to inherit', () => {
    registerCapability('requestRuntime', () => 'node');
    const setDraft = vi.fn();
    const draft = draftFromGrpcRequest(grpcRequest());
    render(
      scoped(
        <GrpcSettingsTab
          draft={draft}
          setDraft={setDraft}
          sendInvalidMessage={false}
          onSendInvalidMessageChange={() => {}}
          inherited={collectionView({ timeoutMs: 30_000, keepaliveIntervalMs: 10_000, sslVerification: false })}
        />,
      ),
    );
    expect(screen.getByText('30 s')).toBeTruthy();
    // The keepalive timeout row rides the EFFECTIVE interval — inherited, so it renders.
    expect(screen.getByTestId('grpc-keepalive-timeout')).toBeTruthy();
    expect(screen.getByRole('switch', { name: 'SSL certificate verification' }).getAttribute('aria-checked')).toBe(
      'false',
    );
    // DOM order — Connection, then TLS & trust.
    expect(screen.getAllByTestId('oh-inherited-setting-note').map((n) => n.getAttribute('data-key'))).toEqual([
      'timeoutMs',
      'keepaliveIntervalMs',
      'sslVerification',
    ]);
    cleanup();
    const own = draftFromGrpcRequest(grpcRequest({ timeoutMs: 5_000 }));
    render(
      scoped(
        <GrpcSettingsTab
          draft={own}
          setDraft={setDraft}
          sendInvalidMessage={false}
          onSendInvalidMessageChange={() => {}}
          inherited={collectionView({ timeoutMs: 30_000 })}
        />,
      ),
    );
    expect((screen.getByRole('combobox', { name: 'Call timeout' }) as HTMLInputElement).value).toBe('5 s');
    expect(screen.queryByTestId('oh-inherited-setting-note')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Reset Call timeout to default' }));
    const cleared = nextDraft(setDraft, own);
    expect(cleared.timeoutMs).toBeUndefined();
    expect(cleared.sslVerification).toBeUndefined();
  });
});
