/**
 * Coverage for the host-neutral capability resolver
 * (UNIFIED_ORACLE_MODEL.md §5.8). Slice 1 of Phase U2.
 *
 * Pinned invariants:
 *   - Standalone identity rows resolve to ALLOW through the same branches
 *     a connected LocalAdmin row would. The resolver does NOT consult
 *     `user.isStandalone` (§5.3 — informational only).
 *   - LocalAdmin auto-allows every `workspace.*` capability regardless of
 *     WRA presence (matches §5.8 example).
 *   - With no LocalAdmin, the WRA gate enforces three-tier role.
 *   - Missing snapshot → DENY with `no-current-user`. Missing workspaceId
 *     on a `workspace.*` capability → DENY.
 *   - `daemon.admin` requires LocalAdmin; `workspaceId` is irrelevant.
 *   - Registry: `installIdentitySnapshot` builds the WRA map; refresher
 *     reads through `HostStorage` and lands the same snapshot.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import type { IdentitySnapshot } from '../../src/identity';
import {
  authorizedOrgIds,
  clearIdentitySnapshot,
  consumedOrgIds,
  ensureSyntheticIdentity,
  ensureWorkspaceRoleAssignments,
  getIdentitySnapshot,
  hasCapability,
  installIdentitySnapshot,
  refreshIdentitySnapshotFromHostStorage,
  WORKSPACE_CREATE_FUNCTIONAL_ROLE,
} from '../../src/identity';
import { hostStorage, setHostStorage } from '../../src/storage/host-storage';
import { OH } from '../../src/storage/keys';
import type { DaemonAdmin, Org, OrgMembership, Principal, User, WorkspaceRoleAssignment } from '../../src/types';
import { createHostStorageFake } from './_host-storage-fake';

const NOW = '2026-05-19T00:00:00.000Z';
const W1 = '01900000-aaaa-7000-8000-000000000001';
const W2 = '01900000-aaaa-7000-8000-000000000002';

function makeSnapshot(
  overrides: {
    localAdmin?: DaemonAdmin | null;
    wras?: ReadonlyArray<WorkspaceRoleAssignment>;
    user?: Partial<User>;
    membership?: Partial<OrgMembership>;
    /** Extra Org ids folded into `snapshot.orgs` — the multi-org / joined-backend case (Phase U5). */
    extraOrgIds?: ReadonlyArray<string>;
  } = {},
): IdentitySnapshot {
  const user: User = {
    id: '01900000-aaaa-7000-8000-000000000aaa',
    displayName: 'Local',
    homeOrgId: '01900000-aaaa-7000-8000-000000000bbb',
    isStandalone: true,
    ...overrides.user,
  };
  const principal: Principal = {
    id: '01900000-aaaa-7000-8000-000000000ccc',
    userId: user.id,
    orgId: user.homeOrgId,
  };
  const membership: OrgMembership = {
    id: '01900000-aaaa-7000-8000-000000000ddd',
    userId: user.id,
    orgId: user.homeOrgId,
    primaryRole: 'owner',
    functionalRoles: [],
    ...overrides.membership,
  };
  const localAdmin =
    overrides.localAdmin === undefined
      ? ({ id: '01900000-aaaa-7000-8000-000000000eee', userId: user.id, isLocal: true } satisfies DaemonAdmin)
      : (overrides.localAdmin ?? undefined);

  const wraByWorkspaceId = new Map<string, WorkspaceRoleAssignment>();
  for (const wra of overrides.wras ?? []) {
    wraByWorkspaceId.set(wra.workspaceId, wra);
  }
  const orgs = new Map<string, Org>([
    [user.homeOrgId, { id: user.homeOrgId, name: 'Local', hostKind: 'browser', isPrivate: true }],
  ]);
  for (const orgId of overrides.extraOrgIds ?? []) {
    orgs.set(orgId, { id: orgId, name: `Joined ${orgId}`, hostKind: 'desktop', isPrivate: false });
  }
  return { user, principal, membership, localAdmin, wraByWorkspaceId, orgs };
}

function makeWra(workspaceId: string, role: WorkspaceRoleAssignment['role']): WorkspaceRoleAssignment {
  return {
    id: `01900000-bbbb-7000-8000-${workspaceId.slice(-12)}`,
    principalId: '01900000-aaaa-7000-8000-000000000ccc',
    workspaceId,
    role,
  };
}

