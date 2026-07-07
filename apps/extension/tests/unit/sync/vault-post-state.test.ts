/**
 * Phase B — projector reads post-commit state for vault envelopes and
 * returns null for non-matching envelopes / cold-oracle cases.
 * Mirrors workspace-variables-post-state.test.ts.
 */

import {
  type MutationEnvelope,
  type MutatorContext,
  RULE_ENTITY_TYPE,
  setVaultSecret,
  VAULT_ENTITY_TYPE,
  VAULT_ID,
  VAULT_PATH,
} from '@openheaders/core/sync';
import type { Vault, VaultSecret } from '@openheaders/core/types';
import { describe, expect, it } from 'vitest';
import { InMemoryBroadcast } from '@openheaders/oracle/sync/broadcast';
import { InMemoryMutationLog } from '@openheaders/oracle/sync/mutation-log';
import { type LockAcquirer, EntityOracle } from '@openheaders/oracle/sync/oracle';
import { InMemoryPendingIntents } from '@openheaders/oracle/sync/pending-intents';
import { projectVaultPostState, projectVaultSingleton } from '@openheaders/oracle/sync/post-state/vault-post-state';
import { seedVault } from '@openheaders/core/sync-builders/projections/vault-projection';

const wsId = 'ws-1';
const lock: LockAcquirer = async (_ws, _t, _id, fn) => fn();
const ctx = (ms: number): MutatorContext => ({
  workspaceId: wsId,
  hlc: { physicalMs: ms, logical: 0, nodeId: 'n0' },
  surfaceId: 's',
  deviceId: 'd',
});

const makeVault = (secrets: VaultSecret[]): Vault => ({
  schemaVersion: 5,
  
  secrets,
});

function newOracle(): EntityOracle {
  return new EntityOracle({
    workspaceId: wsId,
    lock,
    log: new InMemoryMutationLog(),
    intents: new InMemoryPendingIntents(),
    broadcast: new InMemoryBroadcast(),
  });
}

describe('projectVaultPostState', () => {
  it('returns post-state after seed + setVaultSecret', async () => {
    const oracle = newOracle();
    await oracle.apply(
      seedVault(
        makeVault([{ uid: 'scapikey1', kind: 'string', name: 'API_KEY', value: 'v' }]),
        ctx(1),
      ),
      [],
    );
    const setIntent = setVaultSecret(ctx(2), {
      secret: { uid: 'scnewxxxx', kind: 'string', name: 'NEW', value: 'v' },
    });
    const setResult = await oracle.apply(setIntent.batch, []);
    expect(setResult.ok).toBe(true);

    const envelope = setIntent.batch.mutations[0];
    const post = projectVaultPostState(oracle, envelope);
    expect(post).not.toBeNull();
    expect(post?.vault.secrets.map((s) => s.name).sort()).toEqual(['API_KEY', 'NEW']);
    // Set-member identity is the secret uid (post-session-66); `secretUids`
    // is the protocol field name but carries itemIds = uids.
    expect(post?.secretUids.sort()).toEqual(['scapikey1', 'scnewxxxx']);
  });

  it('preserves TOTP discriminator through projection', async () => {
    const oracle = newOracle();
    await oracle.apply(
      seedVault(
        makeVault([
          {
            uid: 'scotpaaaa',
            kind: 'totp',
            name: 'OTP',
            seed: 'JBSWY3DPEHPK3PXP',
            algorithm: 'SHA1',
            digits: 6,
            period: 30,
          },
        ]),
        ctx(1),
      ),
      [],
    );
    const post = projectVaultSingleton(oracle);
    expect(post?.vault.secrets[0]).toMatchObject({
      kind: 'totp',
      name: 'OTP',
      seed: 'JBSWY3DPEHPK3PXP',
    });
  });

  it('returns null for non-matching envelopes', () => {
    const oracle = newOracle();
    const ruleEnvelope: MutationEnvelope = {
      mutationId: 'm',
      hlc: { physicalMs: 1, logical: 0, nodeId: 'n' },
      origin: { surfaceId: 's', deviceId: 'd' },
      workspaceId: wsId,
      orgId: 'org-test',
      mutatorVersion: 1,
      body: { kind: 'setField', type: RULE_ENTITY_TYPE, id: 'r', path: 'name', value: 'x' },
    };
    expect(projectVaultPostState(oracle, ruleEnvelope)).toBeNull();
  });

  it('returns null on a cold oracle (singleton not yet seeded)', () => {
    const oracle = newOracle();
    expect(projectVaultSingleton(oracle)).toBeNull();
  });

  it('reports secretUids matching VAULT_PATH itemIds', async () => {
    const oracle = newOracle();
    await oracle.apply(
      seedVault(
        makeVault([
          { uid: 'scaxxxxxx', kind: 'string', name: 'A', value: '1' },
          { uid: 'scbxxxxxx', kind: 'string', name: 'B', value: '2' },
        ]),
        ctx(1),
      ),
      [],
    );
    const live = oracle.liveSetItems(VAULT_ENTITY_TYPE, VAULT_ID, VAULT_PATH);
    const projected = projectVaultSingleton(oracle);
    expect(projected?.secretUids.sort()).toEqual(live.map((e) => e.itemId).sort());
    // setOrderKeys carries the per-uid fractional-index keys at the secrets
    // path — same uid set as secretUids, each with a string orderKey.
    const orderKeys = projected?.setOrderKeys[VAULT_PATH] ?? [];
    expect(orderKeys.map((e) => e.itemId).sort()).toEqual(live.map((e) => e.itemId).sort());
    for (const e of orderKeys) expect(typeof e.orderKey).toBe('string');
  });
});
