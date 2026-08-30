// @vitest-environment jsdom
/**
 * The example cards behind every Settings-tab (i) on the session and
 * call editors — the HTTP tab's send card brought to the WebSocket
 * session (flavor-aware), the gRPC call and the MQTT session. Pins:
 * each editor's own rows light their token on their own card; the
 * shared blocks' rows (dial, TLS & trust, resilience) carry the
 * blocks' rich copy — the Versions and Format glossaries, the dial
 * leg swapped into the slot — under the editor's card; the Socket.IO
 * flavor drops the subprotocol and heartbeat tokens for the handshake
 * ones; the runtime-managed sheet's facts light theirs; a popover
 * carrying a card widens to the card width.
 */

import { registerCapability, unregisterCapability } from '@openheaders/core/capabilities';
import type { GrpcRequest, MqttRequest, WebSocketRequest } from '@openheaders/core/types';
import { draftFromGrpcRequest } from '@openheaders/ui/workbench/components/grpc-request-editor/draft';
import GrpcSettingsTab from '@openheaders/ui/workbench/components/grpc-request-editor/GrpcSettingsTab';
import { draftFromMqttRequest } from '@openheaders/ui/workbench/components/mqtt-request-editor/draft';
import MqttSettingsTab from '@openheaders/ui/workbench/components/mqtt-request-editor/MqttSettingsTab';
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

