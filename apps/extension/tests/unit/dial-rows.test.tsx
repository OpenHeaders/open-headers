// @vitest-environment jsdom
/**
 * The shared dial block — one row set inside the Connection group of
 * the HTTP, WebSocket, gRPC and MQTT Settings tabs. Pins: the rows in
 * one order behind every prefix, the whole-value onChange with the
 * proxy PAIR write (Inherit / Direct clear the URL and its credential
 * ref, Custom keeps the URL), the URL and credential rows hiding while
 * the mode is not Custom, the modified predicate off the runtime
 * defaults, the address-pattern error and the proxy / pin conflict
 * warning in place, the dangling credential warning, the unsaved plane
 * the HTTP tab hands in, and the session drafts round-tripping the
 * four fields.
 */

import { registerCapability, unregisterCapability } from '@openheaders/core/capabilities';
import type { GrpcRequest, MqttRequest, WebSocketRequest } from '@openheaders/core/types';
import {
  buildGrpcRequestUpdates,
  draftFromGrpcRequest,
} from '@openheaders/ui/workbench/components/grpc-request-editor/draft';
import GrpcSettingsTab from '@openheaders/ui/workbench/components/grpc-request-editor/GrpcSettingsTab';
import { draftFromMqttRequest } from '@openheaders/ui/workbench/components/mqtt-request-editor/draft';
import MqttSettingsTab from '@openheaders/ui/workbench/components/mqtt-request-editor/MqttSettingsTab';
import SettingsTab from '@openheaders/ui/workbench/components/request-editor/SettingsTab';
import DialRows, { type DialValue, isDialModified } from '@openheaders/ui/workbench/components/shared/dial/DialRows';
import {
  buildWebSocketRequestUpdates,
  draftFromWebSocketRequest,
} from '@openheaders/ui/workbench/components/websocket-request-editor/draft';
import WebSocketSettingsTab from '@openheaders/ui/workbench/components/websocket-request-editor/WebSocketSettingsTab';
import { EditingScopeWorkspaceProvider } from '@openheaders/ui/workbench/hooks/EditingScopeWorkspaceContext';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

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

beforeEach(() => {
  registerCapability('requestRuntime', () => 'node');
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
  topics: [],
  savedMessages: [],
  userProperties: [],
};

const DIAL = { proxyMode: 'url' as const, proxyUrl: 'http://proxy.openheaders.io:8080' };

function scoped(node: React.ReactElement): React.ReactElement {
  return <EditingScopeWorkspaceProvider workspaceId="ws-1">{node}</EditingScopeWorkspaceProvider>;
}

function renderRows(value: DialValue, extra: Partial<React.ComponentProps<typeof DialRows>> = {}) {
  const onChange = vi.fn();
  render(
    scoped(<DialRows groupLabel="Connection" value={value} onChange={onChange} testIdPrefix="probe" {...extra} />),
  );
  return onChange;
}

function openCombobox(el: HTMLElement): void {
  fireEvent.mouseDown(el);
  fireEvent.click(el);
}

function pickOption(label: string): void {
  const option = screen.getAllByRole('option').find((o) => o.textContent === label);
  if (option === undefined) throw new Error(`no option ${label}`);
  fireEvent.click(option);
}

describe('DialRows — the shared rows', () => {
  it('renders the address pin and the proxy select; the URL and credentials rows hide while the mode is not Custom', () => {
    renderRows({});
    expect(screen.getByTestId('probe-resolve-to-address')).toBeTruthy();
    expect(screen.getByTestId('probe-proxy-mode')).toBeTruthy();
    expect(screen.queryByTestId('probe-proxy-url')).toBeNull();
    expect(screen.queryByTestId('probe-proxy-credentials')).toBeNull();
    cleanup();
    renderRows(DIAL);
    expect(screen.getByTestId('probe-proxy-url')).toBeTruthy();
    expect(screen.getByTestId('probe-proxy-credentials')).toBeTruthy();
  });

  it('writes the proxy PAIR: Direct and Inherit clear the URL and its credential ref, Custom keeps the URL', () => {
    const onChange = renderRows({ ...DIAL, proxyCredentialRef: 'corp-proxy', resolveToAddress: '10.0.0.12' });
    openCombobox(screen.getByRole('combobox', { name: 'Proxy' }));
    pickOption('Direct — no proxy');
    expect(onChange).toHaveBeenLastCalledWith({
      resolveToAddress: '10.0.0.12',
      proxyMode: 'direct',
      proxyUrl: undefined,
      proxyCredentialRef: undefined,
    });
    openCombobox(screen.getByRole('combobox', { name: 'Proxy' }));
    pickOption('Inherit — system decides');
    expect(onChange).toHaveBeenLastCalledWith({
      resolveToAddress: '10.0.0.12',
      proxyMode: undefined,
      proxyUrl: undefined,
      proxyCredentialRef: undefined,
    });
    fireEvent.change(screen.getByTestId('probe-resolve-to-address'), { target: { value: '10.0.0.13' } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ resolveToAddress: '10.0.0.13', ...DIAL }));
  });

  it('dots only off the runtime defaults', () => {
    expect(isDialModified({})).toBe(false);
    expect(isDialModified({ proxyMode: 'direct' })).toBe(true);
    expect(isDialModified({ resolveToAddress: '10.0.0.12' })).toBe(true);
    renderRows({});
    expect(screen.queryAllByTestId('oh-setting-modified-dot')).toHaveLength(0);
  });

  it('flags a malformed address, warns on a proxy beside the pin, and on a credential ref this device cannot resolve', () => {
    renderRows({ ...DIAL, resolveToAddress: 'backend.openheaders.io', proxyCredentialRef: 'corp-proxy' });
    expect(screen.getByText('IPv4 or IPv6 address only — no hostname, no port.')).toBeTruthy();
    expect(screen.getByText(/a proxy resolves the hostname itself/)).toBeTruthy();
    expect(screen.getByText(/No vault string entry named "corp-proxy"/)).toBeTruthy();
  });

  it('marks the rows the unsaved plane names', () => {
    renderRows(DIAL, { unsaved: new Set(['proxyUrl']) });
    expect(screen.getAllByTestId('oh-setting-unsaved-dot').length).toBeGreaterThan(0);
  });
});

