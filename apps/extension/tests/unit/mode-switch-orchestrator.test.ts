/**
 * Phase C M2b / U5.5 — renderer-side orchestrator. Pins:
 *
 *   - local presence is read through `oh.sync.getDataPresence`
 *   - peer query is optional; absence ⇒ `peer-unreachable`
 *   - source-empty + populated target ⇒ silent-use-target
 *   - bridge errors degrade local to empty so silent commits stay open
 *   - peer-query throws degrade to `null` (peer-unreachable)
 *   - identical from/to short-circuits before any RPC
 *   - the peer probe's target `Org` rides onto a `show-dialog` verdict
 */

import type { DataPresenceSummary, WorkspaceContentSnapshot } from '@openheaders/core/sync';
import type { Org } from '@openheaders/core/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCall } = vi.hoisted(() => ({ mockCall: vi.fn() }));

vi.mock('@openheaders/core/bridge', async (importActual) => ({
  ...(await importActual<typeof import('@openheaders/core/bridge')>()),
  hostBridge: {
    call: mockCall,
    subscribe: vi.fn(() => () => undefined),
    broadcast: vi.fn(),
    presence: vi.fn(),
  },
}));

import {
  type PeerPresenceProbe,
  queryPeerDataPresenceFromBridge,
  requestModeSwitchVerdict,
} from '@openheaders/ui/shared/mode-switch';

const WS_A = '0193a8ff-c000-7000-8000-00000000000a';

function workspace(entityCounts: Record<string, number> = {}): WorkspaceContentSnapshot {
  return { workspaceId: WS_A, workspaceName: 'Workspace', entityCounts };
}

function presence(workspaces: WorkspaceContentSnapshot[]): DataPresenceSummary {
  const total = workspaces.reduce((a, w) => a + Object.values(w.entityCounts).reduce((s, n) => s + n, 0), 0);
  return {
    workspaceCount: workspaces.length,
    hasUserContent: total > 0,
    totalEntityCount: total,
    workspaces,
  };
}

/** Wrap a workspace list as the peer-probe shape the orchestrator expects. */
function peerProbe(workspaces: WorkspaceContentSnapshot[], org: Org | null = null): PeerPresenceProbe {
  return { presence: presence(workspaces), org };
}

