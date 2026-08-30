// @vitest-environment jsdom
/**
 * The shared TLS & trust block — one component on the HTTP, WebSocket,
 * gRPC and MQTT Settings tabs. Pins: the seven shared rows in one
 * order behind every prefix (and the MQTT tab's ALPN row after them),
 * the whole-value onChange with the session tabs keeping verification
 * concrete, the modified dots off the runtime defaults, the min/max
 * cross-disable, the cipher-list pattern error in place, the dangling
 * certificate warning, the unsaved plane the HTTP tab hands in, and
 * the SNI row's presence on the HTTP tab under the node runtime.
 */

import { registerCapability, unregisterCapability } from '@openheaders/core/capabilities';
import type { GrpcRequest, MqttRequest, WebSocketRequest } from '@openheaders/core/types';
import { draftFromGrpcRequest } from '@openheaders/ui/workbench/components/grpc-request-editor/draft';
import GrpcSettingsTab from '@openheaders/ui/workbench/components/grpc-request-editor/GrpcSettingsTab';
import { draftFromMqttRequest } from '@openheaders/ui/workbench/components/mqtt-request-editor/draft';
import MqttSettingsTab from '@openheaders/ui/workbench/components/mqtt-request-editor/MqttSettingsTab';
import SettingsTab from '@openheaders/ui/workbench/components/request-editor/SettingsTab';
import TlsTrustGroup, {
  isTlsTrustModified,
  type TlsTrustValue,
} from '@openheaders/ui/workbench/components/shared/tls-trust/TlsTrustGroup';
import { draftFromWebSocketRequest } from '@openheaders/ui/workbench/components/websocket-request-editor/draft';
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

const ROW_LABELS = [
  'SSL certificate verification',
  'Trusted certificates (CA)',
  'Client certificate (mTLS)',
  'TLS version minimum',
  'TLS version maximum',
  'TLS cipher suites',
  'SNI server name',
];

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

function scoped(node: React.ReactElement): React.ReactElement {
  return <EditingScopeWorkspaceProvider workspaceId="ws-1">{node}</EditingScopeWorkspaceProvider>;
}

function renderGroup(value: TlsTrustValue, extra: Partial<React.ComponentProps<typeof TlsTrustGroup>> = {}) {
  const onChange = vi.fn();
  render(
    scoped(
      <TlsTrustGroup
        groupLabel="TLS & trust"
        groupInfo={{ title: 'TLS & trust', summary: 'How trust is established.' }}
        expanded
        onToggle={() => {}}
        value={value}
        onChange={onChange}
        testIdPrefix="probe"
        {...extra}
      />,
    ),
  );
  return onChange;
}

/** The label column text of every row inside the group, in DOM order. */
function rowLabels(): string[] {
  return ROW_LABELS.filter((label) => screen.queryByText(label) !== null).sort((a, b) =>
    screen.getByText(a).compareDocumentPosition(screen.getByText(b)) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
  );
}

function openCombobox(el: HTMLElement): void {
  fireEvent.mouseDown(el);
  fireEvent.click(el);
}

