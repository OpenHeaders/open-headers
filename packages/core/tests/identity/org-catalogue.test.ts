/**
 * org-catalogue helpers — the pure projection from an IdentitySnapshot
 * to the workspace org-binding UI's data (UNIFIED_ORACLE_MODEL.md §6.2 /
 * §6.4). Multi-org-native: every case here is pure over `snapshot.orgs`.
 */

import { describe, expect, it } from 'vitest';
import {
  defaultNewWorkspaceOrgId,
  describeOrg,
  orgCatalogue,
  shouldShowOrgOnboarding,
} from '../../src/identity/org-catalogue';
import type { IdentitySnapshot } from '../../src/identity/resolver';
import type { Org, OrgMembership, Principal, User } from '../../src/types';

const LOCAL_ORG = '01900000-aaaa-7000-8000-0000000000a1';
const HOME_ORG = '01900000-aaaa-7000-8000-0000000000a2';
const TEAM_ORG = '01900000-aaaa-7000-8000-0000000000a3';
const USER_ID = '01900000-aaaa-7000-8000-0000000000b1';

function makeSnapshot(orgs: Org[], homeOrgId: string): IdentitySnapshot {
  const user: User = { id: USER_ID, displayName: 'U', homeOrgId, isSynthetic: true };
  const principal: Principal = { id: 'p', userId: USER_ID, orgId: homeOrgId };
  const membership: OrgMembership = {
    id: 'm',
    userId: USER_ID,
    orgId: homeOrgId,
    primaryRole: 'owner',
    functionalRoles: [],
  };
  return {
    user,
    principal,
    membership,
    wraByWorkspaceId: new Map(),
    orgs: new Map(orgs.map((o) => [o.id, o])),
  };
}

const syntheticLocal: Org = { id: LOCAL_ORG, name: 'This device', isSynthetic: true };
const realHome: Org = { id: HOME_ORG, name: 'My account', isSynthetic: false };
const realTeam: Org = { id: TEAM_ORG, name: 'Acme', isSynthetic: false };

describe('orgCatalogue', () => {
  it('returns an empty list for a null snapshot', () => {
    expect(orgCatalogue(null)).toEqual([]);
  });

  it('classifies a lone synthetic home-org as local', () => {
    const catalogue = orgCatalogue(makeSnapshot([syntheticLocal], LOCAL_ORG));
    expect(catalogue).toHaveLength(1);
    expect(catalogue[0]).toMatchObject({ scopeKind: 'local', isHome: true, isSynthetic: true });
  });

  it('classifies a real home-org as personal and a real non-home org as team', () => {
    const catalogue = orgCatalogue(makeSnapshot([syntheticLocal, realHome, realTeam], HOME_ORG));
    expect(catalogue.map((o) => o.scopeKind)).toEqual(['local', 'personal', 'team']);
    expect(catalogue.find((o) => o.id === HOME_ORG)?.isHome).toBe(true);
    expect(catalogue.find((o) => o.id === TEAM_ORG)?.isHome).toBe(false);
  });

  it('orders local → personal → team regardless of insertion order', () => {
    const catalogue = orgCatalogue(makeSnapshot([realTeam, syntheticLocal, realHome], HOME_ORG));
    expect(catalogue.map((o) => o.scopeKind)).toEqual(['local', 'personal', 'team']);
  });
});

describe('describeOrg', () => {
  it('resolves a known org-id to its descriptor', () => {
    const snap = makeSnapshot([syntheticLocal], LOCAL_ORG);
    expect(describeOrg(snap, LOCAL_ORG)?.name).toBe('This device');
  });

  it('returns null for an org-id outside the authorized set', () => {
    const snap = makeSnapshot([syntheticLocal], LOCAL_ORG);
    expect(describeOrg(snap, TEAM_ORG)).toBeNull();
    expect(describeOrg(null, LOCAL_ORG)).toBeNull();
  });
});

describe('shouldShowOrgOnboarding', () => {
  it('is false with a single Org', () => {
    expect(shouldShowOrgOnboarding(makeSnapshot([syntheticLocal], LOCAL_ORG), null)).toBe(false);
  });

  it('is true with two Orgs and no acknowledgement', () => {
    expect(shouldShowOrgOnboarding(makeSnapshot([syntheticLocal, realHome], HOME_ORG), null)).toBe(true);
  });

  it('is false once acknowledged', () => {
    const snap = makeSnapshot([syntheticLocal, realHome], HOME_ORG);
    expect(shouldShowOrgOnboarding(snap, '2026-05-20T00:00:00.000Z')).toBe(false);
  });
});

describe('defaultNewWorkspaceOrgId', () => {
  it('returns the stored default when it names an authorized Org', () => {
    const snap = makeSnapshot([syntheticLocal, realHome], HOME_ORG);
    expect(defaultNewWorkspaceOrgId(snap, LOCAL_ORG)).toBe(LOCAL_ORG);
  });

  it('falls back to the home-org when the stored default is stale', () => {
    const snap = makeSnapshot([syntheticLocal, realHome], HOME_ORG);
    expect(defaultNewWorkspaceOrgId(snap, TEAM_ORG)).toBe(HOME_ORG);
  });

  it('falls back to the home-org when no default is stored', () => {
    const snap = makeSnapshot([syntheticLocal], LOCAL_ORG);
    expect(defaultNewWorkspaceOrgId(snap, null)).toBe(LOCAL_ORG);
  });

  it('returns null for a null snapshot', () => {
    expect(defaultNewWorkspaceOrgId(null, HOME_ORG)).toBeNull();
  });
});
