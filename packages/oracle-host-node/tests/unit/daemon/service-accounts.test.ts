/**
 * Service accounts over the admin channels (the access-foundation plan
 * §8 F3) — the create channel's kind validation and the decision-e cap
 * remedy wording, the list projection's `kind` string, and the
 * data-plane-only refusals on the credential and functional-role
 * channels. Core gate mechanics (cap counting, email-less identity,
 * the audit stamp) are pinned in core's `daemon-users.test.ts`.
 */

import { createDaemonUser, ensureSyntheticIdentity } from '@openheaders/core/identity';
import { FREE_SERVICE_ACCOUNT_LIMIT } from '@openheaders/core/licensing';
import { setHostLogger } from '@openheaders/core/logger';
import { setHostStorage } from '@openheaders/core/storage';
import { logger as consoleLogger } from '@openheaders/core/utils';
import {
  bootstrap as bootstrapWorkspaceStore,
  listWorkspaces,
  __resetForTests as resetWorkspaceStore,
} from '@openheaders/oracle/workspace/extension-workspace-store';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHostStorageFake } from '../_host-storage-fake';
import { buildAdminChannels } from './_admin-channels-rig';

describe('service accounts over the admin channels', () => {
  let seededWorkspaceId: string;

  beforeEach(async () => {
    setHostLogger(consoleLogger);
    setHostStorage(createHostStorageFake());
    await ensureSyntheticIdentity({ hostKind: 'daemon' });
    // A2 holds for machines too: the create channel mandates an initial
    // grant, so the rig needs a live workspace to grant against.
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

  async function createService(displayName: string): Promise<string> {
    const table = buildAdminChannels();
    const created = (await handler(
      table,
      'oh.daemon.users.create',
    )({
      displayName,
      kind: 'service',
      grants: [{ workspaceId: seededWorkspaceId, role: 'editor' }],
    })) as { ok: boolean; userId?: string; error?: string };
    if (!created.ok || !created.userId) throw new Error(`setup failed: ${created.error}`);
    return created.userId;
  }

  it('creates a service account with a grant and projects kind + grants; humans project kind user', async () => {
    const table = buildAdminChannels();
    const serviceId = await createService('CI deployer');
    const human = await createDaemonUser({ displayName: 'Alice', email: 'alice@openheaders.io' });
    if (!human.ok) throw new Error('setup failed');

    const listed = (await handler(table, 'oh.daemon.users.list')({})) as {
      users: Array<{ userId: string; kind: string; email: string | null; hasPassword: boolean; grants: unknown[] }>;
    };
    const service = listed.users.find((u) => u.userId === serviceId);
    expect(service?.kind).toBe('service');
    expect(service?.email).toBeNull();
    expect(service?.hasPassword).toBe(false);
    expect(service?.grants).toEqual([{ workspaceId: seededWorkspaceId, role: 'editor' }]);
    // The pre-vocabulary human record projects the resolved default.
    expect(listed.users.find((u) => u.userId === human.record.user.id)?.kind).toBe('user');
  });

  it('refuses an unknown kind, an email, and an individual-seat key on a service admission', async () => {
    const table = buildAdminChannels();
    const create = handler(table, 'oh.daemon.users.create');
    const grants = [{ workspaceId: seededWorkspaceId, role: 'viewer' }];
    expect(await create({ displayName: 'Bot', kind: 'robot', grants })).toEqual({
      ok: false,
      error: 'kind must be user or service',
    });
    expect(await create({ displayName: 'Bot', kind: 'service', email: 'bot@openheaders.io', grants })).toEqual({
      ok: false,
      error: 'a service account cannot have an email — it never logs in',
    });
    expect(await create({ displayName: 'Bot', kind: 'service', personalLicense: 'oh-license.x.y', grants })).toEqual({
      ok: false,
      error: 'a service account holds no seat — an individual-seat key does not apply',
    });
  });

  it('the free cap refuses with the decision-e remedy wording', async () => {
    for (let i = 0; i < FREE_SERVICE_ACCOUNT_LIMIT; i++) await createService(`Bot ${i}`);
    const table = buildAdminChannels();
    const refused = (await handler(
      table,
      'oh.daemon.users.create',
    )({
      displayName: 'One Bot Too Many',
      kind: 'service',
      grants: [{ workspaceId: seededWorkspaceId, role: 'viewer' }],
    })) as { ok: boolean; reason?: string; error?: string };
    expect(refused.ok).toBe(false);
    expect(refused.reason).toBe('service-limit-reached');
    expect(refused.error).toBe(
      `service account limit reached (${FREE_SERVICE_ACCOUNT_LIMIT} on the free plan) — any paid license lifts the cap`,
    );
  });

  it('refuses the credential and both functional-role toggles — data-plane only', async () => {
    const table = buildAdminChannels();
    const userId = await createService('CI deployer');
    expect(await handler(table, 'oh.daemon.users.setPassword')({ userId, password: 'bot-password-1' })).toEqual({
      ok: false,
      error: 'service-account',
    });
    const roleError = { ok: false, error: 'a service account holds workspace grants only — no server roles' };
    expect(await handler(table, 'oh.daemon.users.setCreateWorkspaces')({ userId, allowed: true })).toEqual(roleError);
    expect(await handler(table, 'oh.daemon.users.setDaemonAdmin')({ userId, allowed: true })).toEqual(roleError);
  });

  it('grants, revokes, and deactivation stay the shared lifecycle', async () => {
    const table = buildAdminChannels();
    const userId = await createService('CI deployer');
    expect(await handler(table, 'oh.daemon.users.revokeGrant')({ userId, workspaceId: seededWorkspaceId })).toEqual({
      ok: true,
    });
    expect(
      await handler(table, 'oh.daemon.users.grant')({ userId, workspaceId: seededWorkspaceId, role: 'viewer' }),
    ).toMatchObject({ ok: true });
    expect(await handler(table, 'oh.daemon.users.deactivate')({ userId })).toEqual({ ok: true });
    const listed = (await handler(table, 'oh.daemon.users.list')({})) as {
      users: Array<{ userId: string; deactivatedAt: number | null }>;
    };
    expect(listed.users.find((u) => u.userId === userId)?.deactivatedAt).not.toBeNull();
  });
});