describe('DialRows — on every Settings tab', () => {
  it('the HTTP tab renders the rows behind the request prefix and merges the pair write', () => {
    const onChange = vi.fn();
    render(scoped(<SettingsTab value={{ timeoutMs: 5_000, ...DIAL }} onChange={onChange} />));
    expect(screen.getByTestId('request-proxy-mode')).toBeTruthy();
    expect(screen.getByTestId('request-proxy-url')).toBeTruthy();
    openCombobox(screen.getByRole('combobox', { name: 'Proxy' }));
    pickOption('Direct — no proxy');
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ timeoutMs: 5_000, proxyMode: 'direct', proxyUrl: undefined }),
    );
  });

  it('the WebSocket tab seats the rows between the subprotocols and the socket path and merges the value', () => {
    const setDraft = vi.fn();
    const draft = draftFromWebSocketRequest(websocketRequest);
    render(scoped(<WebSocketSettingsTab draft={draft} setDraft={setDraft} socketioFlavor={false} />));
    const subprotocols = screen.getByTestId('websocket-subprotocols');
    const pin = screen.getByTestId('websocket-resolve-to-address');
    const socket = screen.getByTestId('websocket-unix-socket');
    expect(subprotocols.compareDocumentPosition(pin) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(pin.compareDocumentPosition(socket) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.change(pin, { target: { value: '10.0.0.12' } });
    const updater = setDraft.mock.calls[0]?.[0] as (d: typeof draft) => typeof draft;
    expect(updater(draft).resolveToAddress).toBe('10.0.0.12');
  });

  it('the gRPC and MQTT tabs render the rows behind their prefixes', () => {
    render(
      scoped(
        <GrpcSettingsTab
          draft={draftFromGrpcRequest(grpcRequest)}
          setDraft={() => {}}
          sendInvalidMessage={false}
          onSendInvalidMessageChange={() => {}}
        />,
      ),
    );
    expect(screen.getByTestId('grpc-proxy-mode')).toBeTruthy();
    cleanup();
    render(scoped(<MqttSettingsTab draft={draftFromMqttRequest(mqttRequest)} setDraft={() => {}} v5 />));
    expect(screen.getByTestId('mqtt-proxy-mode')).toBeTruthy();
    const pin = screen.getByTestId('mqtt-resolve-to-address');
    const timeout = screen.getByTestId('mqtt-timeout');
    expect(pin.compareDocumentPosition(timeout) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('the session drafts round-trip the four fields', () => {
    const ws = buildWebSocketRequestUpdates(
      draftFromWebSocketRequest({ ...websocketRequest, ...DIAL, proxyCredentialRef: 'corp-proxy' }),
    );
    expect(ws).toEqual(expect.objectContaining({ ...DIAL, proxyCredentialRef: 'corp-proxy' }));
    const grpc = buildGrpcRequestUpdates(draftFromGrpcRequest({ ...grpcRequest, resolveToAddress: '10.0.0.12' }));
    expect(grpc.resolveToAddress).toBe('10.0.0.12');
    expect(grpc.proxyMode).toBeUndefined();
  });
});
