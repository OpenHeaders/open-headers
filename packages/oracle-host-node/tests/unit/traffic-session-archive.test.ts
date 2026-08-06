/**
 * Sessions-archive pins (AGENT_TRAFFIC_PLAN.md §11.4/§11.5, C3): the
 * OHS2 container round-trips with digest integrity, the seal keys mint
 * once and reload, the CAS dedups by plaintext digest across sessions,
 * the recorder writes the v2 event log (payloads over the threshold
 * externalized by digest, counts honest, bounds honest), the archive
 * recovers crashed sessions at boot, GC sweeps by manifest-union
 * reachability, and the retention budget prunes sealed sessions
 * oldest-first — never the recording one.
 */

import { randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { setHostLogger } from '@openheaders/core/logger';
import type { LifecycleWireMessage, RequestLifecycle } from '@openheaders/core/request-lifecycle';
import { DEFAULT_TRAFFIC_SESSION_RETENTION } from '@openheaders/core/traffic';
import { logger as consoleLogger } from '@openheaders/core/utils';
import type { SecretCipher } from '@openheaders/oracle/host-storage';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createTrafficBlobStore } from '../../src/traffic/blob-store';
import {
  loadOrCreateSealKeyFile,
  loadOrCreateWrappedSealKey,
  openContainer,
  sealContainer,
  sha256Hex,
} from '../../src/traffic/seal';
import {
  createTrafficSessionArchive,
  projectArchivedSession,
  type TrafficSessionArchive,
  trafficSessionRetentionFromSettings,
} from '../../src/traffic/session-archive';
import type { TrafficSessionMeta } from '../../src/traffic/session-recorder';

let root: string;

beforeEach(() => {
  setHostLogger(consoleLogger);
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'oh-session-archive-'));
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

function makeLifecycle(overrides: Partial<RequestLifecycle> = {}): RequestLifecycle {
  return {
    tabId: 7,
    requestId: 'req-1',
    url: 'https://api.openheaders.io/users',
    method: 'GET',
    resourceType: 'xmlhttprequest',
    phase: 'pending',
    redirectHopCount: 0,
    redirectHops: [],
    startedAtMs: 1_000,
    hopStartedAtMs: 1_000,
    har: [],
    harBodyByHop: [],
    ...overrides,
  };
}

function startedEnvelope(requestId: string, url = 'https://api.openheaders.io/users'): LifecycleWireMessage {
  return { kind: 'lifecycle-update', update: { kind: 'started', lifecycle: makeLifecycle({ requestId, url }) } };
}

function phaseEnvelope(
  requestId: string,
  patch: { phase?: 'completed' | 'failed'; statusCode?: number },
): LifecycleWireMessage {
  return { kind: 'lifecycle-update', update: { kind: 'phase', tabId: 7, requestId, patch } };
}

function bodyEnvelope(requestId: string, content: string): LifecycleWireMessage {
  return {
    kind: 'lifecycle-update',
    update: {
      kind: 'body-attached',
      tabId: 7,
      requestId,
      hopIndex: 0,
      body: {
        method: 'GET',
        url: 'https://api.openheaders.io/users',
        startedDateTime: '2026-08-05T00:00:00.000Z',
        content,
        encoding: '',
      },
    },
  };
}

