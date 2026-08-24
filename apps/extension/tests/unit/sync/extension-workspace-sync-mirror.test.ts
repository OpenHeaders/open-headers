/**
 * Renderer-side ExtensionWorkspace sync mirror — the `workspaceEvicted`
 * signal (access foundation F2 / multi-backend Discard).
 *
 * A host-local eviction mints no mutation envelope, so no
 * `syncBroadcast` reaches the mirror — the host fires the
 * `workspaceEvicted` bridge broadcast instead and the mirror drops the
 * workspace surgically. Pins:
 *   - the evicted workspace leaves `workspaces` + `orderKeys`, and an
 *     active pointer naming it nulls out;
 *   - an eviction for an id the mirror doesn't hold is a no-op (no
 *     notify);
 *   - an ordinary syncBroadcast after the eviction still applies (the
 *     re-grant's live offer re-materializes the row).
 */

import { EXTENSION_WORKSPACE_ENTITY_TYPE, EXTENSION_WORKSPACE_GLOBAL_SCOPE } from '@openheaders/core/sync';
import type { ExtensionWorkspace } from '@openheaders/core/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { subscribers } = vi.hoisted(() => ({
  subscribers: new Map<string, Array<(payload: unknown) => void>>(),
}));

vi.mock('@openheaders/core/bridge', async (importActual) => ({
  ...(await importActual<typeof import('@openheaders/core/bridge')>()),
  hostBridge: {
    call: vi.fn(),
    subscribe: vi.fn((type: string, handler: (payload: unknown) => void) => {
      const list = subscribers.get(type) ?? [];
      list.push(handler);
      subscribers.set(type, list);
      return () => {
        const current = subscribers.get(type) ?? [];
        subscribers.set(
          type,
          current.filter((h) => h !== handler),
        );
      };
    }),
    broadcast: vi.fn(),
    presence: vi.fn(),
  },
}));

import { createExtensionWorkspaceSyncMirror } from '@openheaders/ui/context';

function emit(type: string, payload: unknown): void {
  for (const handler of subscribers.get(type) ?? []) handler(payload);
}

function workspace(id: string): ExtensionWorkspace {
  return {
    schemaVersion: 5,
    id,
    kind: 'personal',
    name: `Workspace ${id}`,
    orgId: 'org-daemon',
    sortIndex: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  } as ExtensionWorkspace;
}

function broadcastList(workspaces: ExtensionWorkspace[], activeWorkspaceId: string | null): void {
  emit('syncBroadcast', {
    envelope: {
      workspaceId: EXTENSION_WORKSPACE_GLOBAL_SCOPE,
      body: { type: EXTENSION_WORKSPACE_ENTITY_TYPE },
    },
    extensionWorkspacePostState: {
      workspaces,
      activeWorkspaceId,
      orderKeys: Object.fromEntries(workspaces.map((w, i) => [w.id, `k${i}`])),
    },
  });
}

beforeEach(() => {
  subscribers.clear();
});

describe('extension-workspace sync mirror — workspaceEvicted', () => {
  it('drops the evicted workspace from the entry and nulls an active pointer naming it', () => {
    const mirror = createExtensionWorkspaceSyncMirror({ bootstrap: false });
    broadcastList([workspace('ws-a'), workspace('ws-b')], 'ws-b');

    emit('workspaceEvicted', { workspaceId: 'ws-b' });

    expect(mirror.liveWorkspaces().map((w) => w.id)).toEqual(['ws-a']);
    expect(mirror.liveActiveWorkspaceId()).toBeNull();
    expect(mirror.liveOrderKey('ws-b')).toBeUndefined();
    expect(mirror.liveOrderKey('ws-a')).toBe('k0');
    mirror.dispose();
  });

  it('keeps the active pointer when the evicted workspace is not active', () => {
    const mirror = createExtensionWorkspaceSyncMirror({ bootstrap: false });
    broadcastList([workspace('ws-a'), workspace('ws-b')], 'ws-a');

    emit('workspaceEvicted', { workspaceId: 'ws-b' });

    expect(mirror.liveWorkspaces().map((w) => w.id)).toEqual(['ws-a']);
    expect(mirror.liveActiveWorkspaceId()).toBe('ws-a');
    mirror.dispose();
  });

  it('is a silent no-op for an id the mirror does not hold', () => {
    const mirror = createExtensionWorkspaceSyncMirror({ bootstrap: false });
    broadcastList([workspace('ws-a')], 'ws-a');
    const ticks = vi.fn();
    mirror.subscribeMirror(ticks);

    emit('workspaceEvicted', { workspaceId: 'ws-ghost' });

    expect(ticks).not.toHaveBeenCalled();
    expect(mirror.liveWorkspaces().map((w) => w.id)).toEqual(['ws-a']);
    mirror.dispose();
  });

  it('a later syncBroadcast still applies — the re-grant offer re-materializes the row', () => {
    const mirror = createExtensionWorkspaceSyncMirror({ bootstrap: false });
    broadcastList([workspace('ws-a'), workspace('ws-b')], 'ws-a');
    emit('workspaceEvicted', { workspaceId: 'ws-b' });
    expect(mirror.liveWorkspaces().map((w) => w.id)).toEqual(['ws-a']);

    broadcastList([workspace('ws-a'), workspace('ws-b')], 'ws-a');
    expect(mirror.liveWorkspaces().map((w) => w.id)).toEqual(['ws-a', 'ws-b']);
    mirror.dispose();
  });

  it('dispose unsubscribes the eviction signal', () => {
    const mirror = createExtensionWorkspaceSyncMirror({ bootstrap: false });
    broadcastList([workspace('ws-a')], 'ws-a');
    mirror.dispose();
    expect((subscribers.get('workspaceEvicted') ?? []).length).toBe(0);
  });
});