beforeEach(() => {
  mockCall.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('requestModeSwitchVerdict', () => {
  it('short-circuits to no-change when fromMode === toMode without touching the bridge', async () => {
    const verdict = await requestModeSwitchVerdict('in-browser', 'in-browser');
    expect(verdict).toEqual({ kind: 'no-change' });
    expect(mockCall).not.toHaveBeenCalled();
  });

  it('queries oh.sync.getDataPresence for the local side', async () => {
    mockCall.mockResolvedValueOnce({ workspaces: [workspace({ rule: 12 })] });
    await requestModeSwitchVerdict('in-browser', 'desktop-app');
    expect(mockCall).toHaveBeenCalledWith('oh.sync.getDataPresence');
  });

  it('routes to peer-unreachable when no queryPeerPresence is provided and source has data', async () => {
    mockCall.mockResolvedValueOnce({ workspaces: [workspace({ rule: 12 })] });
    const verdict = await requestModeSwitchVerdict('in-browser', 'desktop-app');
    expect(verdict).toEqual({ kind: 'peer-unreachable' });
  });

  it('commits with both-empty when source is empty and no peer query is provided (first-time switch)', async () => {
    mockCall.mockResolvedValueOnce({ workspaces: [] });
    const verdict = await requestModeSwitchVerdict('in-browser', 'desktop-app');
    expect(verdict).toEqual({ kind: 'both-empty' });
  });

  it('routes to silent-use-target when source is empty and peer reports data', async () => {
    mockCall.mockResolvedValueOnce({ workspaces: [] });
    const verdict = await requestModeSwitchVerdict('in-browser', 'desktop-app', {
      queryPeerPresence: async () => peerProbe([workspace({ rule: 8 })]),
    });
    expect(verdict).toEqual({ kind: 'silent-use-target' });
  });

  it('routes to silent-import-source when peer is empty and source has data', async () => {
    mockCall.mockResolvedValueOnce({ workspaces: [workspace({ rule: 12 })] });
    const verdict = await requestModeSwitchVerdict('in-browser', 'desktop-app', {
      queryPeerPresence: async () => peerProbe([]),
    });
    expect(verdict).toEqual({ kind: 'silent-import-source' });
  });

  it('routes to show-dialog when both sides have data', async () => {
    mockCall.mockResolvedValueOnce({ workspaces: [workspace({ rule: 12, environment: 3 })] });
    const verdict = await requestModeSwitchVerdict('in-browser', 'desktop-app', {
      queryPeerPresence: async () => peerProbe([workspace({ rule: 4 })]),
    });
    expect(verdict.kind).toBe('show-dialog');
    if (verdict.kind !== 'show-dialog') throw new Error('expected show-dialog');
    expect(verdict.source.totalEntityCount).toBe(15);
    expect(verdict.target.totalEntityCount).toBe(4);
  });

  it('threads the peer probe’s target Org onto the show-dialog verdict', async () => {
    const targetOrg: Org = {
      id: '0193a8ff-c000-7000-8000-0000000000ff',
      name: 'Desktop home',
      hostKind: 'desktop',
      isPrivate: true,
    };
    mockCall.mockResolvedValueOnce({ workspaces: [workspace({ rule: 1 })] });
    const verdict = await requestModeSwitchVerdict('in-browser', 'desktop-app', {
      queryPeerPresence: async () => peerProbe([workspace({ rule: 4 })], targetOrg),
    });
    if (verdict.kind !== 'show-dialog') throw new Error('expected show-dialog');
    expect(verdict.targetOrg).toEqual(targetOrg);
  });

  it('leaves targetOrg null when the peer probe carried no Org', async () => {
    mockCall.mockResolvedValueOnce({ workspaces: [workspace({ rule: 1 })] });
    const verdict = await requestModeSwitchVerdict('in-browser', 'desktop-app', {
      queryPeerPresence: async () => peerProbe([workspace({ rule: 4 })]),
    });
    if (verdict.kind !== 'show-dialog') throw new Error('expected show-dialog');
    expect(verdict.targetOrg).toBeNull();
  });

  it('treats both-empty as both-empty when peer query resolves to an empty summary', async () => {
    mockCall.mockResolvedValueOnce({ workspaces: [] });
    const verdict = await requestModeSwitchVerdict('in-browser', 'desktop-app', {
      queryPeerPresence: async () => peerProbe([]),
    });
    expect(verdict.kind).toBe('both-empty');
  });

  it('degrades local query failure to empty so the silent commit path stays open', async () => {
    mockCall.mockRejectedValueOnce(new Error('bridge offline'));
    const verdict = await requestModeSwitchVerdict('in-browser', 'desktop-app', {
      queryPeerPresence: async () => peerProbe([workspace({ rule: 1 })]),
    });
    expect(verdict.kind).toBe('silent-use-target');
  });

  it('degrades peer query rejection to null (peer-unreachable)', async () => {
    mockCall.mockResolvedValueOnce({ workspaces: [workspace({ rule: 1 })] });
    const verdict = await requestModeSwitchVerdict('in-browser', 'desktop-app', {
      queryPeerPresence: async () => {
        throw new Error('peer offline');
      },
    });
    expect(verdict.kind).toBe('peer-unreachable');
  });

  it('honors a test-injected local query so callers can drive deterministic flows', async () => {
    const verdict = await requestModeSwitchVerdict('in-browser', 'desktop-app', {
      queryLocalPresence: async () => ({ workspaces: [] }),
      queryPeerPresence: async () => peerProbe([workspace({ rule: 2 })]),
    });
    expect(verdict.kind).toBe('silent-use-target');
    expect(mockCall).not.toHaveBeenCalled();
  });
});

describe('queryPeerDataPresenceFromBridge', () => {
  it('returns null when the relay reports unavailable', async () => {
    mockCall.mockResolvedValueOnce({ available: false });
    expect(await queryPeerDataPresenceFromBridge()).toBeNull();
    expect(mockCall).toHaveBeenCalledWith('oh.sync.getPeerDataPresence');
  });

  it('summarizes the peer workspaces when the relay returns available: true', async () => {
    mockCall.mockResolvedValueOnce({
      available: true,
      workspaces: [workspace({ rule: 4, environment: 1 })],
    });
    const probe = await queryPeerDataPresenceFromBridge();
    expect(probe).not.toBeNull();
    expect(probe?.presence.totalEntityCount).toBe(5);
    expect(probe?.presence.hasUserContent).toBe(true);
    // The relayed channel carries no Org — that path is org-blind.
    expect(probe?.org).toBeNull();
  });

  it('falls back to null when the bridge call itself throws', async () => {
    mockCall.mockRejectedValueOnce(new Error('bridge offline'));
    expect(await queryPeerDataPresenceFromBridge()).toBeNull();
  });
});