function sessionLines(dirPath: string, key: Buffer | null): Array<Record<string, unknown>> {
  const framed = fs.readFileSync(path.join(dirPath, 'events.seal'));
  return openContainer(framed, key)
    .content.toString('utf8')
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

async function recordOneSession(
  archive: TrafficSessionArchive,
  sessionId: string,
  envelopes: LifecycleWireMessage[],
  options?: { name?: string },
): Promise<TrafficSessionMeta> {
  const session = archive.start({
    sessionId,
    sourceUid: 'browser-tab:ext-node-1:7',
    sourceKind: 'browser-tab',
    sourceLabel: 'tab 7 @ ext-node-1',
    name: options?.name ?? sessionId,
    partitionTabId: 7,
    initialFidelity: 'cdp',
    bounds: { maxBytes: 1_048_576, maxDurationMs: 60_000 },
    pullBody: () => {},
  });
  for (const envelope of envelopes) session.appendEnvelope(envelope);
  session.stop();
  await vi.waitFor(() => {
    expect(session.projection().state).toBe('sealed');
  });
  const rows = await archive.listSessions();
  const row = rows.find((r) => r.meta.sessionId === sessionId);
  if (row === undefined) throw new Error(`session ${sessionId} missing from the archive index`);
  return row.meta;
}

function sessionDirOf(archiveRoot: string, sessionId: string): string {
  const sessions = fs.readdirSync(path.join(archiveRoot, 'sessions'));
  const name = sessions.find((dir) => dir.endsWith(`-${sessionId}`));
  if (name === undefined) throw new Error(`no session dir for ${sessionId}`);
  return path.join(archiveRoot, 'sessions', name);
}

describe('sealed container (OHS2)', () => {
  it('round-trips compressed + encrypted with digest integrity', () => {
    const key = randomBytes(32);
    const content = Buffer.from('the same header block repeats '.repeat(400), 'utf8');
    const framed = sealContainer(
      content,
      { kind: 'blob', contentBytes: content.byteLength, contentSha256: sha256Hex(content) },
      key,
    );
    // Brotli earned its keep and the plaintext never shows.
    expect(framed.byteLength).toBeLessThan(content.byteLength);
    expect(framed.includes(Buffer.from('repeats', 'utf8'))).toBe(false);
    const opened = openContainer(framed, key);
    expect(opened.encrypted).toBe(true);
    expect(opened.content.equals(content)).toBe(true);
    expect(opened.header.kind).toBe('blob');

    // Tampered payload fails the GCM tag, never returns garbage.
    const tampered = Buffer.from(framed);
    tampered[tampered.byteLength - 1] = (tampered[tampered.byteLength - 1] ?? 0) ^ 0xff;
    expect(() => openContainer(tampered, key)).toThrow();
    // An encrypted artifact without the key is unreadable, loudly.
    expect(() => openContainer(framed, null)).toThrow(/no seal key/);
  });

  it('seals honestly-unencrypted without a key and keeps already-compressed payloads verbatim', () => {
    const content = Buffer.from('plain '.repeat(1_000), 'utf8');
    const framed = sealContainer(
      content,
      { kind: 'blob', contentBytes: content.byteLength, contentSha256: sha256Hex(content) },
      null,
    );
    const opened = openContainer(framed, null);
    expect(opened.encrypted).toBe(false);
    expect(opened.content.equals(content)).toBe(true);

    const jpeg = randomBytes(8_192);
    const framedJpeg = sealContainer(
      jpeg,
      { kind: 'blob', contentBytes: jpeg.byteLength, contentSha256: sha256Hex(jpeg) },
      null,
      { alreadyCompressed: true },
    );
    // No brotli attempt: the payload rides verbatim after the header.
    expect(framedJpeg.includes(jpeg)).toBe(true);
  });

  it('session-log headers carry the §11.4 trailer facts', () => {
    const content = Buffer.from('log line\n', 'utf8');
    const framed = sealContainer(
      content,
      {
        kind: 'session-log',
        contentBytes: content.byteLength,
        contentSha256: sha256Hex(content),
        counts: { events: 12, requests: 3 },
      },
      null,
    );
    expect(openContainer(framed, null).header.counts).toEqual({ events: 12, requests: 3 });
  });
});

describe('seal keys', () => {
  it('mints a raw 0600 key file once and reloads it stably', () => {
    const keyPath = path.join(root, 'config', 'daemon-traffic-seal.key');
    const first = loadOrCreateSealKeyFile(keyPath);
    const second = loadOrCreateSealKeyFile(keyPath);
    expect(first?.byteLength).toBe(32);
    expect(first?.equals(second ?? Buffer.alloc(0))).toBe(true);
    if (process.platform !== 'win32') {
      expect(fs.statSync(keyPath).mode & 0o777).toBe(0o600);
    }
  });

  it('wraps the key through the host SecretCipher and refuses when the cipher is unavailable', () => {
    const calls: string[] = [];
    const cipher: SecretCipher = {
      isAvailable: () => true,
      encrypt: (plaintext) => {
        calls.push('encrypt');
        return `wrapped:${Buffer.from(plaintext, 'utf8').toString('base64')}`;
      },
      decrypt: (blob) => Buffer.from(blob.replace(/^wrapped:/, ''), 'base64').toString('utf8'),
    };
    const keyPath = path.join(root, 'data', 'traffic-sessions', 'seal.key');
    const first = loadOrCreateWrappedSealKey(keyPath, cipher);
    const second = loadOrCreateWrappedSealKey(keyPath, cipher);
    expect(first?.byteLength).toBe(32);
    expect(first?.equals(second ?? Buffer.alloc(0))).toBe(true);
    expect(calls).toEqual(['encrypt']);
    // The file on disk holds only the wrapped blob.
    expect(fs.readFileSync(keyPath, 'utf8')).toMatch(/^wrapped:/);

    const unavailable: SecretCipher = { isAvailable: () => false, encrypt: (v) => v, decrypt: (v) => v };
    expect(loadOrCreateWrappedSealKey(path.join(root, 'other.key'), unavailable)).toBeNull();
  });
});

describe('blob store (CAS)', () => {
  it('dedups by plaintext digest, fans out by prefix, and round-trips content', async () => {
    const key = randomBytes(32);
    const store = createTrafficBlobStore({ dir: path.join(root, 'blobs'), sealKey: key });
    const content = Buffer.from('cached bundle '.repeat(1_000), 'utf8');

    const first = await store.put(content, 'application/javascript');
    expect(first.wrote).toBe(true);
    expect(first.bytes).toBe(content.byteLength);
    const second = await store.put(content, 'application/javascript');
    expect(second.wrote).toBe(false);
    expect(second.sha256).toBe(first.sha256);
    expect(await store.list()).toEqual([first.sha256]);
    // git-style fan-out; ciphertext at rest.
    const onDisk = fs.readFileSync(path.join(root, 'blobs', first.sha256.slice(0, 2), first.sha256));
    expect(onDisk.includes(Buffer.from('cached bundle', 'utf8'))).toBe(false);
    expect((await store.get(first.sha256))?.equals(content)).toBe(true);

    // Concurrent puts of the same payload collapse to one write.
    const big = Buffer.from('concurrent '.repeat(2_000), 'utf8');
    const [a, b] = await Promise.all([store.put(big), store.put(big)]);
    expect([a.wrote, b.wrote].filter(Boolean)).toHaveLength(1);

    await store.remove(first.sha256);
    expect(await store.get(first.sha256)).toBeNull();
  });
});

describe('session recorder + archive', () => {
  it('writes the v2 event log: header, verbatim events, externalized payloads, honest trailer', async () => {
    const key = randomBytes(32);
    const archive = createTrafficSessionArchive({ dir: root, sealKey: key });
    const bigBody = `{"rows":[${'"payload",'.repeat(2_000)}"end"]}`;
    const meta = await recordOneSession(archive, 'ses-1', [
      startedEnvelope('r-1'),
      bodyEnvelope('r-1', bigBody),
      startedEnvelope('r-2'),
      bodyEnvelope('r-2', 'tiny body'),
    ]);

    expect(meta.state).toBe('sealed');
    expect(meta.requests).toBe(2);
    expect(meta.events).toBe(4);
    expect(meta.encrypted).toBe(true);
    expect(meta.endReason).toBe('stopped');
    expect(meta.origins).toEqual(['https://api.openheaders.io']);
    expect(meta.sealedBytes).toBeGreaterThan(0);

    const dir = sessionDirOf(root, 'ses-1');
    const lines = sessionLines(dir, key);
    expect(lines.map((l) => l.kind)).toEqual(['header', 'event', 'event', 'event', 'event', 'end']);
    expect(lines[0]?.formatVersion).toBe(2);
    expect(lines[0]?.planes).toEqual(['lifecycle']);
    expect(lines[0]?.initialFidelity).toBe('cdp');

    // The big body traveled by digest; the small one stayed inline.
    const bodies = lines
      .filter((l) => l.kind === 'event')
      .map((l) => l.msg as { update?: { kind: string; body?: { content: unknown } } })
      .filter((m) => m.update?.kind === 'body-attached')
      .map((m) => m.update?.body?.content);
    expect(bodies[1]).toBe('tiny body');
    const marker = bodies[0] as { '$oh-blob': { sha256: string; bytes: number } };
    expect(marker['$oh-blob'].bytes).toBe(Buffer.byteLength(bigBody, 'utf8'));
    const blob = await archive.blobs.get(marker['$oh-blob'].sha256);
    expect(blob?.toString('utf8')).toBe(bigBody);
    // …and the manifest names it for reachability.
    expect(fs.readFileSync(path.join(dir, 'blobs.manifest'), 'utf8')).toContain(marker['$oh-blob'].sha256);

    const trailer = lines.at(-1) as { reason: string; events: number; requests: number };
    expect(trailer.reason).toBe('stopped');
    expect(trailer.events).toBe(4);
    expect(trailer.requests).toBe(2);
  });

  it('dedups payloads ACROSS sessions and GC keeps a blob until its last referencing session dies', async () => {
    const archive = createTrafficSessionArchive({ dir: root, sealKey: null });
    const shared = `shared bundle ${'x'.repeat(8_000)}`;
    const exclusive = `exclusive payload ${'y'.repeat(8_000)}`;
    await recordOneSession(archive, 'ses-a', [startedEnvelope('r-1'), bodyEnvelope('r-1', shared)]);
    await recordOneSession(archive, 'ses-b', [
      startedEnvelope('r-1'),
      bodyEnvelope('r-1', shared),
      startedEnvelope('r-2'),
      bodyEnvelope('r-2', exclusive),
    ]);

    // Two sessions, ONE blob for the shared payload (§11.4 sizing).
    const digests = await archive.blobs.list();
    expect(digests).toHaveLength(2);

    // Deleting the session that exclusively holds one blob sweeps it;
    // the shared blob survives through the other session's manifest.
    const deletedB = await archive.deleteSession(path.basename(sessionDirOf(root, 'ses-b')));
    expect(deletedB.ok).toBe(true);
    const afterB = await archive.blobs.list();
    expect(afterB).toEqual([sha256Hex(Buffer.from(shared, 'utf8'))]);

    const deletedA = await archive.deleteSession(path.basename(sessionDirOf(root, 'ses-a')));
    expect(deletedA.ok).toBe(true);
    expect(await archive.blobs.list()).toEqual([]);
    expect(await archive.listSessions()).toEqual([]);
  });

  it('recovers a crashed session at boot: sealed, stamped crashed, everything appended preserved', async () => {
    const key = randomBytes(32);
    const archive = createTrafficSessionArchive({ dir: root, sealKey: key });
    const session = archive.start({
      sessionId: 'ses-crash',
      sourceUid: 'browser-tab:ext-node-1:7',
      sourceKind: 'browser-tab',
      sourceLabel: 'tab 7',
      name: 'crash victim',
      partitionTabId: 7,
      initialFidelity: 'heuristic',
      bounds: { maxBytes: 1_048_576, maxDurationMs: 60_000 },
      pullBody: () => {},
    });
    session.appendEnvelope(startedEnvelope('r-1'));
    await vi.waitFor(() => {
      expect(session.projection().events).toBe(1);
    });
    // No stop() — the process "died" here. A fresh archive over the
    // same root plays the boot-recovery path.
    const reborn = createTrafficSessionArchive({ dir: root, sealKey: key });
    await reborn.recoverAtBoot();
    const [row] = await reborn.listSessions();
    expect(row?.meta.state).toBe('sealed');
    expect(row?.meta.endReason).toBe('crashed');
    const dir = sessionDirOf(root, 'ses-crash');
    expect(fs.existsSync(path.join(dir, 'events.jsonl'))).toBe(false);
    const lines = sessionLines(dir, key);
    expect(lines.map((l) => l.kind)).toEqual(['header', 'event']);
  });

  it('prunes sealed sessions oldest-first under the byte budget and never touches the recording one', async () => {
    const archive = createTrafficSessionArchive({
      dir: root,
      sealKey: null,
      retention: () => ({ maxTotalBytes: 7_000 }),
    });
    // Incompressible payloads (base64 of random bytes) so the budget
    // math survives the try-keep-if-smaller compression: one session
    // fits the budget, two together cross it.
    const oldBody = randomBytes(4_000).toString('base64');
    const newBody = randomBytes(4_000).toString('base64');
    await recordOneSession(archive, 'ses-old', [startedEnvelope('r-1'), bodyEnvelope('r-1', oldBody)]);
    // The budget-crossing seal prunes the OLDEST sealed session.
    await recordOneSession(archive, 'ses-new', [startedEnvelope('r-1'), bodyEnvelope('r-1', newBody)]);
    await archive.enforceRetention();
    const survivors = (await archive.listSessions()).map((r) => r.meta.sessionId);
    expect(survivors).toEqual(['ses-new']);
    // The pruned session's blob went with it.
    expect(await archive.blobs.list()).toEqual([sha256Hex(Buffer.from(newBody, 'utf8'))]);

    // A recording session is never pruned, whatever the budget says.
    const live = archive.start({
      sessionId: 'ses-live',
      sourceUid: 'browser-tab:ext-node-1:7',
      sourceKind: 'browser-tab',
      sourceLabel: 'tab 7',
      name: 'live',
      partitionTabId: 7,
      initialFidelity: 'cdp',
      bounds: { maxBytes: 1_048_576, maxDurationMs: 60_000 },
      pullBody: () => {},
    });
    live.appendEnvelope(bodyEnvelope('r-1', randomBytes(9_000).toString('base64')));
    await vi.waitFor(() => {
      expect(live.projection().events).toBe(1);
    });
    await archive.enforceRetention();
    const after = (await archive.listSessions()).map((r) => r.meta.sessionId);
    expect(after).toContain('ses-live');
    live.stop();
    await vi.waitFor(() => {
      expect(live.projection().state).toBe('sealed');
    });
  });

  it('stamps the §11.1 auto-name and auto-placement folder at seal from the dominant origin', async () => {
    const archive = createTrafficSessionArchive({ dir: root, sealKey: null });
    const meta = await recordOneSession(archive, 'ses-auto', [
      startedEnvelope('r-1', 'https://api.openheaders.io/users'),
      phaseEnvelope('r-1', { phase: 'failed' }),
      startedEnvelope('r-2', 'https://app.openheaders.io/dash'),
      phaseEnvelope('r-2', { phase: 'completed', statusCode: 503 }),
      startedEnvelope('r-3', 'https://cdn.example.com/lib.js'),
      phaseEnvelope('r-3', { phase: 'completed', statusCode: 200 }),
    ]);
    // Dominant origin: openheaders.io carried 2 of 3 requests; a failed
    // request and a 5xx answer both count as errors, a 200 does not.
    expect(meta.folder).toBe('openheaders.io');
    expect(meta.errors).toBe(2);
    expect(meta.name).toMatch(/^openheaders\.io — \d{4}-\d{2}-\d{2} \d{2}:\d{2} \(3 requests, 2 errors\)$/);
  });

  it('files a proxy session under its source label', async () => {
    const archive = createTrafficSessionArchive({ dir: root, sealKey: null });
    const session = archive.start({
      sessionId: 'ses-proxy',
      sourceUid: 'proxy',
      sourceKind: 'proxy',
      sourceLabel: 'Proxy capture',
      name: 'traffic-interception',
      partitionTabId: -2,
      initialFidelity: 'proxy',
      bounds: { maxBytes: 1_048_576, maxDurationMs: 60_000 },
      pullBody: () => {},
    });
    session.appendEnvelope(startedEnvelope('r-1'));
    session.stop();
    await vi.waitFor(() => {
      expect(session.projection().state).toBe('sealed');
    });
    const [row] = await archive.listSessions();
    expect(row?.meta.folder).toBe('Proxy capture');
    expect(row?.meta.name).toMatch(/^Proxy capture — /);
  });

  it('refuses to delete a session that is still recording; the stop unlocks it', async () => {
    const archive = createTrafficSessionArchive({ dir: root, sealKey: null });
    const session = archive.start({
      sessionId: 'ses-locked',
      sourceUid: 'browser-tab:ext-node-1:7',
      sourceKind: 'browser-tab',
      sourceLabel: 'tab 7',
      name: 'locked',
      partitionTabId: 7,
      initialFidelity: 'cdp',
      bounds: { maxBytes: 1_048_576, maxDurationMs: 60_000 },
      pullBody: () => {},
    });
    session.appendEnvelope(startedEnvelope('r-1'));
    await vi.waitFor(() => {
      expect(session.projection().events).toBe(1);
    });
    const id = path.basename(sessionDirOf(root, 'ses-locked'));
    const refused = await archive.deleteSession(id);
    expect(refused).toEqual({ ok: false, error: 'session is still recording — stop it first' });
    session.stop();
    await vi.waitFor(() => {
      expect(session.projection().state).toBe('sealed');
    });
    expect((await archive.deleteSession(id)).ok).toBe(true);
    expect(await archive.listSessions()).toEqual([]);
    // Junk ids never resolve to paths.
    expect((await archive.deleteSession('../escape')).ok).toBe(false);
    expect((await archive.deleteSession('missing')).ok).toBe(false);
  });

  it('organize rewrites ONE meta atomically: rename, refile, clear to unfiled — sealed artifacts untouched', async () => {
    const archive = createTrafficSessionArchive({ dir: root, sealKey: null });
    await recordOneSession(archive, 'ses-org', [startedEnvelope('r-1')]);
    await recordOneSession(archive, 'ses-bystander', [startedEnvelope('r-1')]);
    const orgDir = sessionDirOf(root, 'ses-org');
    const orgId = path.basename(orgDir);
    const bystanderMetaBefore = fs.readFileSync(path.join(sessionDirOf(root, 'ses-bystander'), 'meta.json'), 'utf8');
    const sealBefore = fs.readFileSync(path.join(orgDir, 'events.seal'));

    const renamed = await archive.organizeSession(orgId, { name: 'Checkout repro', folder: 'investigations' });
    expect(renamed.ok).toBe(true);
    if (renamed.ok) {
      expect(renamed.session.name).toBe('Checkout repro');
      expect(renamed.session.folder).toBe('investigations');
      expect(renamed.session.id).toBe(orgId);
    }
    // The rewrite touched exactly one meta: the sealed log is
    // byte-identical and the bystander's meta is untouched.
    expect(fs.readFileSync(path.join(orgDir, 'events.seal')).equals(sealBefore)).toBe(true);
    expect(fs.readFileSync(path.join(sessionDirOf(root, 'ses-bystander'), 'meta.json'), 'utf8')).toBe(
      bystanderMetaBefore,
    );

    const cleared = await archive.organizeSession(orgId, { folder: null });
    expect(cleared.ok).toBe(true);
    if (cleared.ok) {
      expect(cleared.session.folder).toBeUndefined();
      expect(cleared.session.name).toBe('Checkout repro');
    }

    expect((await archive.organizeSession(orgId, { name: '   ' })).ok).toBe(false);
    expect((await archive.organizeSession('missing', { name: 'x' })).ok).toBe(false);
  });

  it('projects the archive index row honestly: footprint math and the C5 identity', async () => {
    const archive = createTrafficSessionArchive({ dir: root, sealKey: null });
    const body = randomBytes(6_000).toString('base64');
    const meta = await recordOneSession(archive, 'ses-proj', [startedEnvelope('r-1'), bodyEnvelope('r-1', body)]);
    const [row] = await archive.listSessions();
    expect(row).toBeDefined();
    if (row === undefined) throw new Error('missing row');
    const projection = projectArchivedSession(row.id, row.meta);
    expect(projection.id).toBe(path.basename(sessionDirOf(root, 'ses-proj')));
    expect(projection.sessionId).toBe('ses-proj');
    expect(projection.state).toBe('sealed');
    expect(projection.sizeBytes).toBe((meta.sealedBytes ?? 0) + meta.blobBytesStored);
    expect(projection.sizeBytes).toBeGreaterThan(0);
    expect(projection.fidelity).toBe('cdp');
    expect(projection.origins).toEqual(['https://api.openheaders.io']);
  });

  it('maps the Settings budget row to a retention posture, defaulting on absent or junk values', () => {
    expect(trafficSessionRetentionFromSettings({ 'trafficMonitor.sessionRetentionGiB': 3 })).toEqual({
      maxTotalBytes: 3 * 1024 * 1024 * 1024,
    });
    expect(trafficSessionRetentionFromSettings(undefined)).toEqual(DEFAULT_TRAFFIC_SESSION_RETENTION);
    expect(trafficSessionRetentionFromSettings({})).toEqual(DEFAULT_TRAFFIC_SESSION_RETENTION);
    expect(trafficSessionRetentionFromSettings({ 'trafficMonitor.sessionRetentionGiB': 0 })).toEqual(
      DEFAULT_TRAFFIC_SESSION_RETENTION,
    );
    expect(trafficSessionRetentionFromSettings({ 'trafficMonitor.sessionRetentionGiB': 'big' })).toEqual(
      DEFAULT_TRAFFIC_SESSION_RETENTION,
    );
  });
});
