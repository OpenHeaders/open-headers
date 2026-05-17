/**
 * Phase C M4 — pins the SW import peer-pusher installer.
 *
 *   - install registers a pusher on the host-neutral registry
 *   - installed pusher hands off to `wsRequest` with the right channel + payload
 *   - pusher rejects with `not-connected` when the socket is down (before any WS frame)
 *   - install is idempotent (second call doesn't overwrite the pusher)
 */

import type { ImportPayload, ImportResult } from '@openheaders/core/sync';
import { getImportPeerPusher, setImportPeerPusher } from '@openheaders/oracle/sync';
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
  __resetImportPeerPusherForTests,
  installImportPeerPusher,
} from '../../src/background/install-import-peer-pusher';
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
  __resetImportPeerPusherForTests();
});

afterEach(() => {
  setImportPeerPusher(null);
});

const emptyPayload: ImportPayload = { workspaces: [] };

describe('installImportPeerPusher', () => {
  it('registers a pusher on the host-neutral registry', () => {
    expect(getImportPeerPusher()).toBeNull();
    installImportPeerPusher();
    expect(getImportPeerPusher()).not.toBeNull();
  });

  it('is idempotent — calling twice does not double-register', () => {
    installImportPeerPusher();
    const first = getImportPeerPusher();
    installImportPeerPusher();
    expect(getImportPeerPusher()).toBe(first);
  });

  it('rejects with not-connected before any WS frame when the socket is down', async () => {
    isConnectedMock.mockReturnValue(false);
    installImportPeerPusher();
    const push = getImportPeerPusher();
    expect(push).not.toBeNull();
    if (!push) return;
    await expect(push(emptyPayload)).rejects.toThrow('not-connected');
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('routes the payload over wsRequest with the applyImport channel', async () => {
    installImportPeerPusher();
    const push = getImportPeerPusher();
    if (!push) throw new Error('pusher not installed');

    const payload: ImportPayload = {
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

    const peerResponse: ImportResult = {
      ok: true,
      mergedWorkspaces: [
        {
          workspaceId: 'ws-a',
          workspaceName: 'Alpha',
          entitiesApplied: 3,
          conflicts: [],
        },
      ],
      ignored: [],
      totalEntitiesApplied: 3,
      totalConflicts: 0,
    };

    const pending = push(payload);
    expect(sendMock).toHaveBeenCalledTimes(1);
    const sent = sendMock.mock.calls[0][0];
    expect(sent.type).toBe('oh.sync.applyImport');
    expect(sent.workspaces).toEqual(payload.workspaces);

    await deliver({ type: 'oh.sync.applyImport:response', payload: peerResponse });
    await expect(pending).resolves.toEqual(peerResponse);
  });
});
