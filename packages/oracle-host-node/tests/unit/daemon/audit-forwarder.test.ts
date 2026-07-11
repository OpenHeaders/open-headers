/**
 * Enterprise Phase 4d — audit→SIEM forwarder.
 *
 * Pins the durable-cursor delivery contract against a REAL local HTTP
 * collector and a `:memory:` audit store:
 *   - backlog drains oldest-first in batches, with configured headers;
 *   - wake() delivers rows appended after boot;
 *   - a refusing/unreachable collector holds the cursor (at-least-once
 *     re-delivery of the same batch on recovery);
 *   - a restarted forwarder resumes from the persisted cursor;
 *   - stop() halts delivery.
 */

import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { AuditLogEntry } from '@openheaders/core/types';
import type { AuditLogAppendInput } from '@openheaders/oracle/sync/audit-log';
import { ensureAuditLogSchema, SqliteAuditLog } from '@openheaders/oracle-host-node/sync/sqlite-audit-log';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@openheaders/core/logger', () => ({
  hostLogger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { type AuditForwarderHandle, installAuditForwarder } from '../../../src/daemon/audit-forwarder';

const ORG = '0193a8ff-c000-7000-8000-00000000000a';
const WS = '0193a8ff-c000-7000-8000-000000000001';

interface ReceivedPost {
  headers: Record<string, string | string[] | undefined>;
  entries: AuditLogEntry[];
}

interface Collector {
  url: string;
  requests: ReceivedPost[];
  /** Next responses' status codes; empty = 200. */
  statusQueue: number[];
  close(): Promise<void>;
}

function startCollector(): Promise<Collector> {
  const requests: ReceivedPost[] = [];
  const statusQueue: number[] = [];
  const server: Server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as { entries: AuditLogEntry[] };
      requests.push({ headers: req.headers, entries: body.entries });
      res.statusCode = statusQueue.shift() ?? 200;
      res.end();
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({
        url: `http://127.0.0.1:${port}/ingest`,
        requests,
        statusQueue,
        close: () => new Promise((done) => server.close(() => done())),
      });
    });
  });
}

let db: Database.Database;
let log: SqliteAuditLog;
let collector: Collector;
let forwarder: AuditForwarderHandle | null;

function makeInput(seqHint: number, overrides: Partial<AuditLogAppendInput> = {}): AuditLogAppendInput {
  return {
    orgId: ORG,
    actorUserId: 'user-alice',
    capability: 'workspace.write',
    workspaceId: WS,
    decision: { allow: true },
    occurredAt: `2026-07-11T09:00:${String(seqHint).padStart(2, '0')}.000Z`,
    ...overrides,
  };
}

beforeEach(async () => {
  db = new Database(':memory:');
  ensureAuditLogSchema(db);
  log = new SqliteAuditLog(db);
  collector = await startCollector();
  forwarder = null;
});

afterEach(async () => {
  forwarder?.stop();
  await collector.close();
  db.close();
});

async function waitForDelivered(count: number): Promise<void> {
  await vi.waitFor(() => {
    expect(collector.requests.flatMap((r) => r.entries).length).toBeGreaterThanOrEqual(count);
  });
}

describe('audit forwarder', () => {
  it('drains the backlog oldest-first in batches and sends configured headers', async () => {
    for (let i = 0; i < 5; i += 1) await log.append(makeInput(i));
    forwarder = installAuditForwarder({
      db,
      config: {
        url: collector.url,
        headers: { authorization: 'Bearer siem-collector-token' },
        batchSize: 2,
        intervalMs: 60_000,
      },
    });
    await waitForDelivered(5);
    const delivered = collector.requests.flatMap((r) => r.entries);
    expect(delivered.map((e) => e.seq)).toEqual([1, 2, 3, 4, 5]);
    expect(collector.requests.map((r) => r.entries.length)).toEqual([2, 2, 1]);
    for (const request of collector.requests) {
      expect(request.headers.authorization).toBe('Bearer siem-collector-token');
      expect(request.headers['content-type']).toBe('application/json');
    }
  });

  it('delivers rows appended after boot on wake()', async () => {
    forwarder = installAuditForwarder({ db, config: { url: collector.url, intervalMs: 60_000 } });
    await log.append(makeInput(0));
    forwarder.wake();
    await waitForDelivered(1);
    await log.append(makeInput(1));
    forwarder.wake();
    await waitForDelivered(2);
    expect(collector.requests.flatMap((r) => r.entries).map((e) => e.seq)).toEqual([1, 2]);
  });

  it('holds the cursor on a refusing collector and re-delivers the same batch on recovery', async () => {
    await log.append(makeInput(0));
    collector.statusQueue.push(500);
    forwarder = installAuditForwarder({ db, config: { url: collector.url, intervalMs: 25 } });
    await vi.waitFor(() => {
      expect(collector.requests.length).toBeGreaterThanOrEqual(2);
    });
    // The refused batch and the retried batch carry the same row.
    const first = collector.requests[0];
    const retried = collector.requests[1];
    expect(first?.entries.map((e) => e.id)).toEqual([`${ORG}:1`]);
    expect(retried?.entries.map((e) => e.id)).toEqual([`${ORG}:1`]);
  });

  it('resumes from the persisted cursor across a restart without re-sending acknowledged rows', async () => {
    await log.append(makeInput(0));
    await log.append(makeInput(1));
    forwarder = installAuditForwarder({ db, config: { url: collector.url, intervalMs: 60_000 } });
    await waitForDelivered(2);
    forwarder.stop();

    await log.append(makeInput(2));
    forwarder = installAuditForwarder({ db, config: { url: collector.url, intervalMs: 60_000 } });
    await waitForDelivered(3);
    expect(collector.requests.flatMap((r) => r.entries).map((e) => e.seq)).toEqual([1, 2, 3]);
  });

  it('survives an unreachable collector and stops delivering after stop()', async () => {
    await log.append(makeInput(0));
    const deadUrl = collector.url;
    await collector.close();
    collector = await startCollector();
    forwarder = installAuditForwarder({ db, config: { url: deadUrl, intervalMs: 25 } });
    // A few ticks against the closed port — no throw, nothing delivered.
    await new Promise((resolve) => setTimeout(resolve, 120));
    expect(collector.requests).toEqual([]);
    forwarder.stop();
    forwarder = installAuditForwarder({ db, config: { url: collector.url, intervalMs: 25 } });
    await waitForDelivered(1);
    const seen = collector.requests.flatMap((r) => r.entries).length;
    forwarder.stop();
    await log.append(makeInput(1));
    forwarder.wake();
    await new Promise((resolve) => setTimeout(resolve, 120));
    expect(collector.requests.flatMap((r) => r.entries).length).toBe(seen);
  });
});
