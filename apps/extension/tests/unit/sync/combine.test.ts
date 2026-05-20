/**
 * Phase U5.3 — mode-switch Combine orchestrator.
 *
 * Pins `orchestrateCombine`: the trust-by-process arm of the Phase U5
 * mode-switch model. Combine re-homes this host's workspaces into a
 * joined backend's `Org` by flipping each `Workspace.orgId`
 * (UNIFIED_ORACLE_MODEL.md §6.5). The orchestrator is pure over its
 * injected deps — no wire hop, no writer registry.
 */

import type { CombineWorkspaceInput } from '@openheaders/oracle/sync';
import { orchestrateCombine } from '@openheaders/oracle/sync';
import { describe, expect, it, vi } from 'vitest';

const HOME_ORG = '0193a8ff-c000-7000-8000-0000000000a0';
const TARGET_ORG = '0193a8ff-c000-7000-8000-0000000000b0';

const WS_A: CombineWorkspaceInput = { id: 'ws-a', name: 'Alpha', orgId: HOME_ORG };
const WS_B: CombineWorkspaceInput = { id: 'ws-b', name: 'Bravo', orgId: HOME_ORG };
const WS_ON_TARGET: CombineWorkspaceInput = { id: 'ws-c', name: 'Charlie', orgId: TARGET_ORG };

describe('orchestrateCombine', () => {
  it('refuses with no-target-org when the target orgId is empty', async () => {
    const rehomeWorkspace = vi.fn(async () => {});
    const result = await orchestrateCombine({ targetOrgId: '', workspaces: [WS_A], rehomeWorkspace });
    expect(result).toEqual({ ok: false, reason: 'no-target-org' });
    expect(rehomeWorkspace).not.toHaveBeenCalled();
  });

  it('refuses with no-source-data when the host has no workspaces', async () => {
    const rehomeWorkspace = vi.fn(async () => {});
    const result = await orchestrateCombine({ targetOrgId: TARGET_ORG, workspaces: [], rehomeWorkspace });
    expect(result).toEqual({ ok: false, reason: 'no-source-data' });
    expect(rehomeWorkspace).not.toHaveBeenCalled();
  });

  it('re-homes every workspace not already on the target Org', async () => {
    const rehomeWorkspace = vi.fn(async () => {});
    const result = await orchestrateCombine({
      targetOrgId: TARGET_ORG,
      workspaces: [WS_A, WS_B],
      rehomeWorkspace,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.targetOrgId).toBe(TARGET_ORG);
    expect(result.combinedWorkspaces).toEqual([
      { workspaceId: 'ws-a', workspaceName: 'Alpha', fromOrgId: HOME_ORG },
      { workspaceId: 'ws-b', workspaceName: 'Bravo', fromOrgId: HOME_ORG },
    ]);
    expect(rehomeWorkspace.mock.calls).toEqual([
      ['ws-a', TARGET_ORG],
      ['ws-b', TARGET_ORG],
    ]);
  });

  it('skips workspaces already bound to the target Org (idempotent re-run)', async () => {
    const rehomeWorkspace = vi.fn(async () => {});
    const result = await orchestrateCombine({
      targetOrgId: TARGET_ORG,
      workspaces: [WS_A, WS_ON_TARGET],
      rehomeWorkspace,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.combinedWorkspaces).toEqual([{ workspaceId: 'ws-a', workspaceName: 'Alpha', fromOrgId: HOME_ORG }]);
    expect(rehomeWorkspace).toHaveBeenCalledTimes(1);
    expect(rehomeWorkspace).toHaveBeenCalledWith('ws-a', TARGET_ORG);
  });

  it('returns ok with no combined workspaces when every workspace is already on the target', async () => {
    const rehomeWorkspace = vi.fn(async () => {});
    const result = await orchestrateCombine({
      targetOrgId: TARGET_ORG,
      workspaces: [WS_ON_TARGET],
      rehomeWorkspace,
    });
    expect(result).toEqual({ ok: true, targetOrgId: TARGET_ORG, combinedWorkspaces: [] });
    expect(rehomeWorkspace).not.toHaveBeenCalled();
  });

  it('short-circuits on a flip rejection, reporting partial progress', async () => {
    const rehomeWorkspace = vi.fn(async (workspaceId: string) => {
      if (workspaceId === 'ws-b') throw new Error('oracle rejected batch');
    });
    const result = await orchestrateCombine({
      targetOrgId: TARGET_ORG,
      workspaces: [WS_A, WS_B],
      rehomeWorkspace,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('rehome-failed');
    expect(result.detail).toContain('Bravo');
    expect(result.combinedWorkspaces).toEqual([{ workspaceId: 'ws-a', workspaceName: 'Alpha', fromOrgId: HOME_ORG }]);
  });
});
