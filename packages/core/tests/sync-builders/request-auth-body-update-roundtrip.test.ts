/**
 * Regression: changing a Request's Authorization (or Body) variant and
 * saving must persist, and the editor's derived-dirty state must clear.
 *
 * `seedRequest` (create) flattens `auth` / `body` to per-leaf field
 * paths (`auth.type`, `body.content`, …). A later update that wrote the
 * whole sub-object back as a single `setField` at `auth` left the
 * create-time `auth.type` leaf in place; at materialize time
 * `unflattenLeaves` applied the whole-object `auth` leaf, then let the
 * stale `auth.type` leaf clobber the discriminant back to its create
 * value. The variant's type froze at create time and the form stayed
 * forever-dirty (form value !== materialized canonical).
 *
 * `buildUpdateBatch` now routes object-valued scalars through
 * `synthesizeFieldDiff`, mirroring create's per-leaf granularity and
 * tombstoning leaves that vanish on a variant switch.
 */

import { describe, expect, it } from 'vitest';
import { InMemoryDocumentStore, type MutatorContext } from '../../src/sync';
import {
  buildAddBatch,
  buildUpdateBatch,
  type LiveFieldValue,
  type RequestMutationPayload,
} from '../../src/sync-builders/request-mutations';
import { projectRequest } from '../../src/sync-builders/request-projection';
import type { AuthConfig, Request, RequestBody } from '../../src/types';

const ctx = (physicalMs: number): MutatorContext => ({
  workspaceId: 'ws-1',
  orgId: 'org-test',
  hlc: { physicalMs, logical: 0, nodeId: 'node-x' },
  surfaceId: 'workbench',
  deviceId: 'device-a',
});

const noSets = () => [];

function applyBatch(store: InMemoryDocumentStore, payload: RequestMutationPayload): void {
  for (const env of payload.batch.mutations) store.apply(env);
}

/** Read the live materialized `auth` / `body` as the field-diff baseline. */
function liveField(store: InMemoryDocumentStore, uid: string): LiveFieldValue {
  return (_requestUid, path) => {
    const m = store.materializeOne('request', uid);
    const r = m ? projectRequest(m) : null;
    if (!r) return undefined;
    if (path === 'auth') return r.auth;
    if (path === 'body') return r.body;
    return undefined;
  };
}

function materializedRequest(store: InMemoryDocumentStore, uid: string): Request {
  const m = store.materializeOne('request', uid);
  const r = m ? projectRequest(m) : null;
  if (!r) throw new Error('request did not materialize');
  return r;
}

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

function setAuth(store: InMemoryDocumentStore, auth: AuthConfig, at: number): void {
  applyBatch(store, buildUpdateBatch('rq-1', { auth }, ctx(at), noSets, liveField(store, 'rq-1')));
}

function setBody(store: InMemoryDocumentStore, body: RequestBody, at: number): void {
  applyBatch(store, buildUpdateBatch('rq-1', { body }, ctx(at), noSets, liveField(store, 'rq-1')));
}

describe('request auth/body variant update round-trip', () => {
  it('persists an inherit → basic auth switch instead of reverting to the create-time type', () => {
    const store = new InMemoryDocumentStore();
    applyBatch(store, buildAddBatch(seed, ctx(1_000)));

    const basic: AuthConfig = { type: 'basic', username: 'u', password: 'p' };
    setAuth(store, basic, 2_000);

    expect(materializedRequest(store, 'rq-1').auth).toEqual(basic);
  });

  it('emits a per-leaf diff, not a whole-object setField at `auth`', () => {
    const store = new InMemoryDocumentStore();
    applyBatch(store, buildAddBatch(seed, ctx(1_000)));

    const payload = buildUpdateBatch(
      'rq-1',
      { auth: { type: 'basic', username: 'u', password: 'p' } },
      ctx(2_000),
      noSets,
      liveField(store, 'rq-1'),
    );
    const paths = payload.batch.mutations.map((m) => (m.body.kind === 'setField' ? m.body.path : m.body.kind));
    // No envelope writes the whole object at `auth`; every write is a leaf.
    expect(paths).not.toContain('auth');
    expect(paths).toEqual(expect.arrayContaining(['auth.type', 'auth.username', 'auth.password']));
  });

  it('tombstones the basic-only leaves when switching basic → inherit (no stale residue)', () => {
    const store = new InMemoryDocumentStore();
    applyBatch(store, buildAddBatch(seed, ctx(1_000)));
    setAuth(store, { type: 'basic', username: 'u', password: 'p' }, 2_000);
    setAuth(store, { type: 'inherit' }, 3_000);

    // username / password must be gone — an inherit variant carries only `type`.
    expect(materializedRequest(store, 'rq-1').auth).toEqual({ type: 'inherit' });
  });

  it('round-trips inherit → basic → inherit to a clean inherit (derived-dirty converges)', () => {
    const store = new InMemoryDocumentStore();
    applyBatch(store, buildAddBatch(seed, ctx(1_000)));
    setAuth(store, { type: 'basic', username: 'u', password: 'p' }, 2_000);
    setAuth(store, { type: 'bearer', token: 't' }, 3_000);
    setAuth(store, { type: 'inherit' }, 4_000);

    expect(materializedRequest(store, 'rq-1').auth).toEqual({ type: 'inherit' });
  });

  it('a later auth edit supersedes an earlier one with no leftover leaves', () => {
    const store = new InMemoryDocumentStore();
    applyBatch(store, buildAddBatch(seed, ctx(1_000)));
    setAuth(store, { type: 'api-key', key: 'X-Key', value: 'v1', in: 'header' }, 2_000);
    setAuth(store, { type: 'api-key', key: 'X-Key', value: 'v2', in: 'query' }, 3_000);

    expect(materializedRequest(store, 'rq-1').auth).toEqual({
      type: 'api-key',
      key: 'X-Key',
      value: 'v2',
      in: 'query',
    });
  });

  it('persists a body none → json → none switch and tombstones the json content', () => {
    const store = new InMemoryDocumentStore();
    applyBatch(store, buildAddBatch(seed, ctx(1_000)));
    setBody(store, { type: 'json', content: '{"q":1}' }, 2_000);
    expect(materializedRequest(store, 'rq-1').body).toEqual({ type: 'json', content: '{"q":1}' });

    setBody(store, { type: 'none' }, 3_000);
    expect(materializedRequest(store, 'rq-1').body).toEqual({ type: 'none' });
  });
});