describe('TlsTrustGroup — the shared rows', () => {
  it('renders the seven rows in one order behind the prefix', () => {
    renderGroup({});
    expect(rowLabels()).toEqual(ROW_LABELS);
    for (const suffix of [
      'ssl-verify',
      'client-certificate',
      'tls-min',
      'tls-max',
      'tls-cipher-suites',
      'sni-server-name',
    ]) {
      expect(screen.getByTestId(`probe-${suffix}`)).toBeTruthy();
    }
  });

  it('hands the WHOLE next value back — a reset clears verification to the default', () => {
    const onChange = renderGroup({ sslVerification: false, sniServerName: 'edge.openheaders.io' });
    fireEvent.click(screen.getByRole('switch', { name: 'SSL certificate verification' }));
    expect(onChange).toHaveBeenLastCalledWith({ sslVerification: true, sniServerName: 'edge.openheaders.io' });
    fireEvent.change(screen.getByTestId('probe-sni-server-name'), { target: { value: 'api.openheaders.io' } });
    expect(onChange).toHaveBeenLastCalledWith({ sslVerification: false, sniServerName: 'api.openheaders.io' });
  });

  it('dots only off the runtime defaults', () => {
    expect(isTlsTrustModified({})).toBe(false);
    expect(isTlsTrustModified({ sslVerification: true })).toBe(false);
    expect(isTlsTrustModified({ sslVerification: false })).toBe(true);
    expect(isTlsTrustModified({ tlsMaxVersion: '1.2' })).toBe(true);
    expect(isTlsTrustModified({ sniServerName: 'edge.openheaders.io' })).toBe(true);
    renderGroup({});
    expect(screen.queryAllByTestId('oh-setting-modified-dot')).toHaveLength(0);
  });

  it('cross-disables the version window and flags a malformed cipher list in place', () => {
    renderGroup({ tlsMaxVersion: '1.2', tlsCipherSuites: 'AES128 SHA' });
    openCombobox(screen.getByRole('combobox', { name: 'TLS version minimum' }));
    const thirteen = screen.getAllByRole('option').find((o) => o.textContent === '1.3');
    expect(thirteen?.getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByText('Colon-separated OpenSSL suite names only — no spaces.')).toBeTruthy();
  });

  it('warns on a certificate ref this device cannot resolve', () => {
    renderGroup({ clientCertificateRef: 'gateway-mtls' });
    expect(screen.getByText(/No vault certificate entry named "gateway-mtls"/)).toBeTruthy();
  });

  it('marks the rows the unsaved plane names', () => {
    renderGroup({ sniServerName: 'edge.openheaders.io' }, { unsaved: new Set(['sniServerName']) });
    expect(screen.getAllByTestId('oh-setting-unsaved-dot').length).toBeGreaterThan(0);
  });
});

describe('TlsTrustGroup — on every Settings tab', () => {
  it('the HTTP tab renders the block with the SNI row and merges its value', () => {
    const onChange = vi.fn();
    render(scoped(<SettingsTab value={{ timeoutMs: 5_000 }} onChange={onChange} />));
    expect(rowLabels()).toEqual(ROW_LABELS);
    fireEvent.change(screen.getByTestId('request-sni-server-name'), { target: { value: 'edge.openheaders.io' } });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ timeoutMs: 5_000, sniServerName: 'edge.openheaders.io' }),
    );
  });

  it('the WebSocket tab keeps verification concrete when the block resets it', () => {
    const setDraft = vi.fn();
    const draft = { ...draftFromWebSocketRequest(websocketRequest), sslVerification: false };
    render(scoped(<WebSocketSettingsTab draft={draft} setDraft={setDraft} socketioFlavor={false} />));
    expect(rowLabels()).toEqual(ROW_LABELS);
    fireEvent.click(screen.getByRole('switch', { name: 'SSL certificate verification' }));
    const updater = setDraft.mock.calls[0]?.[0] as (d: typeof draft) => typeof draft;
    expect(updater(draft).sslVerification).toBe(true);
    expect(screen.getByTestId('websocket-tls-cipher-suites')).toBeTruthy();
  });

  it('the gRPC tab renders the block', () => {
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
    expect(rowLabels()).toEqual(ROW_LABELS);
    expect(screen.getByTestId('grpc-ssl-verify')).toBeTruthy();
  });

  it('the MQTT tab renders the block with its ALPN row after the shared ones', () => {
    render(scoped(<MqttSettingsTab draft={draftFromMqttRequest(mqttRequest)} setDraft={() => {}} v5 />));
    expect(rowLabels()).toEqual(ROW_LABELS);
    const alpn = screen.getByText('ALPN protocol');
    const sni = screen.getByText('SNI server name');
    expect(sni.compareDocumentPosition(alpn) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByTestId('mqtt-ssl-verify')).toBeTruthy();
    expect(screen.getByTestId('mqtt-alpn-protocol')).toBeTruthy();
  });
});
