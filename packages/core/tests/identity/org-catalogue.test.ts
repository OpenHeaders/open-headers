/**
 * org-catalogue helpers — the pure projection from an IdentitySnapshot
 * to the workspace org-binding UI's data (UNIFIED_ORACLE_MODEL.md §6.2 /
 * §6.4). Multi-org-native: every case here is pure over `snapshot.orgs`.
 */

import { describe, expect, it } from 'vitest';
import {
  defaultNewWorkspaceOrgId,
  describeOrg,
  type OrgDescriptor,
  orgCatalogue,
  orgHostHintKind,
  orgIdentityLabel,
} from '../../src/identity/org-catalogue';
import type { IdentitySnapshot } from '../../src/identity/resolver';
import type { Org, OrgMembership, Principal, User } from '../../src/types';

const LOCAL_ORG = '01900000-aaaa-7000-8000-0000000000a1';
const HOME_ORG = '01900000-aaaa-7000-8000-0000000000a2';
const TEAM_ORG = '01900000-aaaa-7000-8000-0000000000a3';
const USER_ID = '01900000-aaaa-7000-8000-0000000000b1';

function makeSnapshot(orgs: Org[], homeOrgId: string): IdentitySnapshot {
  const user: User = { id: USER_ID, displayName: 'U', homeOrgId, isStandalone: true };
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

const privateHome: Org = { id: LOCAL_ORG, name: 'This device', hostKind: 'browser', isPrivate: true };
const realHome: Org = { id: HOME_ORG, name: 'My account', hostKind: 'desktop', isPrivate: false };
const realTeam: Org = { id: TEAM_ORG, name: 'Acme', hostKind: 'daemon', isPrivate: false };

describe('orgCatalogue', () => {
  it('returns an empty list for a null snapshot', () => {
    expect(orgCatalogue(null)).toEqual([]);
  });

  it('classifies a lone private home-org as local', () => {
    const catalogue = orgCatalogue(makeSnapshot([privateHome], LOCAL_ORG));
    expect(catalogue).toHaveLength(1);
    expect(catalogue[0]).toMatchObject({ scopeKind: 'local', isHome: true, isPrivate: true });
  });

  it('lights up all three scope kinds when the snapshot carries the right shapes', () => {
    // privateHome is the user's home Org (private, browser); realHome is a
    // joined desktop Org (single-user, personal); realTeam is a joined
    // daemon Org (multi-user). The home is LOCAL_ORG.
    const joinedDesktop: Org = { id: HOME_ORG, name: 'MacBook', hostKind: 'desktop', isPrivate: false };
    const joinedDaemon: Org = { id: TEAM_ORG, name: 'Acme', hostKind: 'daemon', isPrivate: false };
    const catalogue = orgCatalogue(makeSnapshot([privateHome, joinedDesktop, joinedDaemon], LOCAL_ORG));
    expect(catalogue.map((o) => o.scopeKind)).toEqual(['local', 'personal', 'team']);
    expect(catalogue.find((o) => o.id === LOCAL_ORG)?.isHome).toBe(true);
    expect(catalogue.find((o) => o.id === HOME_ORG)?.isHome).toBe(false);
  });

  it('orders local → personal → team regardless of insertion order', () => {
    const joinedDesktop: Org = { id: HOME_ORG, name: 'MacBook', hostKind: 'desktop', isPrivate: false };
    const joinedDaemon: Org = { id: TEAM_ORG, name: 'Acme', hostKind: 'daemon', isPrivate: false };
    const catalogue = orgCatalogue(makeSnapshot([joinedDaemon, privateHome, joinedDesktop], LOCAL_ORG));
    expect(catalogue.map((o) => o.scopeKind)).toEqual(['local', 'personal', 'team']);
  });

  it('classifies a joined non-daemon Org as personal — never local (registry boundary normalizes isPrivate)', () => {
    // This is the post-Q5 bug-3b regression guard: a joined desktop must
    // NOT classify as local just because the sender stamped isPrivate: true.
    // The registry boundary normalizes joined Orgs to isPrivate: false; the
    // classifier then resolves them to personal.
    const joinedDesktop: Org = { id: HOME_ORG, name: 'MacBook', hostKind: 'desktop', isPrivate: false };
    const catalogue = orgCatalogue(makeSnapshot([privateHome, joinedDesktop], LOCAL_ORG));
    expect(catalogue.find((o) => o.id === HOME_ORG)?.scopeKind).toBe('personal');
  });
});

describe('describeOrg', () => {
  it('resolves a known org-id to its descriptor', () => {
    const snap = makeSnapshot([privateHome], LOCAL_ORG);
    expect(describeOrg(snap, LOCAL_ORG)?.name).toBe('This device');
  });

  it('carries the Org hostKind onto the descriptor', () => {
    const snap = makeSnapshot([privateHome, realHome, realTeam], HOME_ORG);
    expect(describeOrg(snap, LOCAL_ORG)?.hostKind).toBe('browser');
    expect(describeOrg(snap, HOME_ORG)?.hostKind).toBe('desktop');
    expect(describeOrg(snap, TEAM_ORG)?.hostKind).toBe('daemon');
  });

  it('returns null for an org-id outside the authorized set', () => {
    const snap = makeSnapshot([privateHome], LOCAL_ORG);
    expect(describeOrg(snap, TEAM_ORG)).toBeNull();
    expect(describeOrg(null, LOCAL_ORG)).toBeNull();
  });
});

describe('orgIdentityLabel', () => {
  it('labels the home Org by its stored (renameable) name', () => {
    const browserHome = describeOrg(makeSnapshot([privateHome], LOCAL_ORG), LOCAL_ORG);
    expect(browserHome && orgIdentityLabel(browserHome)).toBe('This device');

    const desktopHome = describeOrg(makeSnapshot([realHome], HOME_ORG), HOME_ORG);
    expect(desktopHome && orgIdentityLabel(desktopHome)).toBe('My account');
  });

  it('labels a joined (non-home) Org by its stored name', () => {
    const snap = makeSnapshot([privateHome, realHome, realTeam], HOME_ORG);
    const joined = describeOrg(snap, TEAM_ORG);
    expect(joined && orgIdentityLabel(joined)).toBe('Acme');
  });

  it('reads a non-home Org by its stored name regardless of isPrivate', () => {
    // A registry-correct snapshot has joined Orgs at isPrivate: false; the
    // label is a pure projection of `name` either way.
    const snap = makeSnapshot([privateHome, realHome], HOME_ORG);
    const joined = describeOrg(snap, LOCAL_ORG);
    expect(joined && orgIdentityLabel(joined)).toBe('This device');
  });
});

describe('orgHostHintKind', () => {
  it('classifies the home Org into a second-person host-kind hint', () => {
    const browserHome = describeOrg(makeSnapshot([privateHome], LOCAL_ORG), LOCAL_ORG);
    expect(browserHome && orgHostHintKind(browserHome)).toBe('browser');

    const desktopHome = describeOrg(makeSnapshot([realHome], HOME_ORG), HOME_ORG);
    expect(desktopHome && orgHostHintKind(desktopHome)).toBe('desktop');

    const daemonHome = describeOrg(makeSnapshot([realTeam], TEAM_ORG), TEAM_ORG);
    // Daemon hint disambiguates by reach — unknown / loopback / lan all
    // classify as daemon-local; only wan deployments classify as remote.
    expect(daemonHome && orgHostHintKind(daemonHome)).toBe('daemon-local');
    expect(daemonHome && orgHostHintKind(daemonHome, 'lan')).toBe('daemon-local');
    expect(daemonHome && orgHostHintKind(daemonHome, 'wan')).toBe('daemon-remote');
  });

  it('gives a joined (non-home) Org no hint', () => {
    const snap = makeSnapshot([privateHome, realHome, realTeam], HOME_ORG);
    expect(orgHostHintKind(describeOrg(snap, TEAM_ORG) as OrgDescriptor)).toBeNull();
    expect(orgHostHintKind(describeOrg(snap, LOCAL_ORG) as OrgDescriptor)).toBeNull();
  });
});

describe('defaultNewWorkspaceOrgId', () => {
  it('returns the stored default when it names an authorized Org', () => {
    const snap = makeSnapshot([privateHome, realHome], HOME_ORG);
    expect(defaultNewWorkspaceOrgId(snap, LOCAL_ORG)).toBe(LOCAL_ORG);
  });

  it('ignores a stale stored default and picks the widest-reach Org', () => {
    // realHome is a desktop Org — wider reach than the browser local-org.
    const snap = makeSnapshot([privateHome, realHome], HOME_ORG);
    expect(defaultNewWorkspaceOrgId(snap, TEAM_ORG)).toBe(HOME_ORG);
  });

  it('defaults new workspaces to the widest-reach host, not the local browser', () => {
    // Home is the browser; a desktop Org was joined — new workspaces
    // follow the user up to the desktop rather than staying browser-local.
    const browserHome: Org = { id: LOCAL_ORG, name: 'Chrome', hostKind: 'browser', isPrivate: true };
    // Joined Orgs are normalized to isPrivate: false at the registry boundary.
    const joinedDesktop: Org = { id: HOME_ORG, name: 'MacBook', hostKind: 'desktop', isPrivate: false };
    const snap = makeSnapshot([browserHome, joinedDesktop], LOCAL_ORG);
    expect(defaultNewWorkspaceOrgId(snap, null)).toBe(HOME_ORG);
  });

  it('prefers a daemon Org over desktop and browser', () => {
    // realTeam is a daemon Org — the widest reach of the three.
    const snap = makeSnapshot([privateHome, realHome, realTeam], HOME_ORG);
    expect(defaultNewWorkspaceOrgId(snap, null)).toBe(TEAM_ORG);
  });

  it('defaults to the only Org when the identity holds just one', () => {
    const snap = makeSnapshot([privateHome], LOCAL_ORG);
    expect(defaultNewWorkspaceOrgId(snap, null)).toBe(LOCAL_ORG);
  });

  it('on a same-reach tie, prefers the joined Org over the home-org', () => {
    const browserHome: Org = { id: LOCAL_ORG, name: 'Chrome', hostKind: 'browser', isPrivate: true };
    const joinedBrowser: Org = { id: HOME_ORG, name: 'Firefox', hostKind: 'browser', isPrivate: false };
    const snap = makeSnapshot([browserHome, joinedBrowser], LOCAL_ORG);
    expect(defaultNewWorkspaceOrgId(snap, null)).toBe(HOME_ORG);
  });

  it('returns null for a null snapshot', () => {
    expect(defaultNewWorkspaceOrgId(null, HOME_ORG)).toBeNull();
  });
});
