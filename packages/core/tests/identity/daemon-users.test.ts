/**
 * Coverage for the daemon-local user directory (Phase 5 team tier,
 * slice 1) — create / list / deactivate over `OH.daemonUsers`, the
 * token→user binding on the auth-token ledger, and the admission-side
 * `resolveDaemonPeerUser` join (unbound token → daemon operator).
 */

import * as v from 'valibot';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  absorbPersonalSeat,
  createDaemonUser,
  deactivateDaemonUser,
  ensureSyntheticIdentity,
  findDaemonUserByEmail,
  listDaemonUsers,
  mintDaemonAuthToken,
  type ResolvedAuditEntry,
  replacePersonalSeatArtifact,
  resetAuditSink,
  resolveDaemonPeerUser,
  resolveDaemonUserGitAttribution,
  setAuditSink,
  setDaemonUserGitEmail,
  setDaemonUserPassword,
  setDaemonUserWorkspaceCreate,
  validateDaemonAuthToken,
  WORKSPACE_CREATE_FUNCTIONAL_ROLE,
} from '../../src/identity';
import {
  FREE_SEAT_LIMIT,
  type LicensedSnapshot,
  type LicenseSnapshot,
  setLicenseSnapshotProvider,
  setPersonalSeatRedemptionProvider,
} from '../../src/licensing';
import { DaemonUserRecordSchema } from '../../src/schemas';
import { hostStorage, setHostStorage } from '../../src/storage/host-storage';
import { OH } from '../../src/storage/keys';
import { createDevSigner, makeLicense } from '../licensing/helpers/dev-license';
import { createHostStorageFake, type HostStorageFake } from './_host-storage-fake';

