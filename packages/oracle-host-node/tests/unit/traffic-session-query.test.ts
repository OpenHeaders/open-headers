/**
 * Session query plane pins (AGENT_TRAFFIC_PLAN.md §11.5, C7): a sealed
 * session folds through the retention reducer into redacted projections
 * (raw at rest, markers at read — the inverted law), the persistent
 * grant flips the SAME read to raw per call, both archived body planes
 * serve (withheld `body-attached` from the CAS and har-carried text),
 * body gaps answer honestly, the fold memoizes (one seal open across
 * consecutive reads), and the archive's refusals surface verbatim.
 */

import { randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { setHostLogger } from '@openheaders/core/logger';
import type { LifecycleWireMessage, RequestLifecycle } from '@openheaders/core/request-lifecycle';
import { logger as consoleLogger } from '@openheaders/core/utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createTrafficSessionArchive, type TrafficSessionArchive } from '../../src/traffic/session-archive';
import {
  createTrafficSessionQuery,
  type TrafficSessionQuery,
  trafficSessionRawReadsFromSettings,
} from '../../src/traffic/session-query';

const JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1bml0LXJ1biIsIm5hbWUiOiJPcGVuIEhlYWRlcnMifQ.YWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXoxMjM0NTY';
const BODY_SECRET = 'oh_unit_body_9f8e7d6c5b4a39281706';
const MARKER = /\[redacted:[0-9a-f]{8}\]/;
/** Over the §11.4 externalize threshold so the withheld body proves
 *  CAS resolution, not just log re-read. Space-separated words —
 *  never one token-shaped run the body scan would replace. */
const BIG_BODY = `asset chunk ${BODY_SECRET} `.padEnd(8_192, 'asset chunk words ');

let root: string;
let archive: TrafficSessionArchive;
let openReplayCalls: number;
let rawGrant: boolean;
let query: TrafficSessionQuery;
let sealedId: string;

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

function started(requestId: string, overrides: Partial<RequestLifecycle> = {}): LifecycleWireMessage {
  return {
    kind: 'lifecycle-update',
    update: { kind: 'started', lifecycle: makeLifecycle({ requestId, ...overrides }) },
  };
}

function phase(requestId: string, patch: Record<string, unknown>): LifecycleWireMessage {
  return {
    kind: 'lifecycle-update',
    update: { kind: 'phase', tabId: 7, requestId, patch: patch as never },
  };
}

function bodyAttached(requestId: string, content: string): LifecycleWireMessage {
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
        startedDateTime: '2026-08-06T00:00:00.000Z',
        content,
        encoding: '',
      },
    },
  };
}

function harAttached(requestId: string, text: string): LifecycleWireMessage {
  return {
    kind: 'lifecycle-update',
    update: {
      kind: 'har-attached',
      tabId: 7,
      requestId,
      hopIndex: 0,
      har: {
        startedDateTime: '2026-08-06T00:00:00.000Z',
        request: { method: 'GET', url: `https://api.openheaders.io/${requestId}`, headers: [], queryString: [] },
        response: {
          status: 200,
          statusText: 'OK',
          headers: [{ name: 'Content-Type', value: 'text/plain' }],
          content: { size: text.length, mimeType: 'text/plain', text },
        },
      },
    },
  };
}

/** One sealed session: a secret-bearing exchange with a CAS-backed
 *  withheld body, a har-carried body, a network failure, and a
 *  body-less success. */
const ENVELOPES: LifecycleWireMessage[] = [
  started('with-body', {
    url: `https://api.openheaders.io/login?access_token=${JWT}`,
    requestHeaders: [{ name: 'Authorization', value: `Bearer ${JWT}` }],
  }),
  phase('with-body', { phase: 'completed', statusCode: 200, completedAtMs: 1_050 }),
  bodyAttached('with-body', BIG_BODY),
  started('har-body', { url: 'https://api.openheaders.io/har-body', startedAtMs: 1_100 }),
  phase('har-body', { phase: 'completed', statusCode: 200, completedAtMs: 1_150 }),
  harAttached('har-body', `har text with ${BODY_SECRET} inside`),
  started('net-fail', { url: 'https://api.openheaders.io/net-fail', startedAtMs: 1_200 }),
  phase('net-fail', { phase: 'failed', error: { code: 'net::ERR_FAILED', reason: 'CORS' } }),
  started('bare', { url: 'https://api.openheaders.io/bare', startedAtMs: 1_300 }),
  phase('bare', { phase: 'completed', statusCode: 204, completedAtMs: 1_320 }),
];

