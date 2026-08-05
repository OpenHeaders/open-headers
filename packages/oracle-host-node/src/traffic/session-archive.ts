/**
 * The sessions archive (AGENT_TRAFFIC_PLAN.md §11.4) — the durable
 * home of every recorded session and the shared blob store, with the
 * three responsibilities the recorder itself must not own:
 *
 *   - **Boot recovery.** `meta.json` rows are scanned once at boot; a
 *     session a dead process left `recording` is stamped `crashed`
 *     (everything appended before the crash is preserved — the plain
 *     log is crash-safe by construction) and sealed; a `sealing` row
 *     re-attempts its seal. No global index file to corrupt.
 *   - **GC by reachability, never refcounts.** Each session appends
 *     `blobs.manifest` while recording; deleting/pruning sweeps the
 *     union of surviving manifests against the blob listing and
 *     removes the unreferenced. Manifest reads are cheap; no event-log
 *     scans, no refcount races.
 *   - **Retention ships WITH the recorder.** Dedup slows growth; it
 *     never bounds it. A global byte budget (logs + blobs) prunes
 *     SEALED sessions oldest-first after every seal and at boot; the
 *     recording session is never pruned. The budget surfaces in
 *     Settings with the arm defaults (C4) — until then the §11.4
 *     default applies.
 *
 * The archive and its raw types are private to the host packages
 * (§11.5): nothing here is exported from the package index beyond the
 * factory, and the only wire-facing read is the recorder's
 * projection.
 */

import * as fsp from 'node:fs/promises';
import * as path from 'node:path';

import { hostLogger as logger } from '@openheaders/core/logger';
import type { LifecycleSource } from '@openheaders/core/request-lifecycle';
import type { TrafficCaptureBounds, TrafficCaptureEndReason, TrafficSessionRetention } from '@openheaders/core/traffic';
import { DEFAULT_TRAFFIC_SESSION_RETENTION } from '@openheaders/core/traffic';

import { createTrafficBlobStore, type TrafficBlobStore } from './blob-store';
import {
  SESSION_EVENTS_FILE,
  SESSION_MANIFEST_FILE,
  SESSION_META_FILE,
  SESSION_SEAL_FILE,
  sealSessionLog,
  sessionDirName,
  startTrafficSessionRecording,
  type TrafficSessionMeta,
  type TrafficSessionRecording,
  writeSessionMeta,
} from './session-recorder';

const SCOPE = 'TrafficSessionArchive';

export interface TrafficSessionArchiveOptions {
  /** Archive root — `sessions/` and `blobs/` live under it. */
  readonly dir: string;
  /** The §9.5 seal key. `null` = artifacts land honestly unencrypted
   *  (`meta.encrypted: false`) — never a refusal to record. */
  readonly sealKey: Buffer | null;
  readonly retention?: TrafficSessionRetention;
}

export interface TrafficSessionStartOptions {
  readonly sessionId: string;
  readonly sourceUid: string;
  readonly sourceKind: string;
  readonly sourceLabel: string;
  readonly name: string;
  readonly partitionTabId: number;
  readonly initialFidelity: LifecycleSource;
  readonly bounds: TrafficCaptureBounds;
  readonly pullBody: (requestId: string, hopIndex: number) => void;
  readonly onAutoStop?: (reason: TrafficCaptureEndReason) => void;
}

export interface TrafficSessionArchive {
  readonly blobs: TrafficBlobStore;
  /** Whether sealed artifacts will be encrypted. */
  readonly encrypted: boolean;
  /** Open one recording session in a fresh session directory. Throws
   *  when the directory or log cannot be created — the caller refuses
   *  the start rather than running a session that records nothing. */
  start(options: TrafficSessionStartOptions): TrafficSessionRecording;
  /** Scan + recover at boot: seal crashed/interrupted sessions, then
   *  sweep and enforce the budget. Idempotent. */
  recoverAtBoot(): Promise<void>;
  /** Every archived session's meta row, oldest first. */
  listSessions(): Promise<TrafficSessionMeta[]>;
  /** Delete one session directory, then sweep unreachable blobs. */
  deleteSession(sessionDir: string): Promise<void>;
  /** Remove every blob no surviving manifest references. */
  sweepBlobs(): Promise<void>;
  /** Prune SEALED sessions oldest-first until under the byte budget. */
  enforceRetention(): Promise<void>;
}

