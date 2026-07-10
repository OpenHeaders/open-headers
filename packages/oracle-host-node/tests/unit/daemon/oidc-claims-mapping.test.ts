/**
 * Pure rows for the claims→grant mapping helpers: dot-path claim
 * extraction off the verified ID-token payload, and the rule fold into
 * the desired grant set (highest role wins a workspace mapped by
 * several rules; unknown workspaces are reported, never desired).
 */

import { describe, expect, it } from 'vitest';
import { desiredGrantsFromClaims, extractClaimValues } from '../../../src/daemon/oidc/claims-mapping';
import type { OidcClaimMappingRule } from '../../../src/daemon/oidc/oidc-config';

describe('extractClaimValues', () => {
  it('reads a top-level string array', () => {
    expect(extractClaimValues({ groups: ['eng', 'ops'] }, 'groups')).toEqual(['eng', 'ops']);
  });

  it('reads a nested dot-path (Keycloak realm roles shape)', () => {
    const payload = { realm_access: { roles: ['default-roles', 'eng'] } };
    expect(extractClaimValues(payload, 'realm_access.roles')).toEqual(['default-roles', 'eng']);
  });

  it('wraps a single-string leaf', () => {
    expect(extractClaimValues({ department: 'eng' }, 'department')).toEqual(['eng']);
  });

  it('yields the empty set on missing paths and non-string leaves', () => {
    expect(extractClaimValues({}, 'groups')).toEqual([]);
    expect(extractClaimValues({ groups: 42 }, 'groups')).toEqual([]);
    expect(extractClaimValues({ realm_access: 'not-an-object' }, 'realm_access.roles')).toEqual([]);
    expect(extractClaimValues({ groups: ['eng', 7, null] }, 'groups')).toEqual(['eng']);
  });
});

describe('desiredGrantsFromClaims', () => {
  const W1 = '01900000-bbbb-7000-8000-000000000001';
  const W2 = '01900000-bbbb-7000-8000-000000000002';
  const RULES: readonly OidcClaimMappingRule[] = [
    { value: 'eng', workspaceId: W1, role: 'editor' },
    { value: 'leads', workspaceId: W1, role: 'owner' },
    { value: 'ops', workspaceId: W2, role: 'viewer' },
  ];

  it('desires exactly the rules whose value the claims carry', () => {
    const { desired, unknownWorkspaceIds } = desiredGrantsFromClaims(['ops'], RULES, () => true);
    expect(desired).toEqual([{ workspaceId: W2, role: 'viewer' }]);
    expect(unknownWorkspaceIds).toEqual([]);
  });

  it('the highest role wins a workspace mapped by several matched rules', () => {
    const { desired } = desiredGrantsFromClaims(['eng', 'leads'], RULES, () => true);
    expect(desired).toEqual([{ workspaceId: W1, role: 'owner' }]);
  });

  it('reports unknown workspaces instead of desiring them', () => {
    const { desired, unknownWorkspaceIds } = desiredGrantsFromClaims(['eng', 'ops'], RULES, (id) => id === W2);
    expect(desired).toEqual([{ workspaceId: W2, role: 'viewer' }]);
    expect(unknownWorkspaceIds).toEqual([W1]);
  });

  it('no claim values ⇒ empty desired set (fail-closed)', () => {
    expect(desiredGrantsFromClaims([], RULES, () => true).desired).toEqual([]);
  });
});