describe('hasCapability', () => {
  it('denies when no snapshot is installed', () => {
    expect(hasCapability(null, 'workspace.read', { workspaceId: W1 })).toEqual({
      allow: false,
      reason: 'no-current-user',
    });
  });

  it('allows workspace.read for LocalAdmin on any workspace', () => {
    const snap = makeSnapshot();
    expect(hasCapability(snap, 'workspace.read', { workspaceId: W1 })).toEqual({ allow: true });
  });

  it('allows workspace.write for LocalAdmin on any workspace', () => {
    const snap = makeSnapshot();
    expect(hasCapability(snap, 'workspace.write', { workspaceId: W2 })).toEqual({ allow: true });
  });

  it('allows daemon.admin for LocalAdmin', () => {
    const snap = makeSnapshot();
    expect(hasCapability(snap, 'daemon.admin', {})).toEqual({ allow: true });
  });

  it('denies daemon.admin when LocalAdmin is absent', () => {
    const snap = makeSnapshot({ localAdmin: null });
    expect(hasCapability(snap, 'daemon.admin', {})).toEqual({
      allow: false,
      reason: 'not-daemon-admin',
    });
  });

  it('requires workspaceId for workspace.* capabilities', () => {
    const snap = makeSnapshot();
    expect(hasCapability(snap, 'workspace.read', {})).toEqual({
      allow: false,
      reason: 'workspace-id-required',
    });
  });

  it('falls through to WRA when LocalAdmin is absent — allow read for viewer', () => {
    const snap = makeSnapshot({ localAdmin: null, wras: [makeWra(W1, 'viewer')] });
    expect(hasCapability(snap, 'workspace.read', { workspaceId: W1 })).toEqual({ allow: true });
  });

  it('falls through to WRA when LocalAdmin is absent — deny write for viewer', () => {
    const snap = makeSnapshot({ localAdmin: null, wras: [makeWra(W1, 'viewer')] });
    expect(hasCapability(snap, 'workspace.write', { workspaceId: W1 })).toEqual({
      allow: false,
      reason: 'insufficient-workspace-role',
    });
  });

  it('allows write for editor and owner', () => {
    const editor = makeSnapshot({ localAdmin: null, wras: [makeWra(W1, 'editor')] });
    const owner = makeSnapshot({ localAdmin: null, wras: [makeWra(W2, 'owner')] });
    expect(hasCapability(editor, 'workspace.write', { workspaceId: W1 }).allow).toBe(true);
    expect(hasCapability(owner, 'workspace.write', { workspaceId: W2 }).allow).toBe(true);
  });

  it('denies when no WRA exists for the workspace and user is not LocalAdmin', () => {
    const snap = makeSnapshot({ localAdmin: null, wras: [] });
    expect(hasCapability(snap, 'workspace.read', { workspaceId: W1 })).toEqual({
      allow: false,
      reason: 'no-workspace-role-assignment',
    });
  });

  it('allows workspace.list for any installed snapshot regardless of LocalAdmin', () => {
    const synthetic = makeSnapshot();
    const noLocalAdmin = makeSnapshot({ localAdmin: null });
    expect(hasCapability(synthetic, 'workspace.list', {})).toEqual({ allow: true });
    expect(hasCapability(noLocalAdmin, 'workspace.list', {})).toEqual({ allow: true });
  });

  it('denies workspace.list when no snapshot is installed', () => {
    expect(hasCapability(null, 'workspace.list', {})).toEqual({
      allow: false,
      reason: 'no-current-user',
    });
  });

  describe('workspace.create (org-scoped provisioning verb)', () => {
    it('allows for LocalAdmin', () => {
      expect(hasCapability(makeSnapshot(), 'workspace.create', {})).toEqual({ allow: true });
    });

    it('allows for org owner and admin primary roles without LocalAdmin', () => {
      const owner = makeSnapshot({ localAdmin: null, membership: { primaryRole: 'owner' } });
      const admin = makeSnapshot({ localAdmin: null, membership: { primaryRole: 'admin' } });
      expect(hasCapability(owner, 'workspace.create', {})).toEqual({ allow: true });
      expect(hasCapability(admin, 'workspace.create', {})).toEqual({ allow: true });
    });

    it('denies a plain member without the functional-role grant', () => {
      const member = makeSnapshot({ localAdmin: null, membership: { primaryRole: 'member' } });
      expect(hasCapability(member, 'workspace.create', {})).toEqual({
        allow: false,
        reason: 'workspace-create-not-granted',
      });
    });

    it('allows a member carrying the workspace.create functional role', () => {
      const granted = makeSnapshot({
        localAdmin: null,
        membership: { primaryRole: 'member', functionalRoles: [WORKSPACE_CREATE_FUNCTIONAL_ROLE] },
      });
      expect(hasCapability(granted, 'workspace.create', {})).toEqual({ allow: true });
    });

    it('needs no workspaceId — the subject does not exist yet', () => {
      const snap = makeSnapshot({ localAdmin: null, membership: { primaryRole: 'member' } });
      expect(hasCapability(snap, 'workspace.create', { workspaceId: W1 }).allow).toBe(false);
      expect(hasCapability(snap, 'workspace.create', {}).allow).toBe(false);
    });

    it('denies when no snapshot is installed', () => {
      expect(hasCapability(null, 'workspace.create', {})).toEqual({ allow: false, reason: 'no-current-user' });
    });
  });

  it('does not consult isStandalone — connected user with same shape resolves identically', () => {
    const standalone = makeSnapshot({ user: { isStandalone: true } });
    const connected = makeSnapshot({ user: { isStandalone: false } });
    expect(hasCapability(standalone, 'workspace.write', { workspaceId: W1 })).toEqual(
      hasCapability(connected, 'workspace.write', { workspaceId: W1 }),
    );
  });
});