const grpcRequest: GrpcRequest = {
  schemaVersion: 5,
  uid: 'grpc0001',
  path: 'requests/library-grpc0001',
  name: 'Watch Books',
  url: 'grpc.openheaders.io:443',
  tls: true,
  method: { service: 'library.v1.Library', rpc: 'WatchBooks' },
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

function renderWebSocket(socketio = false) {
  const request = websocketRequest(socketio ? { flavor: 'socketio' } : {});
  render(
    scoped(
      <WebSocketSettingsTab draft={draftFromWebSocketRequest(request)} setDraft={() => {}} socketioFlavor={socketio} />,
    ),
  );
}

function renderGrpc() {
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
}

function renderMqtt() {
  render(scoped(<MqttSettingsTab draft={draftFromMqttRequest(mqttRequest)} setDraft={() => {}} v5 />));
}

/** Highlighted example-card tokens of the currently open popover. */
const litTokens = (): string[] =>
  Array.from(document.querySelectorAll('.oh-info-eg-hl')).map((el) => el.textContent ?? '');

/** Every token of the currently open popover's card. */
const cardTokens = (): string[] =>
  Array.from(document.querySelectorAll('.oh-info-eg-tok')).map((el) => el.textContent ?? '');

const kicker = (): string | undefined => document.querySelector('.oh-info-popover-kicker')?.textContent ?? undefined;

const popoverWidth = (): string | undefined =>
  (document.querySelector('.oh-info-popover') as HTMLElement | null)?.style.maxWidth;

async function open(name: string): Promise<void> {
  fireEvent.click(screen.getByRole('button', { name }));
  await screen.findByText(/^Example (session|call|send)$/);
}

describe('WebSocket Settings tab — the session card', () => {
  it('an own row lights its token on the session card, and the popover widens to the card', async () => {
    renderWebSocket();
    await open('About Subprotocols');
    expect(screen.getByText('Example session')).toBeTruthy();
    expect(kicker()).toBe('Connection');
    expect(litTokens()).toEqual(['proto: graphql-transport-ws']);
    expect(popoverWidth()).toBe('520px');
  });

  it('a shared TLS row carries the block’s glossary under the card', async () => {
    renderWebSocket();
    await open('About TLS version minimum');
    expect(kicker()).toBe('TLS & trust');
    expect(litTokens()).toEqual(['TLS 1.2–1.3']);
    expect(screen.getByText('Versions')).toBeTruthy();
    expect(screen.getByText('The default floor.')).toBeTruthy();
  });

  it('a dial row swaps the dial slot to its own leg and lights it', async () => {
    renderWebSocket();
    await open('About Proxy');
    expect(litTokens()).toEqual(['proxy corp.example:8080 (system)']);
    expect(screen.getByText('Modes')).toBeTruthy();
  });

  it('a resilience row lights its token; the raw flavor carries the heartbeat tokens', async () => {
    renderWebSocket();
    await open('About Heartbeat message');
    expect(kicker()).toBe('Session resilience');
    expect(litTokens()).toEqual(['heartbeat: ping']);
    expect(cardTokens()).toContain('every 30 s');
  });

  it('the group header lights the group’s whole slice', async () => {
    renderWebSocket();
    await open('About Session resilience');
    expect(litTokens()).toEqual([
      'reconnect: every 5 s',
      'retry ≤ 10 · backoff',
      'idle ≤ 60 s',
      'heartbeat: ping',
      'every 30 s',
    ]);
  });

  it('the Socket.IO flavor swaps the handshake in for the subprotocol and heartbeat tokens', async () => {
    renderWebSocket(true);
    await open('About Namespace');
    expect(kicker()).toBe('Socket.IO');
    expect(litTokens()).toEqual(['ns: /admin']);
    const tokens = cardTokens();
    expect(tokens).toContain('wss://api.openheaders.com/admin');
    expect(tokens).toContain('transport: websocket');
    expect(tokens).not.toContain('proto: graphql-transport-ws');
    expect(tokens).not.toContain('heartbeat: ping');
  });

  it('the Socket.IO idle row reads the handshake-cadence copy under the card', async () => {
    renderWebSocket(true);
    await open('About Idle timeout');
    expect(litTokens()).toEqual(['idle ≤ 60 s']);
    expect(document.querySelector('.oh-info-popover-summary')?.textContent).toMatch(/handshake/i);
  });

  it('a runtime-managed fact lights its token on the same card', async () => {
    renderWebSocket();
    fireEvent.click(screen.getByRole('button', { name: /runtime-managed/ }));
    await open('About Compression');
    expect(litTokens()).toEqual(['deflate: offered']);
  });
});

describe('gRPC Settings tab — the call card', () => {
  it('an own row lights its token on the call card', async () => {
    renderGrpc();
    await open('About Authority');
    expect(screen.getByText('Example call')).toBeTruthy();
    expect(kicker()).toBe('Connection');
    expect(litTokens()).toEqual([':authority api.openheaders.com']);
    expect(popoverWidth()).toBe('520px');
  });

  it('the keepalive row lights the ping cadence', async () => {
    renderGrpc();
    await open('About Keepalive ping');
    expect(litTokens()).toEqual(['ping every 30 s']);
  });

  it('a shared TLS row carries the block’s glossary under the card', async () => {
    renderGrpc();
    await open('About TLS cipher suites');
    expect(kicker()).toBe('TLS & trust');
    expect(litTokens()).toEqual(['TLS_AES_128_GCM_SHA256']);
    expect(screen.getByText('Format')).toBeTruthy();
  });

  it('a dial row swaps the dial slot to its own leg', async () => {
    renderGrpc();
    await open('About Resolve to address');
    expect(litTokens()).toEqual(['dial 203.0.113.42']);
  });

  it('the group headers partition the card', async () => {
    renderGrpc();
    await open('About Connection');
    expect(litTokens()).toEqual([
      'direct',
      ':authority api.openheaders.com',
      'deadline 30 s',
      'reply ≤ 2 MB',
      'ping every 30 s',
      'pong ≤ 20 s',
    ]);
  });

  it('a runtime-managed fact lights its token on the same card', async () => {
    renderGrpc();
    fireEvent.click(screen.getByRole('button', { name: /runtime-managed/ }));
    await open('About Connection reuse');
    expect(litTokens()).toEqual(['1 connection per call']);
  });
});

describe('MQTT Settings tab — the session card on the shared rows', () => {
  it('a shared TLS row lights the window on the session card with the block’s glossary', async () => {
    renderMqtt();
    await open('About TLS version minimum');
    expect(screen.getByText('Example session')).toBeTruthy();
    expect(kicker()).toBe('TLS & trust');
    expect(litTokens()).toEqual(['TLS 1.2–1.3']);
    expect(screen.getByText('Versions')).toBeTruthy();
    expect(popoverWidth()).toBe('520px');
  });

  it('a dial row swaps the route slot to its own leg', async () => {
    renderMqtt();
    await open('About Resolve to address');
    expect(kicker()).toBe('Connection');
    expect(litTokens()).toEqual(['dial 203.0.113.42']);
  });

  it('the verification row keeps its token and gains the block’s description', async () => {
    renderMqtt();
    await open('About SSL certificate verification');
    expect(litTokens()).toEqual(['verify ✓']);
    expect(document.querySelector('.oh-info-popover-description')?.textContent).toMatch(/self-signed/);
  });
});