describe('daemon users', () => {
  let fake: HostStorageFake;

  beforeEach(async () => {
    fake = createHostStorageFake();
    setHostStorage(fake);
    await ensureSyntheticIdentity({ hostKind: 'daemon', now: '2026-07-09T00:00:00.000Z' });
  });

  it('creates a user with the full §5 row tuple anchored in the daemon Org', async () => {
    const identity = await hostStorage.get(OH.syntheticIdentity);
    const result = await createDaemonUser({ displayName: 'Alice', email: 'alice@openheaders.io', now: () => 1111 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { record } = result;
    expect(v.safeParse(DaemonUserRecordSchema, record).success).toBe(true);
    expect(record.user.displayName).toBe('Alice');
    expect(record.user.homeOrgId).toBe(identity?.org.id);
    expect(record.user.isStandalone).toBe(false);
    expect(record.userIdentity.kind).toBe('email');
    expect(record.userIdentity.value).toBe('alice@openheaders.io');
    expect(record.userIdentity.isPrimary).toBe(true);
    expect(record.membership.orgId).toBe(identity?.org.id);
    expect(record.membership.primaryRole).toBe('member');
    expect(record.principal.userId).toBe(record.user.id);
    expect(record.createdAt).toBe(1111);
    expect(record.deactivatedAt).toBeNull();
    // The operator's identity is never duplicated into the directory.
    expect(record.user.id).not.toBe(identity?.user.id);
  });

  it('creates a local-kind identity row when no email is given', async () => {
    const result = await createDaemonUser({ displayName: 'CI runner' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.record.userIdentity.kind).toBe('local');
    expect(result.record.userIdentity.value).toBeNull();
  });

  it('refuses an empty display name and a duplicate email (case-insensitively)', async () => {
    const empty = await createDaemonUser({ displayName: '   ' });
    expect(empty).toEqual({ ok: false, reason: 'empty-display-name' });
    const first = await createDaemonUser({ displayName: 'Alice', email: 'alice@openheaders.io' });
    expect(first.ok).toBe(true);
    const dup = await createDaemonUser({ displayName: 'Alice 2', email: 'Alice@OPENHEADERS.IO' });
    expect(dup).toEqual({ ok: false, reason: 'duplicate-email' });
  });

  it("re-admits a deactivated user's email as a fresh record (add-anew lifecycle)", async () => {
    const first = await createDaemonUser({ displayName: 'Alice', email: 'alice@openheaders.io' });
    if (!first.ok) throw new Error('setup failed');
    await deactivateDaemonUser(first.record.user.id);
    const again = await createDaemonUser({ displayName: 'Alice', email: 'alice@openheaders.io' });
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(again.record.user.id).not.toBe(first.record.user.id);
    // Both records persist — the deactivated one stays for audit continuity.
    expect(await listDaemonUsers()).toHaveLength(2);
  });

  it('lists every record including deactivated ones, in insertion order', async () => {
    const a = await createDaemonUser({ displayName: 'Alice' });
    const b = await createDaemonUser({ displayName: 'Bob' });
    if (!a.ok || !b.ok) throw new Error('setup failed');
    await deactivateDaemonUser(a.record.user.id, () => 2222);
    const list = await listDaemonUsers();
    expect(list).toHaveLength(2);
    expect(list[0].user.displayName).toBe('Alice');
    expect(list[0].deactivatedAt).toBe(2222);
    expect(list[1].deactivatedAt).toBeNull();
  });

  it('deactivate refuses unknown ids and double-deactivation', async () => {
    expect(await deactivateDaemonUser('nope')).toEqual({ ok: false, reason: 'unknown-user' });
    const a = await createDaemonUser({ displayName: 'Alice' });
    if (!a.ok) throw new Error('setup failed');
    expect(await deactivateDaemonUser(a.record.user.id)).toEqual({ ok: true });
    expect(await deactivateDaemonUser(a.record.user.id)).toEqual({ ok: false, reason: 'already-deactivated' });
  });

  it('concurrent creates both persist (store lock)', async () => {
    const [a, b] = await Promise.all([
      createDaemonUser({ displayName: 'Alice' }),
      createDaemonUser({ displayName: 'Bob' }),
    ]);
    expect(a.ok && b.ok).toBe(true);
    expect(await listDaemonUsers()).toHaveLength(2);
  });

  it('binds a minted token to a user and validation carries the binding', async () => {
    const created = await createDaemonUser({ displayName: 'Alice' });
    if (!created.ok) throw new Error('setup failed');
    const userId = created.record.user.id;
    const { record, secret } = await mintDaemonAuthToken({ label: 'alice laptop', userId });
    expect(record.userId).toBe(userId);
    const result = await validateDaemonAuthToken(secret);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.userId).toBe(userId);
  });

  it('an unbound token validates with no userId', async () => {
    const { secret } = await mintDaemonAuthToken({ label: 'solo' });
    const result = await validateDaemonAuthToken(secret);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.userId).toBeUndefined();
  });

  describe('findDaemonUserByEmail', () => {
    it('finds a record case-insensitively and returns deactivated ones too', async () => {
      const created = await createDaemonUser({ displayName: 'Alice', email: 'Alice@openheaders.io' });
      expect(created.ok).toBe(true);
      if (!created.ok) return;
      const found = await findDaemonUserByEmail('alice@OPENHEADERS.IO');
      expect(found?.user.id).toBe(created.record.user.id);
      await deactivateDaemonUser(created.record.user.id);
      const foundAfter = await findDaemonUserByEmail('alice@openheaders.io');
      expect(foundAfter?.user.id).toBe(created.record.user.id);
      expect(foundAfter?.deactivatedAt).not.toBeNull();
    });

    it('prefers the active holder when a deactivated record shares the email', async () => {
      const first = await createDaemonUser({ displayName: 'Alice', email: 'alice@openheaders.io' });
      if (!first.ok) throw new Error('setup failed');
      await deactivateDaemonUser(first.record.user.id);
      const again = await createDaemonUser({ displayName: 'Alice', email: 'alice@openheaders.io' });
      if (!again.ok) throw new Error('setup failed');
      const found = await findDaemonUserByEmail('alice@openheaders.io');
      expect(found?.user.id).toBe(again.record.user.id);
      expect(found?.deactivatedAt).toBeNull();
    });

    it('returns null for unknown, empty, and local-kind identities', async () => {
      await createDaemonUser({ displayName: 'NoMail' });
      expect(await findDaemonUserByEmail('nobody@openheaders.io')).toBeNull();
      expect(await findDaemonUserByEmail('   ')).toBeNull();
    });
  });

  describe('setDaemonUserPassword', () => {
    it('sets, replaces, and clears the opaque verifier; the record keeps validating', async () => {
      const created = await createDaemonUser({ displayName: 'Alice', email: 'alice@openheaders.io' });
      if (!created.ok) throw new Error('setup failed');
      const userId = created.record.user.id;
      expect(await setDaemonUserPassword(userId, 'scrypt$1$1$1$salt$hash')).toEqual({ ok: true });
      let found = await findDaemonUserByEmail('alice@openheaders.io');
      expect(found?.passwordVerifier).toBe('scrypt$1$1$1$salt$hash');
      expect(v.safeParse(DaemonUserRecordSchema, found).success).toBe(true);
      expect(await setDaemonUserPassword(userId, 'scrypt$2$2$2$salt2$hash2')).toEqual({ ok: true });
      found = await findDaemonUserByEmail('alice@openheaders.io');
      expect(found?.passwordVerifier).toBe('scrypt$2$2$2$salt2$hash2');
      expect(await setDaemonUserPassword(userId, null)).toEqual({ ok: true });
      found = await findDaemonUserByEmail('alice@openheaders.io');
      expect(found?.passwordVerifier).toBeUndefined();
      expect(v.safeParse(DaemonUserRecordSchema, found).success).toBe(true);
    });

    it('refuses unknown and deactivated users', async () => {
      expect(await setDaemonUserPassword('nope', 'v')).toEqual({ ok: false, reason: 'unknown-user' });
      const created = await createDaemonUser({ displayName: 'Alice' });
      if (!created.ok) throw new Error('setup failed');
      await deactivateDaemonUser(created.record.user.id);
      expect(await setDaemonUserPassword(created.record.user.id, 'v')).toEqual({
        ok: false,
        reason: 'user-deactivated',
      });
    });
  });

  describe('setDaemonUserGitEmail', () => {
    it('sets, replaces, and clears the override; the record keeps validating', async () => {
      const created = await createDaemonUser({ displayName: 'Alice', email: 'alice@openheaders.io' });
      if (!created.ok) throw new Error('setup failed');
      const userId = created.record.user.id;
      expect(await setDaemonUserGitEmail(userId, 'alice@users.noreply.openheaders.com')).toEqual({ ok: true });
      let found = await findDaemonUserByEmail('alice@openheaders.io');
      expect(found?.gitEmail).toBe('alice@users.noreply.openheaders.com');
      expect(v.safeParse(DaemonUserRecordSchema, found).success).toBe(true);
      expect(await setDaemonUserGitEmail(userId, '  alice@commits.openheaders.io  ')).toEqual({ ok: true });
      found = await findDaemonUserByEmail('alice@openheaders.io');
      expect(found?.gitEmail).toBe('alice@commits.openheaders.io');
      expect(await setDaemonUserGitEmail(userId, null)).toEqual({ ok: true });
      found = await findDaemonUserByEmail('alice@openheaders.io');
      expect(found?.gitEmail).toBeUndefined();
      expect(v.safeParse(DaemonUserRecordSchema, found).success).toBe(true);
    });

    it('treats a blank string as clear and refuses unknown/deactivated users', async () => {
      const created = await createDaemonUser({ displayName: 'Alice', email: 'alice@openheaders.io' });
      if (!created.ok) throw new Error('setup failed');
      const userId = created.record.user.id;
      await setDaemonUserGitEmail(userId, 'alice@commits.openheaders.io');
      expect(await setDaemonUserGitEmail(userId, '   ')).toEqual({ ok: true });
      expect((await findDaemonUserByEmail('alice@openheaders.io'))?.gitEmail).toBeUndefined();
      expect(await setDaemonUserGitEmail('nope', 'x@openheaders.io')).toEqual({ ok: false, reason: 'unknown-user' });
      await deactivateDaemonUser(userId);
      expect(await setDaemonUserGitEmail(userId, 'x@openheaders.io')).toEqual({
        ok: false,
        reason: 'user-deactivated',
      });
    });
  });

  describe('resolveDaemonUserGitAttribution', () => {
    it('walks gitEmail → identity email → synthetic noreply; name is always displayName', async () => {
      const created = await createDaemonUser({ displayName: 'Alice', email: 'alice@openheaders.io' });
      if (!created.ok) throw new Error('setup failed');
      const userId = created.record.user.id;
      expect(await resolveDaemonUserGitAttribution(userId)).toEqual({ name: 'Alice', email: 'alice@openheaders.io' });
      await setDaemonUserGitEmail(userId, 'alice@commits.openheaders.io');
      expect(await resolveDaemonUserGitAttribution(userId)).toEqual({
        name: 'Alice',
        email: 'alice@commits.openheaders.io',
      });
      const local = await createDaemonUser({ displayName: 'CI runner' });
      if (!local.ok) throw new Error('setup failed');
      expect(await resolveDaemonUserGitAttribution(local.record.user.id)).toEqual({
        name: 'CI runner',
        email: `${local.record.user.id}@users.noreply.openheaders.com`,
      });
    });

    it('resolves the operator, keeps resolving deactivated users, and returns null for unknowns', async () => {
      const identity = await hostStorage.get(OH.syntheticIdentity);
      if (!identity) throw new Error('setup failed');
      expect(await resolveDaemonUserGitAttribution(identity.user.id)).toEqual({
        name: identity.user.displayName,
        email: `${identity.user.id}@users.noreply.openheaders.com`,
      });
      const created = await createDaemonUser({ displayName: 'Alice', email: 'alice@openheaders.io' });
      if (!created.ok) throw new Error('setup failed');
      await deactivateDaemonUser(created.record.user.id);
      expect(await resolveDaemonUserGitAttribution(created.record.user.id)).toEqual({
        name: 'Alice',
        email: 'alice@openheaders.io',
      });
      expect(await resolveDaemonUserGitAttribution('nope')).toBeNull();
    });
  });

  describe('setDaemonUserWorkspaceCreate', () => {
    it('grants and revokes the functional role, idempotently, and the record keeps validating', async () => {
      const created = await createDaemonUser({ displayName: 'Alice', email: 'alice@openheaders.io' });
      if (!created.ok) throw new Error('setup failed');
      const userId = created.record.user.id;

      expect(await setDaemonUserWorkspaceCreate(userId, true)).toEqual({ ok: true, updated: true });
      let found = await findDaemonUserByEmail('alice@openheaders.io');
      expect(found?.membership.functionalRoles).toContain(WORKSPACE_CREATE_FUNCTIONAL_ROLE);
      expect(v.safeParse(DaemonUserRecordSchema, found).success).toBe(true);

      // Idempotent: re-granting reports no update and adds no duplicate.
      expect(await setDaemonUserWorkspaceCreate(userId, true)).toEqual({ ok: true, updated: false });
      found = await findDaemonUserByEmail('alice@openheaders.io');
      expect(found?.membership.functionalRoles.filter((r) => r === WORKSPACE_CREATE_FUNCTIONAL_ROLE)).toHaveLength(1);

      expect(await setDaemonUserWorkspaceCreate(userId, false)).toEqual({ ok: true, updated: true });
      found = await findDaemonUserByEmail('alice@openheaders.io');
      expect(found?.membership.functionalRoles).not.toContain(WORKSPACE_CREATE_FUNCTIONAL_ROLE);
      expect(await setDaemonUserWorkspaceCreate(userId, false)).toEqual({ ok: true, updated: false });
    });

    it('refuses unknown and deactivated users', async () => {
      expect(await setDaemonUserWorkspaceCreate('nope', true)).toEqual({ ok: false, reason: 'unknown-user' });
      const created = await createDaemonUser({ displayName: 'Alice' });
      if (!created.ok) throw new Error('setup failed');
      await deactivateDaemonUser(created.record.user.id);
      expect(await setDaemonUserWorkspaceCreate(created.record.user.id, true)).toEqual({
        ok: false,
        reason: 'user-deactivated',
      });
    });
  });

  describe('resolveDaemonPeerUser', () => {
    it('resolves an unbound token to the daemon operator', async () => {
      const identity = await hostStorage.get(OH.syntheticIdentity);
      const resolved = await resolveDaemonPeerUser(undefined);
      expect(resolved.ok).toBe(true);
      if (resolved.ok) expect(resolved.userId).toBe(identity?.user.id);
    });

    it('resolves a bound token to the directory user', async () => {
      const created = await createDaemonUser({ displayName: 'Alice' });
      if (!created.ok) throw new Error('setup failed');
      const resolved = await resolveDaemonPeerUser(created.record.user.id);
      expect(resolved).toEqual({ ok: true, userId: created.record.user.id, displayName: 'Alice' });
    });

    it('refuses a deactivated user', async () => {
      const created = await createDaemonUser({ displayName: 'Alice' });
      if (!created.ok) throw new Error('setup failed');
      await deactivateDaemonUser(created.record.user.id);
      expect(await resolveDaemonPeerUser(created.record.user.id)).toEqual({ ok: false, reason: 'user-deactivated' });
    });

    it('refuses a binding that matches no directory record', async () => {
      expect(await resolveDaemonPeerUser('01890000-0000-7000-8000-000000000000')).toEqual({
        ok: false,
        reason: 'unknown-user',
      });
    });
  });

  describe('seat gate (the licensing plan §4)', () => {
    const LICENSED_BASE: Omit<LicensedSnapshot, 'status' | 'seats'> = {
      licenseId: 'lic-0001',
      licensee: { name: 'Ada Example', org: 'OpenHeaders', email: 'ada@openheaders.io' },
      entitlements: [],
      validUntil: Date.UTC(2026, 6, 1),
      graceEndsAt: Date.UTC(2026, 6, 22),
    };

    afterEach(() => {
      setLicenseSnapshotProvider(null);
      resetAuditSink();
    });

    async function fillSeats(count: number): Promise<void> {
      for (let i = 0; i < count; i++) {
        const created = await createDaemonUser({ displayName: `User ${i}`, email: `user${i}@openheaders.io` });
        if (!created.ok) throw new Error(`seat setup failed at ${i}: ${created.reason}`);
      }
    }

    it('admits up to the free limit unlicensed, then refuses with an audit row', async () => {
      const auditRows: ResolvedAuditEntry[] = [];
      setAuditSink((entry) => auditRows.push(entry));
      await fillSeats(FREE_SEAT_LIMIT);
      const refused = await createDaemonUser({ displayName: 'One Too Many' });
      expect(refused).toEqual({ ok: false, reason: 'seat-limit-reached', seatLimit: FREE_SEAT_LIMIT });
      const identity = await hostStorage.get(OH.syntheticIdentity);
      expect(auditRows).toEqual([
        expect.objectContaining({
          actorUserId: identity?.user.id,
          capability: 'daemon.seat-admit',
          decision: { allow: false, reason: 'seat-limit-reached' },
          orgId: identity?.org.id,
        }),
      ]);
      expect((await listDaemonUsers()).length).toBe(FREE_SEAT_LIMIT);
    });

    it('a licensed snapshot raises the limit; the seat past it still refuses', async () => {
      setLicenseSnapshotProvider(() => ({ status: 'licensed', seats: 12, ...LICENSED_BASE }));
      await fillSeats(12);
      const refused = await createDaemonUser({ displayName: 'Seat 13' });
      expect(refused).toEqual({ ok: false, reason: 'seat-limit-reached', seatLimit: 12 });
    });

    it('grace still admits the licensed seats', async () => {
      setLicenseSnapshotProvider(() => ({ status: 'grace', seats: 11, ...LICENSED_BASE }));
      await fillSeats(11);
      expect(await createDaemonUser({ displayName: 'Seat 12' })).toMatchObject({ reason: 'seat-limit-reached' });
    });

    it('deactivating a user frees the seat immediately', async () => {
      await fillSeats(FREE_SEAT_LIMIT);
      const users = await listDaemonUsers();
      await deactivateDaemonUser(users[0].user.id);
      const created = await createDaemonUser({ displayName: 'Replacement' });
      expect(created.ok).toBe(true);
    });

    it('past grace, NEW growth reverts to the free limit while existing users stand', async () => {
      let snapshot: LicenseSnapshot = { status: 'licensed', seats: 12, ...LICENSED_BASE };
      setLicenseSnapshotProvider(() => snapshot);
      await fillSeats(12);
      snapshot = { status: 'expired', seats: 12, ...LICENSED_BASE };
      const refused = await createDaemonUser({ displayName: 'Post Grace' });
      expect(refused).toEqual({ ok: false, reason: 'seat-limit-reached', seatLimit: FREE_SEAT_LIMIT });
      // The wall only faces new growth: every existing record is intact.
      expect((await listDaemonUsers()).filter((r) => r.deactivatedAt === null).length).toBe(12);
    });
  });

  describe('personal-seat admission', () => {
    /** In-term against makeLicense's validUntil (July 2026). */
    const NOW = () => Date.UTC(2026, 3, 1);
    const HOLDER_EMAIL = 'ada@openheaders.io';

    afterEach(() => {
      setLicenseSnapshotProvider(null);
      setPersonalSeatRedemptionProvider(null);
      resetAuditSink();
    });

    async function fillPool(): Promise<void> {
      for (let i = 0; i < FREE_SEAT_LIMIT; i++) {
        const created = await createDaemonUser({ displayName: `User ${i}`, email: `user${i}@openheaders.io` });
        if (!created.ok) throw new Error(`seat setup failed at ${i}: ${created.reason}`);
      }
    }

    async function signPersonal(overrides: Parameters<typeof makeLicense>[0] = {}) {
      const signer = await createDevSigner();
      const license = makeLicense({
        kind: 'personal-seat',
        seats: 1,
        licenseId: 'lic-personal-1',
        licensee: { name: 'Ada Example', email: HOLDER_EMAIL },
        ...overrides,
      });
      return { signer, license, text: await signer.sign(license) };
    }

    it('admits the identity-matching holder past the exhausted pool with provenance + allow audit row', async () => {
      await fillPool();
      const { signer, text } = await signPersonal();
      const auditRows: ResolvedAuditEntry[] = [];
      setAuditSink((entry) => auditRows.push(entry));
      const created = await createDaemonUser({
        displayName: 'Ada',
        email: HOLDER_EMAIL,
        personalLicense: text,
        ring: signer.ring,
        now: NOW,
      });
      expect(created.ok).toBe(true);
      if (!created.ok) return;
      expect(created.record.admission).toEqual({
        kind: 'personal',
        licenseId: 'lic-personal-1',
        licenseKey: text.replace(/\s+/g, ''),
      });
      expect(v.safeParse(DaemonUserRecordSchema, created.record).success).toBe(true);
      expect(auditRows).toEqual([
        expect.objectContaining({ capability: 'daemon.seat-admit', decision: { allow: true } }),
      ]);
    });

    it('pool-first under capacity: the presented license goes unread and provenance stays pool', async () => {
      const { signer, text } = await signPersonal();
      const created = await createDaemonUser({
        displayName: 'Ada',
        email: HOLDER_EMAIL,
        personalLicense: text,
        ring: signer.ring,
        now: NOW,
      });
      expect(created.ok).toBe(true);
      if (!created.ok) return;
      expect(created.record.admission).toBeUndefined();
    });

    it("refuses someone else's license — the anti-sharing refusal", async () => {
      await fillPool();
      const { signer, text } = await signPersonal();
      const created = await createDaemonUser({
        displayName: 'Grace',
        email: 'grace@openheaders.io',
        personalLicense: text,
        ring: signer.ring,
        now: NOW,
      });
      expect(created).toEqual({ ok: false, reason: 'personal-license-identity-mismatch' });
    });

    it('refuses an org license, a foreign signature, and an expired artifact on the personal path', async () => {
      await fillPool();
      const { signer, text: orgText } = await signPersonal({ kind: undefined });
      const org = await createDaemonUser({
        displayName: 'Ada',
        email: HOLDER_EMAIL,
        personalLicense: orgText,
        ring: signer.ring,
        now: NOW,
      });
      expect(org).toEqual({ ok: false, reason: 'personal-license-invalid' });

      const foreign = await createDaemonUser({
        displayName: 'Ada',
        email: HOLDER_EMAIL,
        personalLicense: orgText,
        ring: (await createDevSigner()).ring,
        now: NOW,
      });
      expect(foreign).toEqual({ ok: false, reason: 'personal-license-invalid' });

      const { signer: s2, text: expired } = await signPersonal({ validUntil: Date.UTC(2026, 0, 1), graceDays: 0 });
      const late = await createDaemonUser({
        displayName: 'Ada',
        email: HOLDER_EMAIL,
        personalLicense: expired,
        ring: s2.ring,
        now: NOW,
      });
      expect(late).toEqual({ ok: false, reason: 'personal-license-invalid' });
    });

    it('grace admits — a renewal courtesy, not a degradation', async () => {
      await fillPool();
      const { signer, text } = await signPersonal({ validUntil: Date.UTC(2026, 2, 20), graceDays: 21 });
      const created = await createDaemonUser({
        displayName: 'Ada',
        email: HOLDER_EMAIL,
        personalLicense: text,
        ring: signer.ring,
        now: NOW,
      });
      expect(created.ok).toBe(true);
    });

    it('a bare local user without an email cannot redeem', async () => {
      await fillPool();
      const { signer, text } = await signPersonal();
      const created = await createDaemonUser({
        displayName: 'Anon',
        personalLicense: text,
        ring: signer.ring,
        now: NOW,
      });
      expect(created).toEqual({ ok: false, reason: 'personal-license-no-identity' });
    });

    it('the procurement knob refuses redemption when off', async () => {
      setPersonalSeatRedemptionProvider(() => false);
      await fillPool();
      const { signer, text } = await signPersonal();
      const created = await createDaemonUser({
        displayName: 'Ada',
        email: HOLDER_EMAIL,
        personalLicense: text,
        ring: signer.ring,
        now: NOW,
      });
      expect(created).toEqual({ ok: false, reason: 'personal-seats-disabled' });
    });

    it('one active admission per license: the holder email cannot hold two records', async () => {
      await fillPool();
      const { signer, text } = await signPersonal();
      const input = { displayName: 'Ada', email: HOLDER_EMAIL, personalLicense: text, ring: signer.ring, now: NOW };
      expect((await createDaemonUser(input)).ok).toBe(true);
      expect(await createDaemonUser(input)).toEqual({ ok: false, reason: 'duplicate-email' });
    });

    it('absorb-into-pool clears the provenance once and refuses pool records', async () => {
      await fillPool();
      const { signer, text } = await signPersonal();
      const created = await createDaemonUser({
        displayName: 'Ada',
        email: HOLDER_EMAIL,
        personalLicense: text,
        ring: signer.ring,
        now: NOW,
      });
      if (!created.ok) throw new Error('setup failed');
      expect(await absorbPersonalSeat(created.record.user.id)).toEqual({ ok: true });
      const absorbed = (await listDaemonUsers()).find((r) => r.user.id === created.record.user.id);
      expect(absorbed?.admission).toBeUndefined();
      expect(v.safeParse(DaemonUserRecordSchema, absorbed).success).toBe(true);
      expect(await absorbPersonalSeat(created.record.user.id)).toEqual({ ok: false, reason: 'not-personal' });
      expect(await absorbPersonalSeat('nope')).toEqual({ ok: false, reason: 'unknown-user' });
    });

    it('replacePersonalSeatArtifact swaps the stored key by lineage id, idempotently', async () => {
      await fillPool();
      const { signer, text } = await signPersonal();
      const created = await createDaemonUser({
        displayName: 'Ada',
        email: HOLDER_EMAIL,
        personalLicense: text,
        ring: signer.ring,
        now: NOW,
      });
      if (!created.ok) throw new Error('setup failed');
      const renewed = await signer.sign(
        makeLicense({
          kind: 'personal-seat',
          seats: 1,
          licenseId: 'lic-personal-1',
          licensee: { name: 'Ada Example', email: HOLDER_EMAIL },
          validUntil: Date.UTC(2026, 8, 1),
        }),
      );
      expect(await replacePersonalSeatArtifact('lic-personal-1', renewed)).toBe(1);
      const after = (await listDaemonUsers()).find((r) => r.user.id === created.record.user.id);
      expect(after?.admission?.licenseKey).toBe(renewed.replace(/\s+/g, ''));
      // Same artifact again — nothing to change.
      expect(await replacePersonalSeatArtifact('lic-personal-1', renewed)).toBe(0);
      expect(await replacePersonalSeatArtifact('lic-unknown', renewed)).toBe(0);
    });
  });
});
