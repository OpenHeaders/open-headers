/**
 * F5b — the public snapshot plane: the publication store, the
 * owner-gated peer verbs (switch + visibility refusals, audit stamps,
 * payload contract), and the anonymous HTTP route (page + payload,
 * dark when the master switch is off, 404 on unknown ids).
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  clearIdentitySnapshot,
  createDaemonUser,
  ensureSyntheticIdentity,
  grantWorkspaceRole,
  type ResolvedAuditEntry,
  refreshIdentitySnapshotFromHostStorage,
  resetAuditSink,
  setAuditSink,
} from '@openheaders/core/identity';
import { setHostLogger } from '@openheaders/core/logger';
import { PublicWorkspacePublicationSchema } from '@openheaders/core/protocol';
import { parseEntityArray } from '@openheaders/core/schemas';
import { hostStorage, OH, setHostStorage } from '@openheaders/core/storage';
import { setWorkspaceOrgResolver } from '@openheaders/core/sync';
import type { DaemonUserRecord, ExtensionWorkspace } from '@openheaders/core/types';
import { __initSyncServiceForTests, dispose as disposeSyncService } from '@openheaders/oracle/sync/service';
import {
  bootstrap as bootstrapWorkspaceStore,
  __resetForTests as resetWorkspaceStore,
} from '@openheaders/oracle/workspace/extension-workspace-store';
import type Database from 'better-sqlite3';
import * as v from 'valibot';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createPeerWorkspacePublicRpc } from '../../../src/daemon/peer-workspace-public';
import { createPublicWorkspaceHttpHandler } from '../../../src/daemon/public-workspace-http';
import { openSqliteDatabase } from '../../../src/sync/sqlite-database';
import { SqlitePublishedSnapshotStore } from '../../../src/sync/sqlite-published-snapshots';
import { createHostStorageFake } from '../_host-storage-fake';

const WS_PUB = 'ws-public-1';
const WS_PRIV = 'ws-private-1';

let db: Database.Database;
let store: SqlitePublishedSnapshotStore;
let audits: ResolvedAuditEntry[] = [];
let daemonOrgId = '';
let owner: DaemonUserRecord;
let viewer: DaemonUserRecord;

function makeWorkspaceRecord(id: string, overrides: Partial<ExtensionWorkspace> = {}): ExtensionWorkspace {
  return {
    schemaVersion: 5,
    id,
    kind: 'team',
    name: `Workspace ${id}`,
    sortIndex: 0,
    createdAt: '2026-08-25T00:00:00.000Z',
    updatedAt: '2026-08-25T00:00:00.000Z',
    orgId: daemonOrgId,
    ...overrides,
  };
}

async function makeUser(name: string, role: 'owner' | 'viewer' | null): Promise<DaemonUserRecord> {
  const created = await createDaemonUser({ displayName: name });
  if (!created.ok) throw new Error('directory create failed');
  if (role !== null) {
    await grantWorkspaceRole({ principalId: created.record.principal.id, workspaceId: WS_PUB, role });
    await grantWorkspaceRole({ principalId: created.record.principal.id, workspaceId: WS_PRIV, role });
  }
  return created.record;
}

beforeAll(() => {
  setHostLogger({ error() {}, warn() {}, info() {}, debug() {} });
});

beforeEach(async () => {
  audits = [];
  setAuditSink((entry) => {
    audits.push(entry);
  });
  // The shared fake stubs the validated readers to safe defaults; the
  // workspace bootstrap hydrates through getValidatedArray, so overlay
  // a real schema-validating read over the fake's raw map.
  const fake = createHostStorageFake();
  setHostStorage({
    ...fake,
    async getValidatedArray(spec, schema, options) {
      const raw = await fake.get(spec);
      return raw === undefined ? [] : parseEntityArray(schema, raw, options);
    },
  });
  const record = await ensureSyntheticIdentity({ hostKind: 'daemon', now: '2026-08-25T00:00:00.000Z' });
  daemonOrgId = record.org.id;
  await hostStorage.set(OH.workspaces, [
    makeWorkspaceRecord(WS_PUB, { visibility: 'public' }),
    makeWorkspaceRecord(WS_PRIV),
  ]);
  await bootstrapWorkspaceStore({ seedOnEmpty: false });
  setWorkspaceOrgResolver(() => daemonOrgId);
  await refreshIdentitySnapshotFromHostStorage();
  __initSyncServiceForTests(WS_PUB);
  owner = await makeUser('Olivia', 'owner');
  viewer = await makeUser('Vera', 'viewer');
  db = openSqliteDatabase(':memory:');
  store = new SqlitePublishedSnapshotStore(db);
});

afterEach(() => {
  db.close();
  disposeSyncService();
  setWorkspaceOrgResolver(null);
  resetWorkspaceStore();
  resetAuditSink();
  clearIdentitySnapshot();
});

describe('SqlitePublishedSnapshotStore', () => {
  it('put / get / replace-in-place / delete', () => {
    expect(store.get('ws-a')).toBeNull();
    store.put({ workspaceId: 'ws-a', payloadJson: '{"v":1}', publishedAt: 't1', publishedBy: 'u1' });
    expect(store.get('ws-a')).toMatchObject({ payloadJson: '{"v":1}', publishedAt: 't1', publishedBy: 'u1' });
    store.put({ workspaceId: 'ws-a', payloadJson: '{"v":2}', publishedAt: 't2', publishedBy: 'u2' });
    expect(store.get('ws-a')).toMatchObject({ payloadJson: '{"v":2}', publishedAt: 't2' });
    expect(store.delete('ws-a')).toBe(true);
    expect(store.delete('ws-a')).toBe(false);
    expect(store.get('ws-a')).toBeNull();
  });
});

describe('peer public-share plane', () => {
  function rpc(enabled: boolean) {
    return createPeerWorkspacePublicRpc({ store, publicWorkspacesEnabled: enabled });
  }
  const asPeer = (record: DaemonUserRecord) => ({ userId: record.user.id });

  it('a non-owner is refused on every mutation and the deny is audited', async () => {
    const plane = rpc(true);
    const publish = (await plane.dispatch(
      { type: 'publishWorkspacePublicShare', workspaceId: WS_PUB },
      asPeer(viewer),
    )) as { ok: boolean; reason?: string };
    expect(publish).toMatchObject({ ok: false, reason: 'not-owner' });
    const unpublish = (await plane.dispatch(
      { type: 'unpublishWorkspacePublicShare', workspaceId: WS_PUB },
      asPeer(viewer),
    )) as { ok: boolean; reason?: string };
    expect(unpublish).toMatchObject({ ok: false, reason: 'not-owner' });
    const stamps = audits.filter(
      (entry) => entry.capability === 'daemon.workspace-publish' || entry.capability === 'daemon.workspace-unpublish',
    );
    expect(stamps).toHaveLength(2);
    for (const stamp of stamps) {
      expect(stamp.decision.allow).toBe(false);
      expect(stamp.workspaceId).toBe(WS_PUB);
    }
  });

  it('the master switch off refuses publish in-band (gate audited as allow) but never unpublish', async () => {
    const plane = rpc(false);
    const publish = (await plane.dispatch(
      { type: 'publishWorkspacePublicShare', workspaceId: WS_PUB },
      asPeer(owner),
    )) as { ok: boolean; reason?: string };
    expect(publish).toMatchObject({ ok: false, reason: 'disabled' });
    expect(audits.find((entry) => entry.capability === 'daemon.workspace-publish')?.decision.allow).toBe(true);
    store.put({ workspaceId: WS_PUB, payloadJson: '{}', publishedAt: 't', publishedBy: owner.user.id });
    const unpublish = (await plane.dispatch(
      { type: 'unpublishWorkspacePublicShare', workspaceId: WS_PUB },
      asPeer(owner),
    )) as { ok: boolean };
    expect(unpublish.ok).toBe(true);
    expect(store.get(WS_PUB)).toBeNull();
  });

  it('publish refuses a workspace whose visibility is not public', async () => {
    const result = (await rpc(true).dispatch(
      { type: 'publishWorkspacePublicShare', workspaceId: WS_PRIV },
      asPeer(owner),
    )) as { ok: boolean; reason?: string };
    expect(result).toMatchObject({ ok: false, reason: 'not-public' });
    expect(store.get(WS_PRIV)).toBeNull();
  });

  it('an owner publish stores the contract-clean payload; status and preview answer; unpublish audits + 404s', async () => {
    const plane = rpc(true);
    const publish = (await plane.dispatch(
      { type: 'publishWorkspacePublicShare', workspaceId: WS_PUB },
      asPeer(owner),
    )) as { ok: boolean; publishedAt?: string; path?: string };
    expect(publish.ok).toBe(true);
    expect(publish.path).toBe(`/public/${WS_PUB}`);

    const row = store.get(WS_PUB);
    expect(row).not.toBeNull();
    expect(row?.publishedBy).toBe(owner.user.id);
    const payload = v.parse(PublicWorkspacePublicationSchema, JSON.parse(row?.payloadJson ?? ''));
    expect(payload.workspace).toMatchObject({ id: WS_PUB, name: `Workspace ${WS_PUB}` });
    expect(payload.snapshot.workspaceId).toBe(WS_PUB);
    expect(payload.snapshot.vault).toEqual([]);
    expect(payload.snapshot.oauthBundles).toEqual([]);
    expect(payload.snapshot.liveValues).toEqual([]);
    expect(payload.snapshot.layoutState).toEqual([]);

    const status = (await plane.dispatch({ type: 'getWorkspacePublicShare', workspaceId: WS_PUB }, asPeer(owner))) as {
      ok: boolean;
      enabled: boolean;
      publishedAt: string | null;
      path?: string;
    };
    expect(status).toMatchObject({ ok: true, enabled: true, publishedAt: publish.publishedAt, path: publish.path });

    const preview = (await plane.dispatch(
      { type: 'previewWorkspacePublicShare', workspaceId: WS_PUB },
      asPeer(owner),
    )) as { ok: boolean; summary?: { entityCounts: Record<string, number> } };
    expect(preview.ok).toBe(true);
    expect(preview.summary?.entityCounts).toEqual({});

    const unpublish = (await plane.dispatch(
      { type: 'unpublishWorkspacePublicShare', workspaceId: WS_PUB },
      asPeer(owner),
    )) as { ok: boolean; existed?: boolean };
    expect(unpublish).toMatchObject({ ok: true, existed: true });
    expect(store.get(WS_PUB)).toBeNull();
    const stamp = audits.find((entry) => entry.capability === 'daemon.workspace-unpublish');
    expect(stamp?.decision.allow).toBe(true);
  });
});

describe('anonymous public HTTP route', () => {
  let webRoot: string;

  beforeEach(() => {
    webRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'oh-public-web-'));
    fs.writeFileSync(path.join(webRoot, 'index.html'), '<!doctype html><title>viewer</title>');
    store.put({ workspaceId: WS_PUB, payloadJson: '{"hello":"world"}', publishedAt: 't', publishedBy: 'u' });
  });

  afterEach(() => {
    fs.rmSync(webRoot, { recursive: true, force: true });
  });

  interface FakeResponse {
    statusCode: number;
    headers: Record<string, unknown>;
    body: string;
  }

  function run(
    handler: ReturnType<typeof createPublicWorkspaceHttpHandler>,
    method: string,
    url: string,
  ): { owned: boolean; res: FakeResponse } {
    const res: FakeResponse = { statusCode: 0, headers: {}, body: '' };
    const fakeRes = {
      writeHead(status: number, headers?: Record<string, unknown>) {
        res.statusCode = status;
        res.headers = headers ?? {};
      },
      end(chunk?: unknown) {
        if (chunk !== undefined) res.body = String(chunk);
      },
    };
    const owned = handler(
      { method, url } as unknown as Parameters<typeof handler>[0],
      fakeRes as unknown as Parameters<typeof handler>[1],
    );
    return { owned, res };
  }

  it('serves the payload and the viewer page for a standing publication', () => {
    const handler = createPublicWorkspaceHttpHandler({ store, enabled: true, webRootDir: webRoot });
    const json = run(handler, 'GET', `/public/${WS_PUB}/snapshot.json`);
    expect(json.owned).toBe(true);
    expect(json.res.statusCode).toBe(200);
    expect(json.res.body).toBe('{"hello":"world"}');
    expect(json.res.headers['content-type']).toContain('application/json');
    const page = run(handler, 'GET', `/public/${WS_PUB}`);
    expect(page.res.statusCode).toBe(200);
    expect(page.res.body).toContain('viewer');
  });

  it('answers 404 for unknown ids, malformed paths, and when the switch is off', () => {
    const enabled = createPublicWorkspaceHttpHandler({ store, enabled: true, webRootDir: webRoot });
    expect(run(enabled, 'GET', '/public/no-such-workspace').res.statusCode).toBe(404);
    expect(run(enabled, 'GET', `/public/${WS_PUB}/other.json`).res.statusCode).toBe(404);
    const disabled = createPublicWorkspaceHttpHandler({ store, enabled: false, webRootDir: webRoot });
    expect(run(disabled, 'GET', `/public/${WS_PUB}`).res.statusCode).toBe(404);
    expect(run(disabled, 'GET', `/public/${WS_PUB}/snapshot.json`).res.statusCode).toBe(404);
  });

  it('owns only /public/*, and only GET/HEAD', () => {
    const handler = createPublicWorkspaceHttpHandler({ store, enabled: true, webRootDir: webRoot });
    expect(run(handler, 'GET', '/healthz').owned).toBe(false);
    expect(run(handler, 'POST', `/public/${WS_PUB}`).res.statusCode).toBe(405);
  });
});
