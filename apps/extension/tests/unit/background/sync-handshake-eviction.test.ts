/**
 * `createSyncHandshakeForWire` — sticky backend-eviction signal (audit X-1).
 *
 * The offline-fallback election must distinguish "backend is down" from
 * "backend rejected this peer" (revoked/rotated token). The FSM's live
 * `rejectReason()` flaps to null on every reconnect attempt, so the handles
 * expose a STICKY `isBackendEvicting()` — set on a rejecting `onRejected`,
 * cleared only on a clean `onSynced`. Here we mock the initiator to capture
 * its config callbacks and drive them directly; the real
 * `isBackendEvictingReason` classifier runs end-to-end.
 */

import { HANDSHAKE_REJECT_REASONS } from '@openheaders/core/protocol';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Capture the config the SUT passes to `createSyncHandshakeInitiator` so the
// test can invoke `onRejected` / `onSynced` as the transport would.
let capturedConfig: {
  onRejected?: (reason: string, detail?: string) => void;
  onSynced?: (scope: unknown, peerVector: unknown) => Promise<void>;
} = {};

vi.mock('@/background/sync-handshake-initiator', () => ({
  createSyncHandshakeInitiator: (config: typeof capturedConfig) => {
    capturedConfig = config;
    return { refreshFanOut: vi.fn() };
  },
}));

// Functions `onSynced` calls — trivial stubs (the clear happens before them).
vi.mock('@/background/sync-mutation-forwarder', () => ({
  applyPeerStateVectorToPendingOut: vi.fn(async () => {}),
  flushPendingOutToBackend: vi.fn(async () => {}),
}));
vi.mock('@/background/awareness-forwarder', () => ({
  forwardCurrentAwarenessOnConnect: vi.fn(),
}));
vi.mock('@/background/websocket', () => ({ sendToBackend: vi.fn() }));

// Module-level imports referenced only by closures the test never invokes —
// stubbed so the SUT loads in isolation (no heavy oracle/ui graph).
vi.mock('@utils/logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('@utils/browser-api', () => ({ runtime: { getManifest: () => ({ version: '0.0.0' }) } }));
vi.mock('@openheaders/oracle/sync', () => ({ applyWorkspaceSnapshot: vi.fn(), readWorkspaceStateVector: vi.fn() }));
vi.mock('@openheaders/oracle/sync/service', () => ({
  getOrCreateWorkspaceService: () => ({ context: { nodeId: 'n', next: () => ({}) }, hydrated: Promise.resolve() }),
  releaseWorkspaceService: vi.fn(),
}));
vi.mock('@openheaders/core/identity', () => ({
  claimJoinedOrg: vi.fn(async () => ({ outcome: 'joined', snapshot: null, firstJoin: false })),
  getOrgBackendBindings: () => new Map<string, string>(),
}));
vi.mock('@openheaders/core/storage', () => ({ getHostStorage: () => null, OH: { backendReach: 'oh.backendReach' } }));
vi.mock('@/background/modules/workspace/workspace-store', () => ({
  getWorkspace: () => null,
  listWorkspaces: () => [],
  peekActiveWorkspaceId: () => null,
  setActiveWorkspaceById: vi.fn(async () => {}),
}));

const { AUTH_REQUIRED, WORKSPACE_UNKNOWN, PROTOCOL_TOO_OLD } = HANDSHAKE_REJECT_REASONS;

describe('createSyncHandshakeForWire — isBackendEvicting (audit X-1)', () => {
  let handles: { isBackendEvicting: () => boolean };

  beforeEach(async () => {
    vi.resetModules();
    capturedConfig = {};
    const mod = await import('@/background/bootstrap/sync-handshake');
    handles = mod.createSyncHandshakeForWire({
      backendId: 'backend-evict-test',
      record: () => ({
        id: 'backend-evict-test',
        label: '',
        url: 'ws://127.0.0.1:59210',
        authToken: '',
        autoConnect: true,
        enabled: true,
        addedAt: '2026-07-01T00:00:00.000Z',
        lastConnectedAt: null,
      }),
      isLoopback: () => true,
      isConnected: () => true,
      send: () => true,
    });
  });

  it('starts not-evicting before any handshake outcome', () => {
    expect(handles.isBackendEvicting()).toBe(false);
  });

  it('flips evicting after an auth-required rejection (the revoke/rotate kill-switch)', () => {
    capturedConfig.onRejected?.(AUTH_REQUIRED);
    expect(handles.isBackendEvicting()).toBe(true);
  });

  it("flips evicting after a protocol-mismatch rejection (backend running, can't talk)", () => {
    capturedConfig.onRejected?.(PROTOCOL_TOO_OLD);
    expect(handles.isBackendEvicting()).toBe(true);
  });

  it('stays NOT evicting after a workspace-unknown rejection (backend not running that workspace)', () => {
    capturedConfig.onRejected?.(WORKSPACE_UNKNOWN);
    expect(handles.isBackendEvicting()).toBe(false);
  });

  it('clears the sticky eviction on a clean onSynced (re-paired / accepted again)', async () => {
    capturedConfig.onRejected?.(AUTH_REQUIRED);
    expect(handles.isBackendEvicting()).toBe(true);

    await capturedConfig.onSynced?.('scope', {});

    expect(handles.isBackendEvicting()).toBe(false);
  });

  it('stays sticky across a reconnect-attempt flap until a clean sync lands', () => {
    // The FSM would reset its live rejectReason() to null mid-backoff; the
    // sticky signal must NOT, or the election sees a fake "offline" window.
    capturedConfig.onRejected?.(AUTH_REQUIRED);
    // (no onSynced — a reconnect attempt that re-rejects)
    capturedConfig.onRejected?.(AUTH_REQUIRED);
    expect(handles.isBackendEvicting()).toBe(true);
  });
});
