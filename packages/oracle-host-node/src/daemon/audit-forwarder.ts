/**
 * Audit→SIEM forwarder — enterprise Phase 4d.
 *
 * Streams `audit_log` rows to an operator-configured HTTP collector as
 * JSON POST batches (`{ entries: AuditLogEntry[] }`). This is the
 * daemon's ONE deliberate outbound plane: absent config, nothing here
 * is installed and the zero-outbound posture holds unchanged. Delivery
 * rides the node request transport, so the daemon's environment-proxy
 * plane (system/env/manual) routes the collector POST like any other
 * egress.
 *
 * Delivery is at-least-once via a durable cursor: each acknowledged
 * batch persists the full keyset position (`occurred_at, org_id, seq`)
 * of its last row in a single-row SQLite table, so a restart resumes
 * exactly where the collector last acknowledged and a failed POST
 * simply re-sends the same batch on the next tick. The forwarder never
 * sits on the gate path — the audit sink nudges `wake()` after the row
 * is committed, and a heartbeat interval doubles as the retry loop
 * while the collector is unreachable.
 *
 * Bounded loss window: an outage longer than `auditRetentionDays` lets
 * the retention sweep prune rows the collector never saw; the cursor
 * walk resumes at the oldest surviving row.
 */

import { hostLogger as logger } from '@openheaders/core/logger';
import type {
  RequestTransport,
  TransportHeader,
  TransportResponse,
} from '@openheaders/oracle/live/request-exec/transport';
import type Database from 'better-sqlite3';
import { createNodeRequestTransport } from '../live/node-request-transport';
import { type AuditQueryCursor, queryAuditEntries } from '../sync/sqlite-audit-log';

const SCOPE = 'AuditForward';

const DEFAULT_BATCH_SIZE = 200;
const DEFAULT_INTERVAL_MS = 5_000;
/** Ack bodies are discarded — the cap only bounds a hostile collector. */
const MAX_ACK_BODY_BYTES = 64 * 1024;

const nodeTransport = createNodeRequestTransport();

/** The `auditForwarding` block of `daemon.json`, parsed by the host shell. */
export interface DaemonAuditForwardingConfig {
  /** Collector endpoint; every delivery is a JSON POST here. */
  url: string;
  /** Extra request headers — e.g. the collector's `Authorization` value. */
  headers?: Record<string, string>;
  /** Max entries per POST; default 200. */
  batchSize?: number;
  /** Heartbeat period driving retry + catch-up drains; default 5s. */
  intervalMs?: number;
}

export interface InstallAuditForwarderInput {
  db: Database.Database;
  config: DaemonAuditForwardingConfig;
  /** Test seam — production rides the module's node transport (and
   *  through it the environment-proxy plane). */
  transport?: RequestTransport;
}

export interface AuditForwarderHandle {
  /** Nudge a drain now (coalesced; safe to call per appended row). */
  wake(): void;
  /** Halt the heartbeat and any further cursor advancement. Idempotent. */
  stop(): void;
}

const CURSOR_SCHEMA = `CREATE TABLE IF NOT EXISTS audit_forward_cursor (
  id          INTEGER PRIMARY KEY CHECK (id = 1),
  occurred_at TEXT NOT NULL,
  org_id      TEXT NOT NULL,
  seq         INTEGER NOT NULL
)`;

interface CursorRow {
  occurred_at: string;
  org_id: string;
  seq: number;
}

/**
 * Start the forwarder: an immediate backlog drain, then wake-driven
 * near-real-time delivery with the heartbeat as the retry path.
 */
export function installAuditForwarder(input: InstallAuditForwarderInput): AuditForwarderHandle {
  const { db, config } = input;
  db.exec(CURSOR_SCHEMA);
  const getCursor = db.prepare(`SELECT occurred_at, org_id, seq FROM audit_forward_cursor WHERE id = 1`);
  const putCursor = db.prepare(
    `INSERT INTO audit_forward_cursor (id, occurred_at, org_id, seq) VALUES (1, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET occurred_at = excluded.occurred_at, org_id = excluded.org_id, seq = excluded.seq`,
  );
  const batchSize = config.batchSize ?? DEFAULT_BATCH_SIZE;
  const transport = input.transport ?? nodeTransport;
  const headers: TransportHeader[] = [
    { key: 'content-type', value: 'application/json' },
    ...Object.entries(config.headers ?? {}).map(([key, value]) => ({ key, value })),
  ];

  let stopped = false;
  let draining = false;
  let pendingWake = false;
  // Log the outage once when it starts and the recovery once when it
  // ends — a down collector under a 5s heartbeat must not flood the log.
  let deliveryDown = false;

  const loadCursor = (): AuditQueryCursor | null => {
    const row = getCursor.get() as CursorRow | undefined;
    return row ? { occurredAt: row.occurred_at, orgId: row.org_id, seq: row.seq } : null;
  };

  const drain = async (): Promise<void> => {
    if (draining || stopped) {
      pendingWake = draining;
      return;
    }
    draining = true;
    try {
      for (;;) {
        if (stopped) return;
        const after = loadCursor();
        const entries = queryAuditEntries(db, {
          order: 'asc',
          limit: batchSize,
          ...(after !== null ? { after } : {}),
        });
        const last = entries[entries.length - 1];
        if (last === undefined) return;
        let response: TransportResponse;
        try {
          response = await transport.send({
            method: 'POST',
            url: config.url,
            headers,
            body: { kind: 'raw', content: JSON.stringify({ entries }) },
            redirect: 'follow',
            credentials: 'omit',
            maxBodyBytes: MAX_ACK_BODY_BYTES,
          });
        } catch (err) {
          if (!deliveryDown) {
            deliveryDown = true;
            logger.warn(SCOPE, `collector unreachable — will retry with the cursor held`, err);
          }
          return;
        }
        if (response.status < 200 || response.status >= 300) {
          if (!deliveryDown) {
            deliveryDown = true;
            logger.warn(SCOPE, `collector answered ${response.status} — will retry with the cursor held`);
          }
          return;
        }
        if (deliveryDown) {
          deliveryDown = false;
          logger.info(SCOPE, 'collector reachable again — resuming from the held cursor');
        }
        if (stopped) return;
        putCursor.run(last.occurredAt, last.orgId, last.seq);
        if (entries.length < batchSize) return;
      }
    } catch (err) {
      logger.warn(SCOPE, 'forward drain failed', err);
    } finally {
      draining = false;
      if (pendingWake && !stopped) {
        pendingWake = false;
        setTimeout(() => void drain(), 0);
      }
    }
  };

  const timer = setInterval(() => void drain(), config.intervalMs ?? DEFAULT_INTERVAL_MS);
  // Same opt-out as the prune schedulers: a heartbeat must not keep a
  // quiet process alive through shutdown.
  if (typeof (timer as { unref?: () => void }).unref === 'function') {
    (timer as { unref: () => void }).unref();
  }
  void drain();

  return {
    wake: () => void drain(),
    stop: () => {
      if (stopped) return;
      stopped = true;
      clearInterval(timer);
    },
  };
}
