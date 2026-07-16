/**
 * Client-plane awareness forwarder — outbound presence over backend
 * wires (lifted host-neutral for the desktop-as-client awareness row).
 *
 * Pins:
 *   - only the calling host's own-appId states go on the wire, routed
 *     to the backend owning the workspace's Org binding;
 *   - filter-down-to-empty sends nothing (peer states exist locally —
 *     our absence must not overwrite them), but an originally-empty
 *     event ships an empty frame (proactive age-out);
 *   - an unbound (home-Org) workspace forwards nowhere.
 */

import type { AwarenessState } from '@openheaders/core/protocol';
import { SYNC_AWARENESS_PRESENCE_TYPE } from '@openheaders/core/protocol';
import type { Org } from '@openheaders/core/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sent: Array<{ backendId: string; frame: Record<string, unknown> }> = [];

vi.mock('@openheaders/oracle/sync/client/backend-connection-manager', () => ({
  sendToBackend: (backendId: string, frame: Record<string, unknown>) => {
    sent.push({ backendId, frame });
    return true;
  },
}));

const workspaceOrgs = new Map<string, string>();

vi.mock('@openheaders/oracle/workspace/extension-workspace-store', () => ({
  getWorkspace: (id: string) => {
    const orgId = workspaceOrgs.get(id);
    return orgId ? { id, orgId } : undefined;
  },
}));

import { forwardAwarenessToBackend } from '@openheaders/oracle/sync/client/awareness-forwarder';
import { installSyntheticIdentityForTests, TEST_BACKEND_ID } from './_identity-test-setup';

const JOINED_ORG: Org = {
  id: 'org-backend',
  name: 'Johns-MacBook-Pro',
  hostKind: 'desktop',
  isPrivate: false,
};

function makeState(appId: AwarenessState['identity']['appId'], instanceId: string): AwarenessState {
  return {
    identity: { instanceId, surfaceKind: 'workbench', appId, labelContext: 'Workbench' },
    entityFocus: null,
    fieldFocus: null,
    dirtyFields: [],
    lastActivityHlc: { physicalMs: 1, logical: 0, nodeId: 'node-test' },
  };
}

let teardownIdentity: (() => void) | null = null;

beforeEach(async () => {
  sent.length = 0;
  workspaceOrgs.clear();
  teardownIdentity = await installSyntheticIdentityForTests([], [{ org: JOINED_ORG, backendId: TEST_BACKEND_ID }]);
  workspaceOrgs.set('ws-bound', JOINED_ORG.id);
});

afterEach(() => {
  teardownIdentity?.();
  teardownIdentity = null;
});

describe('awareness forwarder', () => {
  it('forwards only own-appId states to the Org-bound backend', () => {
    forwardAwarenessToBackend(
      { workspaceId: 'ws-bound', presence: [makeState('desktop', 'peer-1'), makeState('extension', 'mine-1')] },
      'extension',
    );

    expect(sent).toHaveLength(1);
    expect(sent[0].backendId).toBe(TEST_BACKEND_ID);
    expect(sent[0].frame.type).toBe(SYNC_AWARENESS_PRESENCE_TYPE);
    expect(sent[0].frame.workspaceId).toBe('ws-bound');
    const presence = sent[0].frame.presence as AwarenessState[];
    expect(presence.map((s) => s.identity.instanceId)).toEqual(['mine-1']);
  });

  it('sends nothing when the filter empties a non-empty event', () => {
    forwardAwarenessToBackend({ workspaceId: 'ws-bound', presence: [makeState('desktop', 'peer-1')] }, 'extension');

    expect(sent).toHaveLength(0);
  });

  it('never re-forwards a hub-stamped state, even with a matching appId', () => {
    // A same-user device's state relayed down by the daemon carries the
    // hub's ingest stamps (userId + per-device token as deviceId) and
    // the SAME appId as this host — re-forwarding it would ping-pong
    // presence between the user's devices through the hub.
    const relayed = makeState('extension', 'other-device-1');
    relayed.identity.userId = 'user-alice';
    relayed.identity.deviceId = 'token-other-device';
    forwardAwarenessToBackend(
      { workspaceId: 'ws-bound', presence: [relayed, makeState('extension', 'mine-1')] },
      'extension',
    );

    expect(sent).toHaveLength(1);
    const presence = sent[0].frame.presence as AwarenessState[];
    expect(presence.map((s) => s.identity.instanceId)).toEqual(['mine-1']);
  });

  it('ships an originally-empty event as an empty frame', () => {
    forwardAwarenessToBackend({ workspaceId: 'ws-bound', presence: [] }, 'extension');

    expect(sent).toHaveLength(1);
    expect(sent[0].frame.presence).toEqual([]);
  });

  it('an unbound workspace forwards nowhere', () => {
    forwardAwarenessToBackend({ workspaceId: 'ws-home', presence: [makeState('extension', 'mine-1')] }, 'extension');

    expect(sent).toHaveLength(0);
  });
});
