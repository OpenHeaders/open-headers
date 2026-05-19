/**
 * Phase C M3 — pins the SW peer-pusher installer.
 *
 *   - install registers a pusher on the host-neutral registry
 *   - installed pusher hands off to `wsRequest` with the right channel + payload
 *   - pusher falls back to a fresh WS handshake when the live socket is down
 *     (chicken-and-egg: switching INTO a back-end can't depend on the live wire
 *     being open, since the live wire only opens AFTER the executor succeeds)
 *   - install is idempotent (second call doesn't overwrite the pusher)
 */

import type { CoexistPayload, CoexistResult } from '@openheaders/core/sync';
import { getCoexistPeerPusher, setCoexistPeerPusher } from '@openheaders/oracle/sync';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sendMock = vi.fn<(data: Record<string, unknown>) => boolean>(() => true);
const isConnectedMock = vi.fn<() => boolean>(() => true);
const registeredHandlers: Array<(frame: unknown) => boolean | Promise<boolean>> = [];

vi.mock('@/background/websocket', () => ({
  sendViaWebSocket: (data: Record<string, unknown>) => sendMock(data),
  isWebSocketConnected: () => isConnectedMock(),
  registerInboundFrameHandler: (handler: (frame: unknown) => boolean | Promise<boolean>) => {
    registeredHandlers.push(handler);
    return () => {
      const idx = registeredHandlers.indexOf(handler);
      if (idx >= 0) registeredHandlers.splice(idx, 1);
    };
  },
}));

vi.mock('@openheaders/core/utils', async (importActual) => ({
  ...(await importActual<typeof import('@openheaders/core/utils')>()),
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  __resetCoexistPeerPusherForTests,
  installCoexistPeerPusher,
} from '../../src/background/install-coexist-peer-pusher';
import { __resetWsRequestForTests } from '../../src/background/ws-request';

async function deliver(frame: unknown): Promise<boolean> {
  for (const handler of [...registeredHandlers]) {
    const handled = await handler(frame);
    if (handled) return true;
  }
  return false;
}

beforeEach(() => {
  sendMock.mockReset();
  sendMock.mockImplementation(() => true);
  isConnectedMock.mockReset();
  isConnectedMock.mockImplementation(() => true);
  registeredHandlers.length = 0;
  __resetWsRequestForTests();
  __resetCoexistPeerPusherForTests();
});

afterEach(() => {
  setCoexistPeerPusher(null);
});

const emptyPayload: CoexistPayload = { workspaces: [] };

describe('installCoexistPeerPusher', () => {
  it('registers a pusher on the host-neutral registry', () => {
    expect(getCoexistPeerPusher()).toBeNull();
    installCoexistPeerPusher();
    expect(getCoexistPeerPusher()).not.toBeNull();
  });

  it('is idempotent — calling twice does not double-register', () => {
    installCoexistPeerPusher();
    const first = getCoexistPeerPusher();
    installCoexistPeerPusher();
    expect(getCoexistPeerPusher()).toBe(first);
  });

  it('falls back to a fresh WS handshake when the live socket is down', async () => {
    // Live socket is down (typical first-time switch INTO this back-end
    // from in-browser mode). The pusher should NOT use the live wire
    // (sendMock should not be called); instead it opens a fresh WS
    // session via runBackendRpc. We don't exercise the fresh path's
    // wire here — it has its own dedicated tests on the engine — but
    // we confirm the live-wire short-circuit is suppressed.
    isConnectedMock.mockReturnValue(false);
    installCoexistPeerPusher();
    const push = getCoexistPeerPusher();
    expect(push).not.toBeNull();
    if (!push) return;
    // The fresh-WS path tries to open `new WebSocket(...)`; in jsdom
    // without our test mock that throws or hangs. Race against a short
    // window so the test is fast; we only need to confirm we didn't
    // touch the live socket.
    const racing = Promise.race([
      push(emptyPayload).catch(() => 'errored' as const),
      new Promise<'pending'>((resolve) => setTimeout(() => resolve('pending'), 30)),
    ]);
    await racing;
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('routes the payload over wsRequest with the applyCoexistImport channel', async () => {
    installCoexistPeerPusher();
    const push = getCoexistPeerPusher();
    if (!push) throw new Error('pusher not installed');

    const payload: CoexistPayload = {
      workspaces: [
        {
          sourceWorkspaceId: 'ws-a',
          sourceWorkspaceName: 'Alpha',
          snapshot: {
            schemaVersion: 1,
            workspaceId: 'ws-a',
            takenAtHlc: {},
            rules: [],
            environments: [],
            collections: [],
            workspaceVariables: [],
            vault: [],
            folders: [],
            requests: [],
            requestCollections: [],
            requestFolders: [],
            templates: [],
            templateCollections: [],
            templateFolders: [],
            liveVariables: [],
            liveWorkflows: [],
            oauthBundles: [],
            pauseMarkers: [],
            layoutState: [],
            files: [],
          },
        },
      ],
    };

    const peerResponse: CoexistResult = {
      ok: true,
      imported: [
        {
          sourceWorkspaceId: 'ws-a',
          sourceWorkspaceName: 'Alpha',
          newWorkspaceId: 'ws-new',
          newWorkspaceName: 'Alpha (imported)',
          entitiesApplied: 3,
        },
      ],
      totalEntitiesApplied: 3,
    };

    const pending = push(payload);
    // The pusher sends a frame whose `type` is the channel and whose
    // `workspaces` field carries the payload's workspaces (the frame
    // shape the WS server's `dispatchSyncRpc` parses).
    expect(sendMock).toHaveBeenCalledTimes(1);
    const sent = sendMock.mock.calls[0][0];
    expect(sent.type).toBe('oh.sync.applyCoexistImport');
    expect(sent.workspaces).toEqual(payload.workspaces);

    // Reply via the WS server's `:response` convention.
    await deliver({ type: 'oh.sync.applyCoexistImport:response', payload: peerResponse });
    await expect(pending).resolves.toEqual(peerResponse);
  });
});
