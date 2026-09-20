/**
 * The invite's identity and credential over the admin channels (the
 * client sign-in plan D5): `users.setEmail` repairs a User admitted
 * without an email — the same active-only, case-folded duplicate rule
 * the admission applies, a typed `duplicate-email` refusal, and the
 * service-account refusal that keeps no-login structural; the create
 * channel's initial password lands in the same act as the admission
 * and is refused short or on a service admission; `auth.meta` answers
 * the composition facts the console shapes its invite form on. Core
 * verb mechanics are pinned in core's `daemon-users.test.ts`.
 */

import { createDaemonUser, ensureSyntheticIdentity, findDaemonUserByEmail } from '@openheaders/core/identity';
import { setHostLogger } from '@openheaders/core/logger';
import { setHostStorage } from '@openheaders/core/storage';
import { logger as consoleLogger } from '@openheaders/core/utils';
import {
  bootstrap as bootstrapWorkspaceStore,
  listWorkspaces,
  __resetForTests as resetWorkspaceStore,
} from '@openheaders/oracle/workspace/extension-workspace-store';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PASSWORD_MIN_LENGTH } from '../../../src/daemon/admin-channels';
import { createDaemonPasswordLoginService } from '../../../src/daemon/password/password-login-service';
import { createHostStorageFake } from '../_host-storage-fake';
import { buildAdminChannels } from './_admin-channels-rig';

