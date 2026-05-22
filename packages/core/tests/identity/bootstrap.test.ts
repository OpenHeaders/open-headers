/**
 * Coverage for the synthetic-row bootstrap helper (U1.5 — pure of host
 * transport per UNIFIED_ORACLE_STATUS.md).
 *
 * Pinned invariants:
 *   - Deterministic in `hostInstallId`: same input → byte-identical rows.
 *   - The returned tuple forms a connected FK graph
 *     (`user.homeOrgId === org.id`, `principal.userId === user.id`, etc.).
 *   - Every row id passes the `UuidV7Schema`; every row passes its
 *     entity schema (no shape drift between helper and validator).
 *   - Two distinct `hostInstallId`s produce disjoint id sets — load-bearing
 *     for the cross-org filter (§6.1) that makes Mode-1 hosts naturally
 *     non-overlapping.
 */

import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { bootstrapSyntheticIdentity } from '../../src/identity';
import {
  DaemonAdminSchema,
  OrgMembershipSchema,
  OrgSchema,
  PrincipalSchema,
  SessionSchema,
  UserIdentitySchema,
  UserSchema,
} from '../../src/schemas';

const NOW = '2026-05-19T00:00:00.000Z';

describe('bootstrapSyntheticIdentity', () => {
  it('produces a row tuple that conforms to every entity schema', async () => {
    const rows = await bootstrapSyntheticIdentity({ hostInstallId: 'host-abc', hostKind: 'desktop', now: NOW });
    expect(v.safeParse(UserSchema, rows.user).success).toBe(true);
    expect(v.safeParse(OrgSchema, rows.org).success).toBe(true);
    expect(v.safeParse(UserIdentitySchema, rows.userIdentity).success).toBe(true);
    expect(v.safeParse(SessionSchema, rows.session).success).toBe(true);
    expect(v.safeParse(OrgMembershipSchema, rows.membership).success).toBe(true);
    expect(v.safeParse(PrincipalSchema, rows.principal).success).toBe(true);
    expect(v.safeParse(DaemonAdminSchema, rows.localAdmin).success).toBe(true);
  });

  it('connects the FK graph (user ↔ org ↔ identity ↔ session ↔ membership ↔ principal ↔ localAdmin)', async () => {
    const r = await bootstrapSyntheticIdentity({ hostInstallId: 'host-abc', hostKind: 'desktop', now: NOW });
    expect(r.user.homeOrgId).toBe(r.org.id);
    expect(r.userIdentity.userId).toBe(r.user.id);
    expect(r.session.userId).toBe(r.user.id);
    expect(r.membership.userId).toBe(r.user.id);
    expect(r.membership.orgId).toBe(r.org.id);
    expect(r.principal.userId).toBe(r.user.id);
    expect(r.principal.orgId).toBe(r.org.id);
    expect(r.localAdmin.userId).toBe(r.user.id);
  });

  it('marks the synthetic axes (User.isSynthetic, Org.isSynthetic, kind=local, source=local, isLocal)', async () => {
    const r = await bootstrapSyntheticIdentity({ hostInstallId: 'host-abc', hostKind: 'desktop', now: NOW });
    expect(r.user.isSynthetic).toBe(true);
    expect(r.org.isSynthetic).toBe(true);
    expect(r.userIdentity.kind).toBe('local');
    expect(r.session.source).toBe('local');
    expect(r.localAdmin.isLocal).toBe(true);
    expect(r.membership.primaryRole).toBe('owner');
    expect(r.membership.functionalRoles).toEqual([]);
  });

  it('is deterministic in hostInstallId (rerun yields byte-identical rows)', async () => {
    const a = await bootstrapSyntheticIdentity({ hostInstallId: 'host-abc', hostKind: 'desktop', now: NOW });
    const b = await bootstrapSyntheticIdentity({ hostInstallId: 'host-abc', hostKind: 'desktop', now: NOW });
    expect(a).toEqual(b);
  });

  it('produces disjoint id sets for distinct hostInstallIds', async () => {
    const a = await bootstrapSyntheticIdentity({ hostInstallId: 'host-abc', hostKind: 'desktop', now: NOW });
    const b = await bootstrapSyntheticIdentity({ hostInstallId: 'host-xyz', hostKind: 'desktop', now: NOW });
    const idsA = new Set([
      a.user.id, a.org.id, a.userIdentity.id, a.session.id,
      a.membership.id, a.principal.id, a.localAdmin.id,
    ]);
    const idsB = new Set([
      b.user.id, b.org.id, b.userIdentity.id, b.session.id,
      b.membership.id, b.principal.id, b.localAdmin.id,
    ]);
    for (const id of idsB) {
      expect(idsA.has(id)).toBe(false);
    }
  });

  it('uses caller-supplied displayName / orgName / email when given', async () => {
    const r = await bootstrapSyntheticIdentity({
      hostInstallId: 'host-abc',
      hostKind: 'desktop',
      displayName: 'Alice',
      orgName: 'alice-laptop',
      email: 'alice@openheaders.io',
      now: NOW,
    });
    expect(r.user.displayName).toBe('Alice');
    expect(r.org.name).toBe('alice-laptop');
    expect(r.userIdentity.value).toBe('alice@openheaders.io');
  });

  it('stamps the caller-supplied hostKind onto the Org row', async () => {
    const browser = await bootstrapSyntheticIdentity({ hostInstallId: 'host-abc', hostKind: 'browser', now: NOW });
    const daemon = await bootstrapSyntheticIdentity({ hostInstallId: 'host-abc', hostKind: 'daemon', now: NOW });
    expect(browser.org.hostKind).toBe('browser');
    expect(daemon.org.hostKind).toBe('daemon');
  });

  it('defaults displayName/orgName to "Local" and email to null', async () => {
    const r = await bootstrapSyntheticIdentity({ hostInstallId: 'host-abc', hostKind: 'desktop', now: NOW });
    expect(r.user.displayName).toBe('Local');
    expect(r.org.name).toBe('Local');
    expect(r.userIdentity.value).toBeNull();
  });

  it('threads `now` into verifiedAt and createdAt and leaves revokedAt null', async () => {
    const r = await bootstrapSyntheticIdentity({ hostInstallId: 'host-abc', hostKind: 'desktop', now: NOW });
    expect(r.userIdentity.verifiedAt).toBe(NOW);
    expect(r.session.createdAt).toBe(NOW);
    expect(r.session.revokedAt).toBeNull();
  });
});