beforeEach(async () => {
  setHostLogger(consoleLogger);
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'oh-session-query-'));
  archive = createTrafficSessionArchive({ dir: root, sealKey: randomBytes(32) });
  const session = archive.start({
    sessionId: 'cap-1',
    sourceUid: 'browser-tab:ext-node-1:7',
    sourceKind: 'browser-tab',
    sourceLabel: 'tab 7 @ ext-node-1',
    name: 'secrets run',
    partitionTabId: 7,
    initialFidelity: 'cdp',
    bounds: { maxBytes: 1_048_576, maxDurationMs: 60_000 },
    pullBody: () => {},
  });
  for (const envelope of ENVELOPES) session.appendEnvelope(envelope);
  session.stop();
  await vi.waitFor(() => {
    expect(session.projection().state).toBe('sealed');
  });
  const rows = await archive.listSessions();
  sealedId = rows[0]?.id ?? '';
  expect(sealedId).not.toBe('');

  openReplayCalls = 0;
  rawGrant = false;
  const counted: TrafficSessionArchive = {
    ...archive,
    openReplay: (id: string) => {
      openReplayCalls++;
      return archive.openReplay(id);
    },
  };
  query = createTrafficSessionQuery({ archive: counted, rawGrant: () => rawGrant });
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe('index read', () => {
  it('lists archive rows as projections — meta facts, never content', async () => {
    const sessions = await query.list();
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({
      id: sealedId,
      state: 'sealed',
      requests: 4,
      fidelity: 'cdp',
      encrypted: true,
    });
    // The start name survives the seal; auto-placement stamps the
    // dominant site on the COLLECTION, never into the name.
    expect(sessions[0]?.name).toBe('secrets run');
    expect(sessions[0]?.collection).toBe('openheaders.io');
    expect(JSON.stringify(sessions)).not.toContain(JWT);
  });
});

describe('records — the inverted redaction law', () => {
  it('projects redacted by default: raw at rest, markers at read', async () => {
    const read = await query.records(sealedId);
    expect(read.raw).toBe(false);
    expect(read.fidelity).toBe('cdp');
    expect(read.truncatedOldest).toBe(0);
    expect(read.rows.map((r) => r.requestId)).toEqual(['with-body', 'har-body', 'net-fail', 'bare']);

    const secretRow = read.rows[0];
    expect(secretRow?.statusCode).toBe(200);
    const auth = secretRow?.requestHeaders?.find((h) => h.name === 'Authorization');
    expect(auth?.value).toMatch(/^Bearer \[redacted:[0-9a-f]{8}\]$/);
    expect(secretRow?.url).toMatch(MARKER);
    expect(JSON.stringify(read.rows)).not.toContain(JWT);

    // The store really does hold raw: the same read under the grant.
    rawGrant = true;
    const raw = await query.records(sealedId);
    expect(raw.raw).toBe(true);
    expect(raw.rows[0]?.requestHeaders?.find((h) => h.name === 'Authorization')?.value).toBe(`Bearer ${JWT}`);
    expect(raw.rows[0]?.url).toContain(JWT);
  });

  it('memoizes the fold — consecutive reads open the seal once', async () => {
    await query.records(sealedId);
    await query.records(sealedId);
    await query.getRecord(sealedId, 'bare');
    expect(openReplayCalls).toBe(1);
  });

  it('surfaces the archive refusals verbatim', async () => {
    await expect(query.records('nope')).rejects.toThrow('unknown session');
  });
});

describe('getRecord — the archived body planes', () => {
  it('serves the withheld body from the CAS, redacted; raw under the grant', async () => {
    const read = await query.getRecord(sealedId, 'with-body');
    expect(read?.raw).toBe(false);
    expect(read?.record.requestId).toBe('with-body');
    expect(read?.bodyGap).toBeUndefined();
    expect(read?.body?.encoding).toBe('text');
    expect(read?.body?.content).toMatch(MARKER);
    expect(read?.body?.content).not.toContain(BODY_SECRET);

    rawGrant = true;
    const raw = await query.getRecord(sealedId, 'with-body');
    expect(raw?.body?.content).toContain(BODY_SECRET);
  });

  it('serves har-carried text when no body-attached was recorded', async () => {
    const read = await query.getRecord(sealedId, 'har-body');
    expect(read?.body?.content).toContain('har text with');
    expect(read?.body?.content).not.toContain(BODY_SECRET);
    expect(read?.body?.content).toMatch(MARKER);
  });

  it('answers body gaps honestly and unknown ids with null', async () => {
    const failed = await query.getRecord(sealedId, 'net-fail');
    expect(failed?.bodyGap).toBe('phase-failed');
    expect(failed?.body).toBeUndefined();
    const bare = await query.getRecord(sealedId, 'bare');
    expect(bare?.bodyGap).toBe('not-recorded');
    expect(await query.getRecord(sealedId, 'ghost')).toBeNull();
  });
});

describe('settings parse', () => {
  it('reads the grant key strictly — only literal true grants', () => {
    expect(trafficSessionRawReadsFromSettings(undefined)).toBe(false);
    expect(trafficSessionRawReadsFromSettings({})).toBe(false);
    expect(trafficSessionRawReadsFromSettings({ 'trafficMonitor.sessionAgentRawReads': 'true' })).toBe(false);
    expect(trafficSessionRawReadsFromSettings({ 'trafficMonitor.sessionAgentRawReads': true })).toBe(true);
  });
});
