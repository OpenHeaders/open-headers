/**
 * Phase B — projector reads post-commit state for oauth-bundle envelopes
 * and returns null for non-matching envelopes / cold-oracle cases.
 */

import {
  deleteOAuthToken,
  type MutationEnvelope,
  type MutatorContext,
  RULE_ENTITY_TYPE,
  setOAuthToken,
} from '@openheaders/core/sync';
import { describe, expect, it } from 'vitest';
import { InMemoryBroadcast } from '@openheaders/oracle/sync/broadcast';
import { InMemoryMutationLog } from '@openheaders/oracle/sync/mutation-log';
import {
  projectOAuthBundlePostState,
  projectOAuthBundleSingleton,
} from '@openheaders/oracle/sync/post-state/oauth-bundle-post-state';
import { type LockAcquirer, EntityOracle } from '@openheaders/oracle/sync/oracle';
import { InMemoryPendingIntents } from '@openheaders/oracle/sync/pending-intents';
import {
  type OAuthBundleSnapshot,
  seedOAuthBundle,
} from '@openheaders/core/sync-builders/projections/oauth-bundle-projection';

const wsId = 'ws-1';
const lock: LockAcquirer = async (_ws, _t, _id, fn) => fn();
const ctx = (ms: number): MutatorContext => ({
  workspaceId: wsId,
  hlc: { physicalMs: ms, logical: 0, nodeId: 'n0' },
  surfaceId: 's',
  deviceId: 'd',
});

const emptySnapshot = (): OAuthBundleSnapshot => ({
  schemaVersion: 5,
  tokens: {},
  configs: {},
  refreshErrors: {},
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

describe('projectOAuthBundlePostState', () => {
  it('returns post-state after seed + setOAuthToken', async () => {
    const oracle = newOracle();
    await oracle.apply(seedOAuthBundle(emptySnapshot(), ctx(1)), []);
    const intent = setOAuthToken(ctx(2), {
      credentialRef: 'cred-1',
      bundle: { accessToken: 'at', refreshToken: 'rt' },
      config: { tokenEndpoint: 'https://oauth.openheaders.io/token' },
    });
    const result = await oracle.apply(intent.batch, []);
    expect(result.ok).toBe(true);

    const post = projectOAuthBundlePostState(oracle, intent.batch.mutations[0]);
    expect(post).not.toBeNull();
    expect(Object.keys(post?.tokens ?? {})).toEqual(['cred-1']);
    expect(Object.keys(post?.configs ?? {})).toEqual(['cred-1']);
    expect(post?.refreshErrors).toEqual({});
    expect(post?.credentialRefs).toEqual(['cred-1']);
  });

  it('rebuilds Records from set items via liveSetItems', async () => {
    const oracle = newOracle();
    await oracle.apply(seedOAuthBundle(emptySnapshot(), ctx(1)), []);
    await oracle.apply(
      setOAuthToken(ctx(2), { credentialRef: 'a', bundle: { accessToken: 'A' } }).batch,
      [],
    );
    await oracle.apply(
      setOAuthToken(ctx(3), { credentialRef: 'b', bundle: { accessToken: 'B' } }).batch,
      [],
    );
    const post = projectOAuthBundleSingleton(oracle);
    expect(post?.tokens).toMatchObject({
      a: { accessToken: 'A' },
      b: { accessToken: 'B' },
    });
    expect(post?.credentialRefs).toEqual(['a', 'b']);
  });

  it('drops a credentialRef from all three maps after deleteOAuthToken', async () => {
    const oracle = newOracle();
    await oracle.apply(seedOAuthBundle(emptySnapshot(), ctx(1)), []);
    await oracle.apply(
      setOAuthToken(ctx(2), {
        credentialRef: 'cred-1',
        bundle: { accessToken: 'at' },
        config: { tokenEndpoint: 'https://oauth.openheaders.io/token' },
      }).batch,
      [],
    );
    await oracle.apply(deleteOAuthToken(ctx(3), { credentialRef: 'cred-1' }).batch, []);
    const post = projectOAuthBundleSingleton(oracle);
    expect(post?.tokens).toEqual({});
    expect(post?.configs).toEqual({});
    expect(post?.refreshErrors).toEqual({});
    expect(post?.credentialRefs).toEqual([]);
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
    expect(projectOAuthBundlePostState(oracle, ruleEnvelope)).toBeNull();
  });

  it('returns null on a cold oracle (singleton not yet seeded)', () => {
    const oracle = newOracle();
    expect(projectOAuthBundleSingleton(oracle)).toBeNull();
  });
});
