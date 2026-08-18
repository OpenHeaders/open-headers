/**
 * Agent-facing read plane over the sessions archive (the agent-traffic plan
 * §11.5, C7) — the projection consumer the session MCP tools speak
 * through. One sealed session opens via the SAME read replay uses
 * (`archive.openReplay`) and folds through the SAME retention reducer
 * the live tap runs: a synthesized `ready` (watermark `-1` — the whole
 * log admits) and the provenance replant precede the recorded
 * envelopes, so fidelity and provenance land exactly as a live fold
 * would stamp them.
 *
 * The §11.5 posture, structurally:
 *
 *   - **The store holds raw; every read here projects.** Rows and
 *     bodies leave through `projectRecord`/`projectBody` only — this
 *     module hands out no retained record and no recorded line.
 *   - **Redaction is the default; raw is the grant's call, never the
 *     caller's.** The persistent Settings grant (default OFF) is a
 *     live provider injected at boot — tool code cannot ask for raw,
 *     it can only learn whether the projection it received was raw
 *     (to flag the read's Activity Feed entry).
 *   - **The human plane is elsewhere.** Replay's lifeline serves raw
 *     to the workbench; the operator verbs live on the admin channel
 *     table. This plane exposes list/read only — no organize, no
 *     delete, no seal handle.
 *
 * Folds are memoized (small LRU + TTL): an agent paging through a
 * session or chasing a body must not re-open and re-fold the sealed
 * log per call. A sealed session is immutable, so staleness only
 * matters for deletion — the TTL bounds how long a deleted session's
 * fold can outlive its directory.
 */

import type { LifecycleSource, LifecycleWireMessage } from '@openheaders/core/request-lifecycle';
import type {
  TrafficArchivedSessionProjection,
  TrafficBodyProjection,
  TrafficRecordProjection,
} from '@openheaders/core/traffic';
import type { InspectorHarBody } from '@openheaders/core/types';
import {
  projectPulledBody,
  TrafficRetentionConsumer,
  TrafficRetentionRing,
} from '@openheaders/oracle/traffic-retention';

import { projectArchivedSession, type TrafficSessionArchive } from './session-archive';

/**
 * Fold bounds for one sealed session — deliberately far above the live
 * ring's defaults: the archive already bounded the session at record
 * time, and an agent read of a sealed log must not silently drop rows.
 * If a pathological session still trips them, the eviction surfaces as
 * {@link TrafficSessionRowsRead.truncatedOldest}, never silence.
 */
const SESSION_FOLD_BOUNDS = { maxRecords: 50_000, maxBytes: 256 * 1024 * 1024 };

/** Memoized folds kept warm. Two suffices for the list→get call
 *  pattern; the TTL bounds a deleted session's afterlife. */
const FOLD_CACHE_MAX = 2;
const FOLD_CACHE_TTL_MS = 60_000;

/** The dotted-key mirror of the §11.5 grant Settings row — parsed
 *  live from `OH.settingsUser`, same idiom as the retention budget. */
const SESSION_RAW_READS_SETTING = 'trafficMonitor.sessionAgentRawReads';

export function trafficSessionRawReadsFromSettings(values: Record<string, unknown> | undefined): boolean {
  return values?.[SESSION_RAW_READS_SETTING] === true;
}

export interface TrafficSessionQueryDeps {
  readonly archive: TrafficSessionArchive;
  /** The persistent unredacted-read grant (§11.5) — live-read per
   *  call, so a Settings flip applies to the next read, no restart. */
  readonly rawGrant: () => boolean;
}

/** One sealed session's records, projected per the grant in force. */
export interface TrafficSessionRowsRead {
  readonly rows: TrafficRecordProjection[];
  /** Whether the projection carried raw values — the caller flags the
   *  read's visibility entry with this, never decides it. */
  readonly raw: boolean;
  /** The session's fidelity stamp (header provenance). */
  readonly fidelity: LifecycleSource;
  /** Oldest records the fold bounds dropped — honest, normally 0. */
  readonly truncatedOldest: number;
}

/** Why a sealed session holds no body for an exchange — a result,
 *  never a throw (the archive is immutable; retrying cannot help). */
export type TrafficSessionBodyGap = 'phase-failed' | 'not-recorded';

export interface TrafficSessionRecordRead {
  readonly record: TrafficRecordProjection;
  readonly raw: boolean;
  readonly fidelity: LifecycleSource;
  readonly body?: TrafficBodyProjection;
  readonly bodyGap?: TrafficSessionBodyGap;
}

export interface TrafficSessionQuery {
  /** Every archived session's index row — meta facts only, never
   *  event-log content (the §11.5 index read). */
  list(): Promise<TrafficArchivedSessionProjection[]>;
  /**
   * All of one SEALED session's records, projected. Throws the
   * archive's own refusals (unknown id, not sealed yet, unopenable
   * seal) — agent-correctable, surfaced verbatim by the tool layer.
   */
  records(id: string): Promise<TrafficSessionRowsRead>;
  /** One exchange in full, with its archived body when the session
   *  recorded one. `null` = unknown requestId. */
  getRecord(id: string, requestId: string): Promise<TrafficSessionRecordRead | null>;
}

