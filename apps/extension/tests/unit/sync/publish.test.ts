/**
 * Phase U5.6 — mode-switch Publish orchestrator + renderer bridge.
 *
 * Pins `orchestratePublish`: the per-workspace analog of Combine. Publish
 * re-homes ONE workspace into an authenticated backend's `Org` by
 * flipping its `Workspace.orgId` (UNIFIED_ORACLE_MODEL.md §6.5) — the
 * only path a workspace's data travels UP to a LAN / WAN backend. The
 * orchestrator is pure over its injected deps; the permission gate
 * lives in the dispatcher.
 */

import type { PublishWorkspaceInput } from '@openheaders/oracle/sync';
import { orchestratePublish } from '@openheaders/oracle/sync';
import { executePublish } from '@openheaders/ui/shared/mode-switch';
import type { PublishResult } from '@openheaders/core/sync';
import { describe, expect, it, vi } from 'vitest';

const HOME_ORG = '0193a8ff-c000-7000-8000-0000000000a0';
const TARGET_ORG = '0193a8ff-c000-7000-8000-0000000000b0';

const WS_A: PublishWorkspaceInput = { id: 'ws-a', name: 'Alpha', orgId: HOME_ORG };
const WS_ON_TARGET: PublishWorkspaceInput = { id: 'ws-c', name: 'Charlie', orgId: TARGET_ORG };

describe('orchestratePublish', () => {
  it('refuses with no-target-org when the target orgId is empty', async () => {
    const rehomeWorkspace = vi.fn(async () => {});
    const result = await orchestratePublish({
      targetOrgId: '',
      workspaceId: 'ws-a',
      workspaces: [WS_A],
      rehomeWorkspace,
    });
    expect(result).toEqual({ ok: false, reason: 'no-target-org' });
    expect(rehomeWorkspace).not.toHaveBeenCalled();
  });

  it('refuses with workspace-not-found when no workspace carries the id', async () => {
    const rehomeWorkspace = vi.fn(async () => {});
    const result = await orchestratePublish({
      targetOrgId: TARGET_ORG,
      workspaceId: 'ws-missing',
      workspaces: [WS_A],
      rehomeWorkspace,
    });
    expect(result).toEqual({ ok: false, reason: 'workspace-not-found' });
    expect(rehomeWorkspace).not.toHaveBeenCalled();
  });

  it('re-homes the named workspace into the target Org', async () => {
    const rehomeWorkspace = vi.fn(async () => {});
    const result = await orchestratePublish({
      targetOrgId: TARGET_ORG,
      workspaceId: 'ws-a',
      workspaces: [WS_A, WS_ON_TARGET],
      rehomeWorkspace,
    });
    expect(result).toEqual({
      ok: true,
      targetOrgId: TARGET_ORG,
      published: { workspaceId: 'ws-a', workspaceName: 'Alpha', fromOrgId: HOME_ORG },
    });
    expect(rehomeWorkspace.mock.calls).toEqual([['ws-a', TARGET_ORG]]);
  });

  it('is an idempotent no-op when the workspace is already on the target', async () => {
    const rehomeWorkspace = vi.fn(async () => {});
    const result = await orchestratePublish({
      targetOrgId: TARGET_ORG,
      workspaceId: 'ws-c',
      workspaces: [WS_ON_TARGET],
      rehomeWorkspace,
    });
    expect(result).toEqual({
      ok: true,
      targetOrgId: TARGET_ORG,
      published: { workspaceId: 'ws-c', workspaceName: 'Charlie', fromOrgId: TARGET_ORG },
    });
    expect(rehomeWorkspace).not.toHaveBeenCalled();
  });

  it('reports rehome-failed when the flip rejects, keeping the old binding', async () => {
    const rehomeWorkspace = vi.fn(async () => {
      throw new Error('oracle rejected batch');
    });
    const result = await orchestratePublish({
      targetOrgId: TARGET_ORG,
      workspaceId: 'ws-a',
      workspaces: [WS_A],
      rehomeWorkspace,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('rehome-failed');
    expect(result.detail).toContain('Alpha');
  });
});

describe('executePublish (renderer bridge wrapper)', () => {
  it('returns the bridge response on success', async () => {
    const stub: PublishResult = {
      ok: true,
      targetOrgId: TARGET_ORG,
      published: { workspaceId: 'ws-a', workspaceName: 'Alpha', fromOrgId: HOME_ORG },
    };
    const result = await executePublish(
      { workspaceId: 'ws-a', targetOrgId: TARGET_ORG },
      { bridgeCall: async () => stub },
    );
    expect(result).toBe(stub);
  });

  it('folds bridge rejections into rehome-failed', async () => {
    const result = await executePublish(
      { workspaceId: 'ws-a', targetOrgId: TARGET_ORG },
      { bridgeCall: () => Promise.reject(new Error('ipc-down')) },
    );
    expect(result).toMatchObject({ ok: false, reason: 'rehome-failed', detail: 'ipc-down' });
  });
});
