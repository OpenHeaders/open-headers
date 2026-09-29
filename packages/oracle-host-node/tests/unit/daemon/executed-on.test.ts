/**
 * The `executedOn` stamp names this host the way it names itself
 * everywhere else — its home Org's name from the live identity
 * snapshot — and falls back to the OS hostname label only while no
 * identity exists (inside a container that label is the container id).
 */

import { describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  identity: null as unknown,
}));

vi.mock('@openheaders/core/identity', () => ({
  getIdentitySnapshot: () => h.identity,
}));

vi.mock('../../../src/daemon/host-os', () => ({
  hostDisplayLabel: () => '59e15c2a087b',
}));

import { daemonExecutedOn } from '../../../src/daemon/executed-on';

function identity(homeOrgName: string): unknown {
  return {
    user: { homeOrgId: 'org-home' },
    orgs: new Map([['org-home', { id: 'org-home', name: homeOrgName, hostKind: 'daemon', isPrivate: false }]]),
  };
}

describe('daemonExecutedOn', () => {
  it('reads the home Org’s name — the server as the switcher names it', () => {
    h.identity = identity('Access Rig');
    expect(daemonExecutedOn()).toEqual({ kind: 'backend', name: 'Access Rig' });
  });

  it('falls back to the hostname label with no identity or a blank Org name', () => {
    h.identity = null;
    expect(daemonExecutedOn()).toEqual({ kind: 'backend', name: '59e15c2a087b' });
    h.identity = identity('   ');
    expect(daemonExecutedOn()).toEqual({ kind: 'backend', name: '59e15c2a087b' });
  });
});