/** One opened fold: the projected read state plus the two archived
 *  body planes (withheld `body-attached` pulls and har-carried text). */
interface SessionFold {
  readonly ring: TrafficRetentionRing;
  readonly consumer: TrafficRetentionConsumer;
  readonly partitionTabId: number;
  readonly fidelity: LifecycleSource;
  /** Final-hop har response bodies by `requestId:hopIndex` — the plane
   *  heuristic/proxy sessions record instead of `body-attached`. */
  readonly harBodies: Map<string, InspectorHarBody>;
  resolveWithheld(requestId: string, hopIndex: number): Promise<LifecycleWireMessage | null>;
}

function bodyKey(requestId: string, hopIndex: number): string {
  return `${requestId}:${hopIndex}`;
}

export function createTrafficSessionQuery(deps: TrafficSessionQueryDeps): TrafficSessionQuery {
  const folds = new Map<string, { at: number; fold: Promise<SessionFold> }>();

  function openFold(id: string): Promise<SessionFold> {
    const now = Date.now();
    const cached = folds.get(id);
    if (cached !== undefined && now - cached.at < FOLD_CACHE_TTL_MS) return cached.fold;
    const fold = deps.archive.openReplay(id).then((replay): SessionFold => {
      const ring = new TrafficRetentionRing(SESSION_FOLD_BOUNDS);
      const consumer = new TrafficRetentionConsumer({ ring, initialProvenance: replay.initialFidelity });
      // The replay acceptor's exact preamble (finding 29): a floorless
      // `ready` so every recorded record admits, then the provenance
      // replant — the `source` frame that predates every recording.
      consumer.handle({ kind: 'ready', tabId: replay.partitionTabId, watermarkMs: -1 });
      consumer.handle({ kind: 'source', tabId: replay.partitionTabId, source: replay.initialFidelity });
      const harBodies = new Map<string, InspectorHarBody>();
      for (const envelope of replay.envelopes) {
        consumer.handle(envelope);
        if (envelope.kind !== 'lifecycle-update' || envelope.update.kind !== 'har-attached') continue;
        // The reducer strips har body text (bodies never ride record
        // reads); keep the reader's already-inlined text aside so the
        // single-exchange read can serve it. Last write per hop wins,
        // matching the store's own fold.
        const { update } = envelope;
        const har = update.har;
        const content = har.response?.content;
        if (content?.text !== undefined && content.text !== '') {
          harBodies.set(bodyKey(update.requestId, update.hopIndex), {
            method: har.request?.method ?? '',
            url: har.request?.url ?? '',
            startedDateTime: har.startedDateTime,
            content: content.text,
            encoding: content.encoding ?? '',
          });
        }
      }
      return {
        ring,
        consumer,
        partitionTabId: replay.partitionTabId,
        fidelity: replay.initialFidelity,
        harBodies,
        resolveWithheld: (requestId, hopIndex) => replay.resolveBody(requestId, hopIndex),
      };
    });
    // A refused open is never cached — the refusal reaches the caller
    // and the next call re-asks the archive.
    fold.catch(() => folds.delete(id));
    folds.set(id, { at: now, fold });
    while (folds.size > FOLD_CACHE_MAX) {
      let oldestId: string | undefined;
      let oldestAt = Number.POSITIVE_INFINITY;
      for (const [foldId, entry] of folds) {
        if (entry.at < oldestAt) {
          oldestAt = entry.at;
          oldestId = foldId;
        }
      }
      if (oldestId === undefined) break;
      folds.delete(oldestId);
    }
    return fold;
  }

  return {
    async list() {
      const rows = await deps.archive.listSessions();
      return rows.map((row) => projectArchivedSession(row.id, row.meta));
    },
    async records(id) {
      const fold = await openFold(id);
      const raw = deps.rawGrant();
      return {
        rows: fold.ring.snapshot(raw ? { revealSecrets: true } : undefined),
        raw,
        fidelity: fold.fidelity,
        truncatedOldest: fold.consumer.stats().evictedCount,
      };
    },
    async getRecord(id, requestId) {
      const fold = await openFold(id);
      const raw = deps.rawGrant();
      const options = raw ? { revealSecrets: true } : undefined;
      const record = fold.ring.projectOne(fold.partitionTabId, requestId, options);
      if (record === null) return null;
      const base = { record, raw, fidelity: fold.fidelity };
      if (record.phase === 'failed') return { ...base, bodyGap: 'phase-failed' };
      // The archive's two body planes, in fidelity order: a withheld
      // `body-attached` (CDP/proxy — the recorder's completion pull),
      // else the final hop's har-carried text (heuristic sessions).
      const hopIndex = record.redirectHopCount;
      const withheld = await fold.resolveWithheld(requestId, hopIndex);
      const attached =
        withheld !== null && withheld.kind === 'lifecycle-update' && withheld.update.kind === 'body-attached'
          ? withheld.update.body
          : (fold.harBodies.get(bodyKey(requestId, hopIndex)) ?? null);
      if (attached === null || attached.content === '') return { ...base, bodyGap: 'not-recorded' };
      return { ...base, body: projectPulledBody(attached, options) };
    },
  };
}
