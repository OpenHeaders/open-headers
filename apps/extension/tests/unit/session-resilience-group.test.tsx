// @vitest-environment jsdom
/**
 * The shared session-resilience block — one component on the
 * WebSocket / Socket.IO and MQTT Settings tabs. Pins: the reconnect
 * quartet in one order behind every prefix, the liveness rows per
 * mask (raw = idle + heartbeat, socketio = idle on the handshake
 * default, MQTT = none), the whole-value onChange, the dependent rows
 * gated by the switch, the modified dots off the runtime defaults, and
 * the WebSocket tab merging the block into its draft.
 */

import { registerCapability, unregisterCapability } from '@openheaders/core/capabilities';
import type { MqttRequest, WebSocketRequest } from '@openheaders/core/types';
import { draftFromMqttRequest } from '@openheaders/ui/workbench/components/mqtt-request-editor/draft';
import MqttSettingsTab from '@openheaders/ui/workbench/components/mqtt-request-editor/MqttSettingsTab';
import SessionResilienceGroup, {
  isResilienceModified,
  type ResilienceValue,
} from '@openheaders/ui/workbench/components/shared/resilience/SessionResilienceGroup';
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

const RECONNECT_LABELS = ['Reconnect automatically', 'Reconnect period', 'Reconnect attempts', 'Exponential backoff'];
const LIVENESS_LABELS = ['Idle timeout', 'Heartbeat message', 'Heartbeat interval'];

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

const OFF: ResilienceValue = { autoReconnect: false, reconnectBackoff: true };

function scoped(node: React.ReactElement): React.ReactElement {
  return <EditingScopeWorkspaceProvider workspaceId="ws-1">{node}</EditingScopeWorkspaceProvider>;
}

function renderGroup(value: ResilienceValue, extra: Partial<React.ComponentProps<typeof SessionResilienceGroup>> = {}) {
  const onChange = vi.fn();
  render(
    <SessionResilienceGroup
      groupLabel="Session resilience"
      groupInfo={{ title: 'Session resilience', summary: 'What keeps a session alive.' }}
      expanded
      onToggle={() => {}}
      value={value}
      onChange={onChange}
      liveness="raw"
      testIdPrefix="probe"
      {...extra}
    />,
  );
  return onChange;
}

/** The label column text of every known row present, in DOM order. */
function rowLabels(): string[] {
  return [...RECONNECT_LABELS, ...LIVENESS_LABELS]
    .filter((label) => screen.queryByText(label) !== null)
    .sort((a, b) =>
      screen.getByText(a).compareDocumentPosition(screen.getByText(b)) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
    );
}

describe('SessionResilienceGroup — the shared rows', () => {
  it('renders the quartet then the raw liveness rows in one order behind the prefix', () => {
    renderGroup(OFF);
    expect(rowLabels()).toEqual([...RECONNECT_LABELS, ...LIVENESS_LABELS]);
    for (const suffix of [
      'auto-reconnect',
      'reconnect-period',
      'reconnect-max-attempts',
      'reconnect-backoff',
      'idle-timeout',
      'heartbeat-message',
      'heartbeat-interval',
    ]) {
      expect(screen.getByTestId(`probe-${suffix}`)).toBeTruthy();
    }
    expect(screen.getByText('Off (default)')).toBeTruthy();
  });

  it('masks the liveness rows: socketio keeps the idle row on the handshake default, none drops them all', () => {
    renderGroup(OFF, { liveness: 'socketio' });
    expect(rowLabels()).toEqual([...RECONNECT_LABELS, 'Idle timeout']);
    expect(screen.getByText('Server ping cadence (default)')).toBeTruthy();
    cleanup();
    renderGroup(OFF, { liveness: 'none' });
    expect(rowLabels()).toEqual(RECONNECT_LABELS);
  });

  it('hands the WHOLE next value back and gates the dependent rows on the switch', () => {
    const onChange = renderGroup({ ...OFF, heartbeatMessage: 'ping' });
    expect(screen.getByRole('switch', { name: 'Exponential backoff' }).getAttribute('disabled')).not.toBeNull();
    fireEvent.click(screen.getByRole('switch', { name: 'Reconnect automatically' }));
    expect(onChange).toHaveBeenLastCalledWith({
      autoReconnect: true,
      reconnectBackoff: true,
      heartbeatMessage: 'ping',
    });
    fireEvent.change(screen.getByTestId('probe-heartbeat-message'), { target: { value: '{"type":"ping"}' } });
    expect(onChange).toHaveBeenLastCalledWith({
      autoReconnect: false,
      reconnectBackoff: true,
      heartbeatMessage: '{"type":"ping"}',
    });
  });

  it('dots only off the runtime defaults', () => {
    expect(isResilienceModified(OFF)).toBe(false);
    expect(isResilienceModified({ ...OFF, autoReconnect: true })).toBe(true);
    expect(isResilienceModified({ ...OFF, reconnectBackoff: false })).toBe(true);
    expect(isResilienceModified({ ...OFF, idleTimeoutMs: 30_000 })).toBe(true);
    expect(isResilienceModified({ ...OFF, heartbeatMessage: 'ping' })).toBe(true);
    renderGroup(OFF);
    expect(screen.queryAllByTestId('oh-setting-modified-dot')).toHaveLength(0);
  });
});

describe('SessionResilienceGroup — on the session Settings tabs', () => {
  it('the WebSocket tab seats the block after Connection and merges its value into the draft', () => {
    const setDraft = vi.fn();
    const draft = draftFromWebSocketRequest(websocketRequest);
    render(scoped(<WebSocketSettingsTab draft={draft} setDraft={setDraft} socketioFlavor={false} />));
    expect(screen.getByText('Session resilience')).toBeTruthy();
    expect(rowLabels()).toEqual([...RECONNECT_LABELS, ...LIVENESS_LABELS]);
    expect(screen.getByText('Connection').compareDocumentPosition(screen.getByText('Session resilience'))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    fireEvent.click(screen.getByRole('switch', { name: 'Reconnect automatically' }));
    const updater = setDraft.mock.calls[0]?.[0] as (d: typeof draft) => typeof draft;
    const next = updater(draft);
    expect(next.autoReconnect).toBe(true);
    expect(next.url).toBe(draft.url);
    expect(screen.getByTestId('websocket-heartbeat-interval')).toBeTruthy();
  });

  it('the Socket.IO flavor renders the idle row alone on the handshake default', () => {
    render(
      scoped(
        <WebSocketSettingsTab
          draft={draftFromWebSocketRequest({ ...websocketRequest, flavor: 'socketio' })}
          setDraft={() => {}}
          socketioFlavor
        />,
      ),
    );
    expect(rowLabels()).toEqual([...RECONNECT_LABELS, 'Idle timeout']);
    expect(screen.getByText('Server ping cadence (default)')).toBeTruthy();
    expect(screen.queryByTestId('websocket-heartbeat-message')).toBeNull();
  });

  it('the MQTT tab moves its reconnect rows onto the block under its own test ids, no liveness rows', () => {
    render(scoped(<MqttSettingsTab draft={draftFromMqttRequest(mqttRequest)} setDraft={() => {}} v5 />));
    expect(rowLabels()).toEqual(RECONNECT_LABELS);
    expect(screen.getByTestId('mqtt-auto-reconnect')).toBeTruthy();
    expect(screen.getByTestId('mqtt-reconnect-backoff')).toBeTruthy();
    expect(screen.queryByTestId('mqtt-idle-timeout')).toBeNull();
  });
});