describe('identity registry', () => {
  beforeEach(() => {
    clearIdentitySnapshot();
    setHostStorage(createHostStorageFake());
  });

  it('installIdentitySnapshot wires WRAs onto a workspace-id map', async () => {
    const record = await ensureSyntheticIdentity({ hostKind: 'browser', now: NOW });
    // The map holds the record principal's own rows (foreign-principal
    // grants share the slot since Phase 5 and are filtered out).
    const wras = [makeWra(W1, 'owner'), makeWra(W2, 'editor')].map((wra) => ({
      ...wra,
      principalId: record.principal.id,
    }));
    const snap = installIdentitySnapshot({ record, wras });
    expect(snap.wraByWorkspaceId.get(W1)?.role).toBe('owner');
    expect(snap.wraByWorkspaceId.get(W2)?.role).toBe('editor');
    expect(getIdentitySnapshot()).toBe(snap);
  });

  it('refreshIdentitySnapshotFromHostStorage hydrates from persisted record + WRAs', async () => {
    await ensureSyntheticIdentity({ hostKind: 'browser', now: NOW });
    await ensureWorkspaceRoleAssignments([W1]);
    clearIdentitySnapshot();
    const snap = await refreshIdentitySnapshotFromHostStorage();
    expect(snap).not.toBeNull();
    expect(snap?.wraByWorkspaceId.get(W1)?.role).toBe('owner');
  });

  it('refresher returns null when no synthetic identity is persisted', async () => {
    const snap = await refreshIdentitySnapshotFromHostStorage();
    expect(snap).toBeNull();
  });

  it('clearIdentitySnapshot drops the in-memory mirror', async () => {
    const record = await ensureSyntheticIdentity({ hostKind: 'browser', now: NOW });
    installIdentitySnapshot({ record, wras: [] });
    expect(getIdentitySnapshot()).not.toBeNull();
    clearIdentitySnapshot();
    expect(getIdentitySnapshot()).toBeNull();
  });
});

describe('synthetic identity resolves via the same path as real', () => {
  beforeEach(() => {
    clearIdentitySnapshot();
    setHostStorage(createHostStorageFake());
  });

  it('end-to-end synthetic boot → LocalAdmin → workspace.write ALLOW', async () => {
    const record = await ensureSyntheticIdentity({ hostKind: 'browser', now: NOW });
    const wras = await ensureWorkspaceRoleAssignments([W1]);
    installIdentitySnapshot({ record, wras });

    expect(hasCapability(getIdentitySnapshot(), 'workspace.write', { workspaceId: W1 })).toEqual({
      allow: true,
    });
  });

  it('end-to-end: snapshot persists across a wipe-and-refresh cycle', async () => {
    const record = await ensureSyntheticIdentity({ hostKind: 'browser', now: NOW });
    await ensureWorkspaceRoleAssignments([W1]);
    installIdentitySnapshot({ record, wras: (await hostStorage.get(OH.workspaceRoleAssignments)) ?? [] });

    clearIdentitySnapshot();
    const recovered = await refreshIdentitySnapshotFromHostStorage();
    expect(recovered?.user.id).toBe(record.user.id);
    expect(hasCapability(recovered, 'workspace.write', { workspaceId: W1 }).allow).toBe(true);
  });
});

describe('authorizedOrgIds', () => {
  it('returns the empty set for a null snapshot (pre-bootstrap deny-all)', () => {
    expect([...authorizedOrgIds(null)]).toEqual([]);
  });

  it('returns the single home Org for a fresh V5 install', () => {
    const snap = makeSnapshot();
    expect([...authorizedOrgIds(snap)]).toEqual([snap.user.homeOrgId]);
  });

  it('folds every joined Org into the set (multi-org / joined backend)', () => {
    const joinedA = '01900000-cccc-7000-8000-000000000001';
    const joinedB = '01900000-cccc-7000-8000-000000000002';
    const snap = makeSnapshot({ extraOrgIds: [joinedA, joinedB] });
    expect(authorizedOrgIds(snap)).toEqual(new Set([snap.user.homeOrgId, joinedA, joinedB]));
  });
});

describe('consumedOrgIds (U6.1 — outbound tenancy allow-set)', () => {
  it('returns the empty set for a null snapshot', () => {
    expect([...consumedOrgIds(null)]).toEqual([]);
  });

  it('returns the empty set for a fresh V5 install (only the home Org — nothing consumed)', () => {
    expect([...consumedOrgIds(makeSnapshot())]).toEqual([]);
  });

  it('returns every joined Org but never the home Org', () => {
    const joinedA = '01900000-cccc-7000-8000-000000000001';
    const joinedB = '01900000-cccc-7000-8000-000000000002';
    const snap = makeSnapshot({ extraOrgIds: [joinedA, joinedB] });
    expect(consumedOrgIds(snap)).toEqual(new Set([joinedA, joinedB]));
    expect(consumedOrgIds(snap).has(snap.user.homeOrgId)).toBe(false);
  });
});
