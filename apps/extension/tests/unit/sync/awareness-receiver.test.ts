/**
 * Client-plane awareness receiver — inbound presence off backend wires
 * (lifted host-neutral for the desktop-as-client awareness row).
 *
 * Pins:
 *   - claims exactly the `oh.awareness.presence` type: other frames
 *     fall through to the next handler;
 *   - a malformed awareness frame is still claimed (dropped, not
 *     re-routed) and never touches a store;
 *   - a valid frame folds every carried state into the workspace's own
 *     awareness store; a workspace without a booted store is ignored.
 */

import type { AwarenessState } from '@openheaders/core/protocol';
import { SYNC_AWARENESS_PRESENCE_TYPE } from '@openheaders/core/protocol';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const published: Array<{ workspaceId: string; state: AwarenessState }> = [];
const storesByWorkspace = new Set<string>();

vi.mock('@openheaders/oracle/sync/service', () => ({
  getAwarenessStoreForWorkspace: (workspaceId: string) =>
    storesByWorkspace.has(workspaceId)
      ? { publish: (state: AwarenessState) => published.push({ workspaceId, state }) }
      : null,
}));

import { handleIncomingAwarenessFrame } from '@openheaders/oracle/sync/client/awareness-receiver';

function makeState(instanceId: string): AwarenessState {
  return {
    identity: { instanceId, surfaceKind: 'workbench', appId: 'desktop', label: 'Workbench' },
    entityFocus: null,
    fieldFocus: null,
    dirtyFields: [],
    lastActivityHlc: { physicalMs: 1, logical: 0, nodeId: 'node-test' },
  };
}

beforeEach(() => {
  published.length = 0;
  storesByWorkspace.clear();
});

describe('awareness receiver', () => {
  it('lets non-awareness frames fall through', () => {
    expect(handleIncomingAwarenessFrame({ type: 'oh.sync.mutation' })).toBe(false);
    expect(handleIncomingAwarenessFrame('not-an-object')).toBe(false);
    expect(published).toHaveLength(0);
  });

  it('claims and drops a malformed awareness frame', () => {
    storesByWorkspace.add('ws-1');
    const claimed = handleIncomingAwarenessFrame({ type: SYNC_AWARENESS_PRESENCE_TYPE, workspaceId: '' });

    expect(claimed).toBe(true);
    expect(published).toHaveLength(0);
  });

  it('folds carried states into the workspace store', () => {
    storesByWorkspace.add('ws-1');
    const claimed = handleIncomingAwarenessFrame({
      type: SYNC_AWARENESS_PRESENCE_TYPE,
      workspaceId: 'ws-1',
      presence: [makeState('peer-a'), makeState('peer-b')],
    });

    expect(claimed).toBe(true);
    expect(published.map((p) => p.state.identity.instanceId)).toEqual(['peer-a', 'peer-b']);
    expect(published.every((p) => p.workspaceId === 'ws-1')).toBe(true);
  });

  it('ignores frames for a workspace with no booted store', () => {
    const claimed = handleIncomingAwarenessFrame({
      type: SYNC_AWARENESS_PRESENCE_TYPE,
      workspaceId: 'ws-unbooted',
      presence: [makeState('peer-a')],
    });

    expect(claimed).toBe(true);
    expect(published).toHaveLength(0);
  });
});