describe('the invite over the admin channels (the client sign-in plan D5)', () => {
  let seededWorkspaceId: string;

  beforeEach(async () => {
    setHostLogger(consoleLogger);
    setHostStorage(createHostStorageFake());
    await ensureSyntheticIdentity({ hostKind: 'daemon' });
    await bootstrapWorkspaceStore({ seedOnEmpty: true });
    seededWorkspaceId = listWorkspaces()[0].id;
  });

  afterEach(() => {
    resetWorkspaceStore();
  });

  function handler(table: ReturnType<typeof buildAdminChannels>, channel: string) {
    const found = table.get(channel);
    if (!found) throw new Error(`channel missing: ${channel}`);
    return found;
  }

  function grants() {
    return [{ workspaceId: seededWorkspaceId, role: 'viewer' }];
  }

  describe('users.setEmail', () => {
    it('gives an email-less user the identity the login join needs, and the list projects it', async () => {
      const table = buildAdminChannels();
      const created = await createDaemonUser({ displayName: 'Alice' });
      if (!created.ok) throw new Error('setup failed');
      const userId = created.record.user.id;
      expect(await handler(table, 'oh.daemon.users.setEmail')({ userId, email: ' Alice@openheaders.io ' })).toEqual({
        ok: true,
      });
      expect((await findDaemonUserByEmail('alice@openheaders.io'))?.user.id).toBe(userId);
      const listed = (await handler(table, 'oh.daemon.users.list')({})) as {
        users: Array<{ userId: string; email: string | null }>;
      };
      expect(listed.users.find((u) => u.userId === userId)?.email).toBe('Alice@openheaders.io');
    });

    it('refuses a duplicate with its typed reason, an empty email, a service account, a deactivated and an unknown user', async () => {
      const table = buildAdminChannels();
      const setEmail = handler(table, 'oh.daemon.users.setEmail');
      const alice = await createDaemonUser({ displayName: 'Alice', email: 'alice@openheaders.io' });
      const bob = await createDaemonUser({ displayName: 'Bob' });
      const bot = await createDaemonUser({ displayName: 'CI deployer', kind: 'service' });
      const gone = await createDaemonUser({ displayName: 'Gone' });
      if (!alice.ok || !bob.ok || !bot.ok || !gone.ok) throw new Error('setup failed');
      expect(await setEmail({ userId: bob.record.user.id, email: 'ALICE@openheaders.io' })).toEqual({
        ok: false,
        reason: 'duplicate-email',
        error: 'another active user already has this email',
      });
      expect(await setEmail({ userId: bob.record.user.id, email: '   ' })).toEqual({
        ok: false,
        error: 'email is required',
      });
      expect(await setEmail({ userId: bot.record.user.id, email: 'bot@openheaders.io' })).toEqual({
        ok: false,
        error: 'a service account cannot have an email — it never logs in',
      });
      await handler(table, 'oh.daemon.users.deactivate')({ userId: gone.record.user.id });
      expect(await setEmail({ userId: gone.record.user.id, email: 'gone@openheaders.io' })).toEqual({
        ok: false,
        error: 'user is deactivated',
      });
      expect(await setEmail({ userId: 'nope', email: 'x@openheaders.io' })).toEqual({
        ok: false,
        error: 'unknown user',
      });
      expect(await setEmail({ email: 'x@openheaders.io' })).toEqual({ ok: false, error: 'missing userId' });
    });
  });

  describe('users.create with an initial password', () => {
    it('admits, grants, and sets the credential in one act — the person can sign in at once', async () => {
      const table = buildAdminChannels();
      const created = (await handler(
        table,
        'oh.daemon.users.create',
      )({ displayName: 'Alice', email: 'alice@openheaders.io', password: 'first-day-pass', grants: grants() })) as {
        ok: boolean;
        userId?: string;
      };
      expect(created.ok).toBe(true);
      const listed = (await handler(table, 'oh.daemon.users.list')({})) as {
        users: Array<{ userId: string; hasPassword: boolean; grants: unknown[] }>;
      };
      const row = listed.users.find((u) => u.userId === created.userId);
      expect(row?.hasPassword).toBe(true);
      expect(row?.grants).toHaveLength(1);
      const login = await createDaemonPasswordLoginService().login('alice@openheaders.io', 'first-day-pass');
      expect(login.ok && login.userId).toBe(created.userId);
    });

    it('refuses a short password before the admission and a password on a service account; absent stays passwordless', async () => {
      const table = buildAdminChannels();
      const create = handler(table, 'oh.daemon.users.create');
      expect(
        await create({ displayName: 'Alice', email: 'alice@openheaders.io', password: 'short', grants: grants() }),
      ).toEqual({ ok: false, error: `password must be at least ${PASSWORD_MIN_LENGTH} characters` });
      expect(await findDaemonUserByEmail('alice@openheaders.io')).toBeNull();
      expect(
        await create({ displayName: 'Bot', kind: 'service', password: 'bot-password-1', grants: grants() }),
      ).toEqual({ ok: false, error: 'a service account cannot have a password — it never logs in' });
      const bare = (await create({ displayName: 'Bob', email: 'bob@openheaders.io', grants: grants() })) as {
        ok: boolean;
        userId?: string;
      };
      expect(bare.ok).toBe(true);
      const listed = (await handler(table, 'oh.daemon.users.list')({})) as {
        users: Array<{ userId: string; hasPassword: boolean }>;
      };
      expect(listed.users.find((u) => u.userId === bare.userId)?.hasPassword).toBe(false);
    });
  });

  describe('auth.meta', () => {
    it('answers the composition facts, and neither when the spine declares none', async () => {
      expect(await handler(buildAdminChannels(), 'oh.daemon.auth.meta')({})).toEqual({
        passwordLogin: false,
        ssoProvider: null,
      });
      const password = buildAdminChannels({ authMeta: () => ({ passwordLogin: true, ssoProvider: null }) });
      expect(await handler(password, 'oh.daemon.auth.meta')({})).toEqual({ passwordLogin: true, ssoProvider: null });
      const sso = buildAdminChannels({ authMeta: () => ({ passwordLogin: false, ssoProvider: 'Example SSO' }) });
      expect(await handler(sso, 'oh.daemon.auth.meta')({})).toEqual({
        passwordLogin: false,
        ssoProvider: 'Example SSO',
      });
    });
  });
});
