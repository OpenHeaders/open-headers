/**
 * Property: a Request whose `auth` / `body` variants are switched any
 * number of times converges (§22.1) — for every interleaving of the
 * resulting envelopes the materialized snapshot is byte-identical — and
 * the final materialized variant equals the last write.
 *
 * The envelopes are produced by the real `buildUpdateBatch` path: a
 * `create` (which deep-flattens the seed `auth` / `body` to per-leaf
 * paths) followed by a sequence of per-leaf flatten-diffs, each baselined
 * on the previous materialized value. This is the exact write path the
 * editor drives — the test would fail under the old whole-object
 * `setField('auth', …)` because the create-time discriminant leaf would
 * survive and clobber the edit at materialize time.
 */

import { describe, expect, it } from 'vitest';
import { InMemoryDocumentStore, type MutationEnvelope, type MutatorContext } from '../../src/sync';
import { buildAddBatch, buildUpdateBatch } from '../../src/sync-builders/mutations/request-mutations';
import { projectRequest } from '../../src/sync-builders/projections/request-projection';
import type { AuthConfig, Request, RequestBody } from '../../src/types';
import { makeRng, type Rng } from '../sync/harness/random';

const SEED_BASE = 0x5e_3a_91_c4;
const SCENARIOS = 3_000;
const PERMUTATIONS = 4;

const ctx = (physicalMs: number, nodeId: string): MutatorContext => ({
  workspaceId: 'ws-1',
  orgId: 'org-test',
  hlc: { physicalMs, logical: 0, nodeId },
  surfaceId: 'workbench',
  deviceId: nodeId,
});

const noSets = () => [];

const seed: Request = {
  schemaVersion: 5,
  uid: 'rq-1',
  path: 'requests/My/Auth',
  name: 'Auth',
  method: 'GET',
  url: 'https://api.openheaders.io/v1/me',
  headers: [],
  params: [],
  auth: { type: 'inherit' },
  body: { type: 'none' },
};

function randomAuth(rng: Rng): AuthConfig {
  const n = rng.int(1_000).toString(36);
  switch (rng.int(5)) {
    case 0:
      return { type: 'none' };
    case 1:
      return { type: 'inherit' };
    case 2:
      return { type: 'basic', username: `u${n}`, password: `p${n}` };
    case 3:
      return { type: 'bearer', token: `t${n}` };
    default:
      return { type: 'api-key', key: `k${n}`, value: `v${n}`, in: rng.int(2) === 0 ? 'header' : 'query' };
  }
}

function randomBody(rng: Rng): RequestBody {
  const n = rng.int(1_000).toString(36);
  switch (rng.int(5)) {
    case 0:
      return { type: 'none' };
    case 1:
      return { type: 'json', content: `{"n":"${n}"}` };
    case 2:
      return { type: 'text', content: `t${n}`, rawFormat: 'text' };
    case 3:
      return { type: 'form', formParts: [{ uid: `f${n}`, key: `k${n}`, value: `v${n}`, enabled: true }] };
    default:
      return { type: 'graphql', content: `query ${n}` };
  }
}

interface Built {
  envelopes: MutationEnvelope[];
  lastAuth: AuthConfig;
  lastBody: RequestBody;
}

// Build a create + a chain of auth/body variant-switch field-diffs.
// Each diff is baselined on the previous value (single-surface sequential
// editing), so the materialized state after every step equals `current`.
function build(rng: Rng): Built {
  const envelopes: MutationEnvelope[] = [];
  const node = `node-${rng.int(0xffff).toString(16)}`;

  const create = buildAddBatch(seed, ctx(1, node));
  envelopes.push(...create.batch.mutations);

  let currentAuth: AuthConfig = seed.auth;
  let currentBody: RequestBody = seed.body;
  const steps = 2 + rng.int(5);
  let clock = 2;
  for (let i = 0; i < steps; i += 1) {
    if (rng.int(2) === 0) {
      const auth = randomAuth(rng);
      const payload = buildUpdateBatch('rq-1', { auth }, ctx(clock, node), noSets, () => currentAuth);
      envelopes.push(...payload.batch.mutations);
      currentAuth = auth;
    } else {
      const body = randomBody(rng);
      const payload = buildUpdateBatch('rq-1', { body }, ctx(clock, node), noSets, () => currentBody);
      envelopes.push(...payload.batch.mutations);
      currentBody = body;
    }
    clock += 1;
  }

  return { envelopes, lastAuth: currentAuth, lastBody: currentBody };
}

function applyOrder(envelopes: readonly MutationEnvelope[]): string {
  const store = new InMemoryDocumentStore();
  for (const env of envelopes) store.apply(env);
  return store.canonicalSnapshot();
}

function finalRequest(envelopes: readonly MutationEnvelope[]): Request {
  const store = new InMemoryDocumentStore();
  for (const env of envelopes) store.apply(env);
  const m = store.materializeOne('request', 'rq-1');
  const r = m ? projectRequest(m) : null;
  if (!r) throw new Error('request did not materialize');
  return r;
}

describe('request auth/body variant switches converge under any order', () => {
  it(`byte-identical snapshot + final variant == last write (×${SCENARIOS})`, () => {
    const rng = makeRng(SEED_BASE);
    for (let i = 0; i < SCENARIOS; i += 1) {
      const { envelopes, lastAuth, lastBody } = build(rng);
      const baseline = applyOrder(envelopes);

      for (let p = 0; p < PERMUTATIONS - 1; p += 1) {
        const permuted = rng.shuffle(envelopes.slice());
        const snapshot = applyOrder(permuted);
        if (snapshot !== baseline) {
          throw new Error(
            `convergence violation iteration=${i} permutation=${p}\nbaseline: ${baseline}\npermuted: ${snapshot}`,
          );
        }
      }

      const final = finalRequest(envelopes);
      expect(final.auth).toEqual(lastAuth);
      expect(final.body).toEqual(lastBody);
    }
  });
});
