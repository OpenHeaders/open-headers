/**
 * Inbound workspace-retraction boundary (F2 S5c) — frame claiming, the
 * per-connection org-ownership gate, and the eviction delegation. The
 * eviction itself is the Discard leg's `evictConsumedWorkspace`, pinned
 * end-to-end by the extension's workspace-eviction suite; here it is a
 * mock so the boundary's gates are tested in isolation.
 */

import { SYNC_MUTATION_TYPE, SYNC_WORKSPACE_RETRACT_TYPE } from '@openheaders/core/protocol';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const bindings = new Map<string, string>();
const workspaces = new Map<string, { id: string; orgId: string; name: string }>();
const evictConsumedWorkspace = vi.fn(async (_id: string) => ({ ok: true as const }));

vi.mock('@openheaders/core/identity', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@openheaders/core/identity')>()),
  getOrgBackendBindings: () => bindings,
}));
vi.mock('@openheaders/oracle/workspace/extension-workspace-store', () => ({
  getWorkspace: (id: string) => workspaces.get(id),
}));
vi.mock('@openheaders/oracle/workspace/workspace-eviction', () => ({
  evictConsumedWorkspace: (id: string) => evictConsumedWorkspace(id),
}));

import { handleIncomingWorkspaceRetractFrame } from '../../../src/sync/client/workspace-retraction-receiver';

const WIRE = { backendId: 'backend-1', isLoopback: () => false };

beforeEach(() => {
  bindings.clear();
  workspaces.clear();
  evictConsumedWorkspace.mockClear();
});

describe('handleIncomingWorkspaceRetractFrame', () => {
  it('leaves non-retract frames unclaimed', async () => {
    expect(await handleIncomingWorkspaceRetractFrame({ type: SYNC_MUTATION_TYPE }, WIRE)).toBe(false);
    expect(await handleIncomingWorkspaceRetractFrame(null, WIRE)).toBe(false);
    expect(await handleIncomingWorkspaceRetractFrame('nope', WIRE)).toBe(false);
    expect(evictConsumedWorkspace).not.toHaveBeenCalled();
  });

  it('claims but drops a malformed retract frame', async () => {
    expect(await handleIncomingWorkspaceRetractFrame({ type: SYNC_WORKSPACE_RETRACT_TYPE }, WIRE)).toBe(true);
    expect(
      await handleIncomingWorkspaceRetractFrame({ type: SYNC_WORKSPACE_RETRACT_TYPE, workspaceId: '' }, WIRE),
    ).toBe(true);
    expect(evictConsumedWorkspace).not.toHaveBeenCalled();
  });

  it('claims a retraction of an already-absent workspace without evicting', async () => {
    expect(
      await handleIncomingWorkspaceRetractFrame({ type: SYNC_WORKSPACE_RETRACT_TYPE, workspaceId: 'ws-gone' }, WIRE),
    ).toBe(true);
    expect(evictConsumedWorkspace).not.toHaveBeenCalled();
  });

  it('drops a retraction of a workspace whose Org is not bound to the delivering wire', async () => {
    workspaces.set('ws-home', { id: 'ws-home', orgId: 'org-home', name: 'Local' });
    workspaces.set('ws-other', { id: 'ws-other', orgId: 'org-other', name: 'Other backend' });
    bindings.set('org-other', 'backend-2');
    // Home-org workspace: no binding at all — structurally unretractable.
    expect(
      await handleIncomingWorkspaceRetractFrame({ type: SYNC_WORKSPACE_RETRACT_TYPE, workspaceId: 'ws-home' }, WIRE),
    ).toBe(true);
    // Another backend's workspace: bound elsewhere — this wire may not evict it.
    expect(
      await handleIncomingWorkspaceRetractFrame({ type: SYNC_WORKSPACE_RETRACT_TYPE, workspaceId: 'ws-other' }, WIRE),
    ).toBe(true);
    expect(evictConsumedWorkspace).not.toHaveBeenCalled();
  });

  it('evicts a workspace the delivering wire owns, and tolerates an eviction failure', async () => {
    workspaces.set('ws-team', { id: 'ws-team', orgId: 'org-server', name: 'Team' });
    bindings.set('org-server', 'backend-1');
    expect(
      await handleIncomingWorkspaceRetractFrame({ type: SYNC_WORKSPACE_RETRACT_TYPE, workspaceId: 'ws-team' }, WIRE),
    ).toBe(true);
    expect(evictConsumedWorkspace).toHaveBeenCalledExactlyOnceWith('ws-team');

    evictConsumedWorkspace.mockResolvedValueOnce({ ok: false, reason: 'not-initialized' } as never);
    expect(
      await handleIncomingWorkspaceRetractFrame({ type: SYNC_WORKSPACE_RETRACT_TYPE, workspaceId: 'ws-team' }, WIRE),
    ).toBe(true);
  });
});