async function readMeta(sessionDir: string): Promise<TrafficSessionMeta | null> {
  try {
    const raw = await fsp.readFile(path.join(sessionDir, SESSION_META_FILE), 'utf8');
    const parsed = JSON.parse(raw) as TrafficSessionMeta;
    return parsed.formatVersion === 2 ? parsed : null;
  } catch {
    return null;
  }
}

async function readManifestDigests(sessionDir: string): Promise<string[]> {
  try {
    const raw = await fsp.readFile(path.join(sessionDir, SESSION_MANIFEST_FILE), 'utf8');
    return raw
      .split('\n')
      .map((line) => line.split(' ')[0] ?? '')
      .filter((digest) => digest.length === 64);
  } catch {
    return [];
  }
}

async function dirBytes(dir: string): Promise<number> {
  let total = 0;
  try {
    for (const name of await fsp.readdir(dir)) {
      try {
        total += (await fsp.stat(path.join(dir, name))).size;
      } catch {
        // Removed mid-scan.
      }
    }
  } catch {
    // Directory absent.
  }
  return total;
}

export function createTrafficSessionArchive(options: TrafficSessionArchiveOptions): TrafficSessionArchive {
  const sessionsDir = path.join(options.dir, 'sessions');
  const blobs = createTrafficBlobStore({ dir: path.join(options.dir, 'blobs'), sealKey: options.sealKey });
  const retention = options.retention ?? DEFAULT_TRAFFIC_SESSION_RETENTION;
  /** Serialize sweep/prune/recovery — concurrent sweeps would race the
   *  union they each computed. */
  let maintenance: Promise<void> = Promise.resolve();

  function scheduleMaintenance(task: () => Promise<void>): Promise<void> {
    maintenance = maintenance.then(task).catch((err) => {
      logger.warn(SCOPE, `maintenance failed: ${(err as Error).message}`);
    });
    return maintenance;
  }

  async function listSessionDirs(): Promise<string[]> {
    try {
      const names = await fsp.readdir(sessionsDir);
      return names.sort().map((name) => path.join(sessionsDir, name));
    } catch {
      return [];
    }
  }

  async function sweepBlobsNow(): Promise<void> {
    const reachable = new Set<string>();
    for (const dir of await listSessionDirs()) {
      for (const digest of await readManifestDigests(dir)) reachable.add(digest);
    }
    for (const digest of await blobs.list()) {
      if (!reachable.has(digest)) await blobs.remove(digest);
    }
  }

  async function deleteSessionNow(sessionDir: string): Promise<void> {
    await fsp.rm(sessionDir, { recursive: true, force: true });
    await sweepBlobsNow();
  }

  async function archiveTotalBytes(): Promise<number> {
    let total = await blobs.totalBytes();
    for (const dir of await listSessionDirs()) total += await dirBytes(dir);
    return total;
  }

  /** Prune ONE oldest sealed session at a time, sweep, recount — a
   *  session's real footprint includes the blobs only IT reaches, and
   *  only the sweep can price that honestly. */
  async function enforceRetentionNow(): Promise<void> {
    for (;;) {
      const total = await archiveTotalBytes();
      if (total <= retention.maxTotalBytes) return;
      const sessions: Array<{ dir: string; meta: TrafficSessionMeta }> = [];
      for (const dir of await listSessionDirs()) {
        const meta = await readMeta(dir);
        if (meta !== null && meta.state !== 'recording') sessions.push({ dir, meta });
      }
      sessions.sort((a, b) => a.meta.startedAtMs - b.meta.startedAtMs);
      const [victim] = sessions;
      if (victim === undefined) {
        logger.warn(SCOPE, `archive over budget (${total} bytes) with nothing prunable — a recording session holds it`);
        return;
      }
      logger.info(SCOPE, `retention prune: ${path.basename(victim.dir)} (${victim.meta.name})`);
      await fsp.rm(victim.dir, { recursive: true, force: true });
      await sweepBlobsNow();
    }
  }

  async function recoverSession(dir: string, meta: TrafficSessionMeta): Promise<void> {
    const plainExists = await fsp
      .access(path.join(dir, SESSION_EVENTS_FILE))
      .then(() => true)
      .catch(() => false);
    const sealExists = await fsp
      .access(path.join(dir, SESSION_SEAL_FILE))
      .then(() => true)
      .catch(() => false);
    if (!plainExists) {
      // Crash landed after the seal but before the meta rewrite.
      if (sealExists && meta.state !== 'sealed') {
        await writeSessionMeta(dir, { ...meta, state: 'sealed', endReason: meta.endReason ?? 'crashed' });
      }
      return;
    }
    const endReason = meta.state === 'recording' ? 'crashed' : (meta.endReason ?? 'crashed');
    logger.info(SCOPE, `recovering session ${meta.sessionId} (${meta.state} → sealed, ${endReason})`);
    const sealedBytes = await sealSessionLog(dir, options.sealKey, {
      events: meta.events,
      requests: meta.requests,
    });
    await writeSessionMeta(dir, {
      ...meta,
      state: 'sealed',
      endReason,
      sealedBytes,
      stoppedAtMs: meta.stoppedAtMs ?? Date.now(),
    });
  }

  return {
    blobs,
    encrypted: options.sealKey !== null,
    start(startOptions) {
      const dir = path.join(sessionsDir, sessionDirName(Date.now(), startOptions.name, startOptions.sessionId));
      return startTrafficSessionRecording({
        dir,
        sessionId: startOptions.sessionId,
        sourceUid: startOptions.sourceUid,
        sourceKind: startOptions.sourceKind,
        sourceLabel: startOptions.sourceLabel,
        name: startOptions.name,
        partitionTabId: startOptions.partitionTabId,
        initialFidelity: startOptions.initialFidelity,
        bounds: startOptions.bounds,
        blobs,
        sealKey: options.sealKey,
        pullBody: startOptions.pullBody,
        ...(startOptions.onAutoStop !== undefined ? { onAutoStop: startOptions.onAutoStop } : {}),
        onSealed: () => void scheduleMaintenance(enforceRetentionNow),
      });
    },
    recoverAtBoot() {
      return scheduleMaintenance(async () => {
        for (const dir of await listSessionDirs()) {
          const meta = await readMeta(dir);
          if (meta === null) continue;
          if (meta.state !== 'sealed') {
            try {
              await recoverSession(dir, meta);
            } catch (err) {
              logger.warn(SCOPE, `recovery failed for ${path.basename(dir)}: ${(err as Error).message}`);
            }
          }
        }
        await sweepBlobsNow();
        await enforceRetentionNow();
      });
    },
    async listSessions() {
      const metas: TrafficSessionMeta[] = [];
      for (const dir of await listSessionDirs()) {
        const meta = await readMeta(dir);
        if (meta !== null) metas.push(meta);
      }
      return metas.sort((a, b) => a.startedAtMs - b.startedAtMs);
    },
    deleteSession(sessionDir) {
      return scheduleMaintenance(() => deleteSessionNow(sessionDir));
    },
    sweepBlobs() {
      return scheduleMaintenance(sweepBlobsNow);
    },
    enforceRetention() {
      return scheduleMaintenance(enforceRetentionNow);
    },
  };
}
