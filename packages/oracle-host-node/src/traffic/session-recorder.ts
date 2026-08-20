/**
 * Session recorder v2 — the event-log persistence policy on the
 * converged partition store (the agent-traffic plan §11.3/§11.4).
 *
 * A session records the reducer INPUT: the verbatim wire-plane
 * envelope stream the mirror fans out (the same plane the retention
 * tap rides), stamped with an arrival clock, so replay (C6) is
 * "re-run the live reducers" — browser-tab vs proxy unification is
 * inherited from the shared lifecycle vocabulary rather than designed.
 * The v1 folded-projection format is retired with this module
 * (v5 fresh start — no migration).
 *
 * One rule: **events inline small payloads; anything large travels by
 * digest.** Four carve points swap payload strings above
 * {@link EXTERNALIZE_THRESHOLD_BYTES} for {@link TrafficBlobRef}
 * markers in the content-addressed store — response bodies
 * (`body-attached`), HAR-carried bodies (`har-attached` response
 * content / request postData), stream frames (`message-appended`) and
 * wrapper captures (`message-capture-appended`). Everything else is
 * written verbatim: the log stays small enough that replay
 * stream-decompresses it whole.
 *
 * File shape (`formatVersion: 2`, one directory per session):
 *
 *   - `events.jsonl` — `header` line, then `event` lines in arrival
 *     order, then one honest `end` trailer. Plain append-only while
 *     active (crash-safe; authenticated encryption cannot be
 *     crash-safely appended), written through a serialized queue so
 *     blob externalization never reorders the log.
 *   - `events.seal` — the sealed artifact stop produces: one OHS2
 *     container (brotli, AES-256-GCM when the archive holds a key)
 *     whose header carries the §11.4 trailer facts (counts, log
 *     digest). The plain log is removed only after the seal lands.
 *   - `blobs.manifest` — one line per REFERENCED digest, appended
 *     while recording; the archive's reachability GC unions these.
 *   - `meta.json` — the boot-scan index row (atomic rewrite).
 *
 * Wire honesty (§11.4): while recording, every request's response body
 * is pulled at completion — an accepted CDP/extension load; the
 * validator-keyed skip is rejected as presuming identity rather than
 * proving it. Pulls ride the source connection the tap already owns,
 * so the `body-attached` answer feeds every reader of the one wire.
 */

import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';

import { hostLogger as logger } from '@openheaders/core/logger';
import type {
  LifecycleSource,
  LifecycleWireMessage,
  RequestLifecycleUpdate,
  SseStreamMessage,
  StreamMessageCapture,
  WsStreamMessage,
} from '@openheaders/core/request-lifecycle';
import type {
  TrafficCaptureBounds,
  TrafficCaptureEndReason,
  TrafficCaptureSessionProjection,
  TrafficSessionPlane,
} from '@openheaders/core/traffic';
import type { InspectorHarBody, InspectorHarEntry } from '@openheaders/core/types';
import { registrableDomain } from '@openheaders/core/utils';

import type { TrafficBlobRef, TrafficBlobStore } from './blob-store';
import { sealContainer, sha256Hex } from './seal';

const SCOPE = 'TrafficSessionRecorder';

/** §11.4: payload strings at or above this externalize to the CAS. */
export const EXTERNALIZE_THRESHOLD_BYTES = 4 * 1024;

/** Origins listed in the meta index (auto-placement input, C5). */
const MAX_META_ORIGINS = 32;

/** Cadence of the live meta rewrite while recording — keeps the
 *  Sessions window's row (and a crash's recovered counts) honest
 *  without a per-event write. */
const META_PERSIST_INTERVAL_MS = 5_000;

export const SESSION_EVENTS_FILE = 'events.jsonl';
export const SESSION_SEAL_FILE = 'events.seal';
export const SESSION_META_FILE = 'meta.json';
export const SESSION_MANIFEST_FILE = 'blobs.manifest';

/** In-place stand-in for an externalized payload string. */
export interface TrafficBlobRefMarker {
  readonly '$oh-blob': TrafficBlobRef;
}

export type RecordedPayload = string | TrafficBlobRefMarker;

export function isBlobRefMarker(value: RecordedPayload | undefined): value is TrafficBlobRefMarker {
  return typeof value === 'object' && value !== null && '$oh-blob' in value;
}

export type RecordedHarEntry = Omit<InspectorHarEntry, 'request' | 'response'> & {
  request?: Omit<NonNullable<InspectorHarEntry['request']>, 'postData'> & {
    postData?: Omit<NonNullable<NonNullable<InspectorHarEntry['request']>['postData']>, 'text'> & {
      text?: RecordedPayload;
    };
  };
  response?: Omit<NonNullable<InspectorHarEntry['response']>, 'content'> & {
    content: Omit<NonNullable<InspectorHarEntry['response']>['content'], 'text'> & { text?: RecordedPayload };
  };
};

type RecordedStreamMessage =
  | (Omit<WsStreamMessage, 'data'> & { data: RecordedPayload })
  | (Omit<SseStreamMessage, 'data'> & { data: RecordedPayload });

type RecordedStreamMessageCapture = Omit<StreamMessageCapture, 'original' | 'delivered'> & {
  original?: RecordedPayload;
  delivered?: RecordedPayload;
};

type RecordedUpdate =
  | Exclude<
      RequestLifecycleUpdate,
      | { kind: 'body-attached' }
      | { kind: 'har-attached' }
      | { kind: 'message-appended' }
      | { kind: 'message-capture-appended' }
    >
  | {
      kind: 'body-attached';
      tabId: number;
      requestId: string;
      hopIndex: number;
      body: Omit<InspectorHarBody, 'content'> & { content: RecordedPayload };
    }
  | { kind: 'har-attached'; tabId: number; requestId: string; hopIndex: number; har: RecordedHarEntry }
  | { kind: 'message-appended'; tabId: number; requestId: string; message: RecordedStreamMessage }
  | { kind: 'message-capture-appended'; tabId: number; requestId: string; capture: RecordedStreamMessageCapture };

export type RecordedWireMessage =
  | Exclude<LifecycleWireMessage, { kind: 'lifecycle-update' }>
  | { kind: 'lifecycle-update'; update: RecordedUpdate };

/** The v2 header line — every fact a reader far from this code needs. */
export interface TrafficSessionHeaderLine {
  readonly kind: 'header';
  readonly formatVersion: 2;
  readonly sessionId: string;
  readonly sourceUid: string;
  readonly sourceKind: string;
  readonly sourceLabel: string;
  readonly name: string;
  readonly startedAtMs: number;
  readonly bounds: TrafficCaptureBounds;
  readonly planes: ReadonlyArray<TrafficSessionPlane>;
  readonly partitionTabId: number;
  readonly initialFidelity: LifecycleSource;
}

export interface TrafficSessionEventLine {
  readonly kind: 'event';
  readonly atMs: number;
  readonly msg: RecordedWireMessage;
}

export interface TrafficSessionEndLine {
  readonly kind: 'end';
  readonly reason: TrafficCaptureEndReason;
  readonly stoppedAtMs: number;
  readonly events: number;
  readonly requests: number;
  readonly bytesWritten: number;
}

export type TrafficSessionLine = TrafficSessionHeaderLine | TrafficSessionEventLine | TrafficSessionEndLine;

/** The boot-scan index row (`meta.json`) — §11.4's "scanned once at
 *  boot into memory"; organizing rewrites one meta atomically. */
export interface TrafficSessionMeta {
  readonly formatVersion: 2;
  readonly sessionId: string;
  readonly sourceUid: string;
  readonly sourceKind: string;
  readonly sourceLabel: string;
  readonly name: string;
  /** Organize collection (§11.1 auto-placement) — stamped at seal:
   *  browser-tab sessions under the dominant origin's registrable
   *  domain, proxy sessions under {@link WIRE_SESSION_COLLECTION};
   *  renameable through the organize verb after that. Absent = filed
   *  nowhere (a crashed session recovers collection-less — the
   *  dominant-origin tally died with the recorder). */
  readonly collection?: string;
  /** Organize folder INSIDE the collection — user-created only, never
   *  auto-stamped. Absent = directly under the collection. */
  readonly folder?: string;
  readonly startedAtMs: number;
  readonly bounds: TrafficCaptureBounds;
  readonly planes: ReadonlyArray<TrafficSessionPlane>;
  readonly partitionTabId: number;
  /** Last observed provenance — the §11.1 fidelity stamp. */
  readonly fidelity: LifecycleSource;
  readonly encrypted: boolean;
  readonly state: 'recording' | 'sealing' | 'sealed';
  readonly events: number;
  readonly requests: number;
  /** Requests that failed or answered 4xx/5xx — the auto-name's error
   *  count. */
  readonly errors: number;
  readonly bytesWritten: number;
  /** New blob bytes THIS session wrote (dedup accounting). */
  readonly blobBytesStored: number;
  readonly origins: ReadonlyArray<string>;
  readonly sealedBytes?: number;
  readonly stoppedAtMs?: number;
  readonly endReason?: TrafficCaptureEndReason;
}

export interface TrafficSessionRecorderOptions {
  /** The session's own directory (created here). */
  readonly dir: string;
  readonly sessionId: string;
  readonly sourceUid: string;
  readonly sourceKind: string;
  readonly sourceLabel: string;
  readonly name: string;
  readonly partitionTabId: number;
  readonly initialFidelity: LifecycleSource;
  readonly bounds: TrafficCaptureBounds;
  readonly blobs: TrafficBlobStore;
  /** Seal key — `null` seals honestly-unencrypted (`meta.encrypted`). */
  readonly sealKey: Buffer | null;
  /** Forward one eager body pull over the source's wire session. */
  readonly pullBody: (requestId: string, hopIndex: number) => void;
  /** Fired after the session stopped ITSELF (bound trip, write error) —
   *  never for an explicit `stop()`. */
  readonly onAutoStop?: (reason: TrafficCaptureEndReason) => void;
  /** Fired once the seal lands (or fails) — the archive's retention
   *  enforcement hook. */
  readonly onSealed?: () => void;
}

export interface TrafficSessionRecording {
  /** Whether the session still accepts envelopes. */
  readonly active: boolean;
  /** Record one verbatim wire envelope (serialized, order-preserving). */
  appendEnvelope(msg: LifecycleWireMessage): void;
  /** Stop recording and seal. Idempotent; later calls are no-ops. */
  stop(reason?: TrafficCaptureEndReason): void;
  projection(): TrafficCaptureSessionProjection;
}

/** `Overnight repro #3` → `overnight-repro-3` (bounded; never empty). */
export function slugifySessionName(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
  return slug.length > 0 ? slug : 'session';
}

/** `2026-08-05T10-15-30-123Z-overnight-repro-3-ses1` — sortable stamp
 *  first, operator name in the middle, session id collision-proof. */
export function sessionDirName(startedAtMs: number, name: string, sessionId: string): string {
  const stamp = new Date(startedAtMs).toISOString().replace(/[:.]/g, '-');
  return `${stamp}-${slugifySessionName(name)}-${sessionId}`;
}

/** The wire sessions' fixed organize collection: a proxy capture spans
 *  many sites, so filing it under one dominant domain would mislead.
 *  A NAME is what it lacks — the dominant site stamps that instead. */
export const WIRE_SESSION_COLLECTION = 'System Proxy';

function payloadBytes(value: string): number {
  return Buffer.byteLength(value, 'utf8');
}

/**
 * Seal one session's plain log into its OHS2 container and retire the
 * plain file. Shared with the archive's boot recovery (a crashed
 * session seals with everything appended before the crash).
 */
export async function sealSessionLog(
  dir: string,
  sealKey: Buffer | null,
  counts: { events: number; requests: number },
): Promise<number> {
  const plainPath = path.join(dir, SESSION_EVENTS_FILE);
  const sealPath = path.join(dir, SESSION_SEAL_FILE);
  const content = await fsp.readFile(plainPath);
  const framed = sealContainer(
    content,
    {
      kind: 'session-log',
      contentBytes: content.byteLength,
      contentSha256: sha256Hex(content),
      counts,
    },
    sealKey,
  );
  const tmp = `${sealPath}.${process.pid}.tmp`;
  await fsp.writeFile(tmp, framed, { flag: 'wx' });
  await fsp.rename(tmp, sealPath);
  await fsp.rm(plainPath, { force: true });
  return framed.byteLength;
}

/** Concurrent rewrites (the live cadence vs the trailer's) must never
 *  share a tmp name — the loser's rename would ENOENT. */
let metaTmpSeq = 0;

export async function writeSessionMeta(dir: string, meta: TrafficSessionMeta): Promise<void> {
  const metaPath = path.join(dir, SESSION_META_FILE);
  const tmp = `${metaPath}.${process.pid}.${++metaTmpSeq}.tmp`;
  await fsp.writeFile(tmp, JSON.stringify(meta), 'utf8');
  await fsp.rename(tmp, metaPath);
}

export function startTrafficSessionRecording(options: TrafficSessionRecorderOptions): TrafficSessionRecording {
  const startedAtMs = Date.now();
  fs.mkdirSync(options.dir, { recursive: true });
  const eventsFd = fs.openSync(path.join(options.dir, SESSION_EVENTS_FILE), 'ax');
  const manifestFd = fs.openSync(path.join(options.dir, SESSION_MANIFEST_FILE), 'ax');

  let state: TrafficCaptureSessionProjection['state'] = 'recording';
  let events = 0;
  let requests = 0;
  let bytesWritten = 0;
  let blobBytesStored = 0;
  let stoppedAtMs: number | undefined;
  let endReason: TrafficCaptureEndReason | undefined;
  let fidelity: LifecycleSource = options.initialFidelity;
  /** Meta name/collection — the start name (a browser tab's title) is
   *  the display name unless blank, in which case seal stamps the
   *  dominant site; the §11.1 auto-placement collection stamps at seal
   *  either way. Date, counts and fidelity are row chrome derived from
   *  the meta's own fields — never baked into the name. */
  let displayName = options.name;
  let collection: string | undefined;
  /** Requests counted toward the error tally. */
  const errored = new Set<string>();
  /** Per-origin request tally (capped) — the dominant-origin input to
   *  auto-placement; the key list doubles as the meta's origin index. */
  const originCounts = new Map<string, number>();
  /** Digests already on this session's manifest. */
  const manifested = new Set<string>();
  /** Redirect hop count per live request — the eager pull's hop index. */
  const hopCounts = new Map<string, number>();
  /** Requests whose completion pull (or wire body) already happened. */
  const bodySettled = new Set<string>();
  /** Serialized write chain — externalization must not reorder the log. */
  let queue: Promise<void> = Promise.resolve();

  function writeLine(fd: number, line: string): number {
    const buffer = Buffer.from(`${line}\n`, 'utf8');
    fs.writeSync(fd, buffer);
    return buffer.byteLength;
  }

  writeLine(
    eventsFd,
    JSON.stringify({
      kind: 'header',
      formatVersion: 2,
      sessionId: options.sessionId,
      sourceUid: options.sourceUid,
      sourceKind: options.sourceKind,
      sourceLabel: options.sourceLabel,
      name: options.name,
      startedAtMs,
      bounds: options.bounds,
      planes: ['lifecycle'],
      partitionTabId: options.partitionTabId,
      initialFidelity: fidelity,
    } satisfies TrafficSessionHeaderLine),
  );

  function currentMeta(): TrafficSessionMeta {
    return {
      formatVersion: 2,
      sessionId: options.sessionId,
      sourceUid: options.sourceUid,
      sourceKind: options.sourceKind,
      sourceLabel: options.sourceLabel,
      name: displayName,
      ...(collection !== undefined ? { collection } : {}),
      startedAtMs,
      bounds: options.bounds,
      planes: ['lifecycle'],
      partitionTabId: options.partitionTabId,
      fidelity,
      encrypted: options.sealKey !== null,
      state,
      events,
      requests,
      errors: errored.size,
      bytesWritten,
      blobBytesStored,
      origins: [...originCounts.keys()],
      ...(stoppedAtMs !== undefined ? { stoppedAtMs } : {}),
      ...(endReason !== undefined ? { endReason } : {}),
    };
  }

  function persistMeta(): void {
    void writeSessionMeta(options.dir, currentMeta()).catch((err) => {
      logger.warn(SCOPE, `session ${options.sessionId} meta write failed: ${(err as Error).message}`);
    });
  }
  persistMeta();

  // Live index row: the Sessions window lists a recording session from
  // its meta, and a crash recovers with the last persisted counts — so
  // the row is rewritten on a slow cadence, never per event.
  const metaTimer = setInterval(persistMeta, META_PERSIST_INTERVAL_MS);
  metaTimer.unref?.();

  async function externalize(value: string, mime?: string): Promise<RecordedPayload> {
    if (payloadBytes(value) < EXTERNALIZE_THRESHOLD_BYTES) return value;
    const put = await options.blobs.put(Buffer.from(value, 'utf8'), mime);
    if (put.wrote) blobBytesStored += put.storedBytes;
    if (!manifested.has(put.sha256)) {
      manifested.add(put.sha256);
      writeLine(manifestFd, `${put.sha256} ${put.bytes}`);
    }
    const ref: TrafficBlobRef = {
      sha256: put.sha256,
      bytes: put.bytes,
      ...(put.mime !== undefined ? { mime: put.mime } : {}),
    };
    return { '$oh-blob': ref };
  }

  /** Swap the four §11.4 carve points for blob refs; everything else
   *  passes through verbatim. */
  async function recordMessage(msg: LifecycleWireMessage): Promise<RecordedWireMessage> {
    if (msg.kind !== 'lifecycle-update') return msg;
    const update = msg.update;
    switch (update.kind) {
      case 'body-attached': {
        const content = await externalize(update.body.content);
        return { kind: 'lifecycle-update', update: { ...update, body: { ...update.body, content } } };
      }
      case 'har-attached': {
        const har: RecordedHarEntry = { ...update.har };
        const postText = update.har.request?.postData?.text;
        if (har.request?.postData !== undefined && postText !== undefined) {
          har.request = {
            ...har.request,
            postData: { ...har.request.postData, text: await externalize(postText, har.request.postData.mimeType) },
          };
        }
        const bodyText = update.har.response?.content.text;
        if (har.response !== undefined && bodyText !== undefined) {
          har.response = {
            ...har.response,
            content: { ...har.response.content, text: await externalize(bodyText, har.response.content.mimeType) },
          };
        }
        return { kind: 'lifecycle-update', update: { ...update, har } };
      }
      case 'message-appended': {
        const data = await externalize(update.message.data);
        return { kind: 'lifecycle-update', update: { ...update, message: { ...update.message, data } } };
      }
      case 'message-capture-appended': {
        const capture: RecordedStreamMessageCapture = { ...update.capture };
        if (update.capture.original !== undefined) capture.original = await externalize(update.capture.original);
        if (update.capture.delivered !== undefined) capture.delivered = await externalize(update.capture.delivered);
        return { kind: 'lifecycle-update', update: { ...update, capture } };
      }
      default:
        return { kind: 'lifecycle-update', update };
    }
  }

  /** Wire honesty: pull the final hop's body once per request at
   *  completion. Heuristic-fed partitions carry their bodies inline on
   *  `har-attached`, so a pull there would only round-trip an empty
   *  synthesized answer — skipped. */
  function observeForPulls(msg: LifecycleWireMessage): void {
    if (msg.kind === 'source') {
      fidelity = msg.source;
      return;
    }
    if (msg.kind !== 'lifecycle-update') return;
    const update = msg.update;
    switch (update.kind) {
      case 'started': {
        requests++;
        try {
          const origin = new URL(update.lifecycle.url).origin;
          const count = originCounts.get(origin);
          if (count !== undefined) originCounts.set(origin, count + 1);
          else if (originCounts.size < MAX_META_ORIGINS) originCounts.set(origin, 1);
        } catch {
          // Origin-less scheme — nothing to index.
        }
        return;
      }
      case 'redirect': {
        hopCounts.set(update.requestId, (hopCounts.get(update.requestId) ?? 0) + 1);
        return;
      }
      case 'body-attached': {
        bodySettled.add(update.requestId);
        return;
      }
      case 'phase': {
        const patch = update.patch;
        if (patch.phase === 'failed' || (patch.statusCode !== undefined && patch.statusCode >= 400)) {
          errored.add(update.requestId);
        }
        if (patch.phase !== 'completed' || bodySettled.has(update.requestId)) return;
        bodySettled.add(update.requestId);
        if (fidelity === 'heuristic') return;
        options.pullBody(update.requestId, hopCounts.get(update.requestId) ?? 0);
        return;
      }
      default:
        return;
    }
  }

  /** §11.1 auto-placement input: the registrable domain of the origin
   *  that carried the most requests; `null` when no origin was seen. */
  function dominantSite(): string | null {
    let best: string | null = null;
    let bestCount = 0;
    for (const [origin, count] of originCounts) {
      if (count > bestCount) {
        best = origin;
        bestCount = count;
      }
    }
    if (best === null) return null;
    return registrableDomain(best) ?? best;
  }

  /** Returns whether THIS call performed the stop — callers fire
   *  `onAutoStop` only on the transition, never on a repeat trip. */
  function finish(reason: TrafficCaptureEndReason): boolean {
    if (state !== 'recording') return false;
    state = 'sealing';
    stoppedAtMs = Date.now();
    endReason = reason;
    clearTimeout(durationTimer);
    clearInterval(metaTimer);
    queue = queue
      .then(async () => {
        // The trailer task runs AFTER every accepted append has
        // flushed, so the live counters ARE the final counts — which
        // is also the earliest the §11.1 auto-placement collection
        // (and a blank name's dominant-site fallback) can be stamped
        // honestly. The start name — a browser tab's title — survives:
        // it is the one string that behaves like a NAME.
        const site = dominantSite();
        collection = options.sourceKind === 'browser-tab' ? (site ?? options.sourceLabel) : WIRE_SESSION_COLLECTION;
        if (displayName.trim().length === 0) displayName = site ?? options.sourceLabel;
        try {
          writeLine(
            eventsFd,
            JSON.stringify({
              kind: 'end',
              reason,
              stoppedAtMs: stoppedAtMs as number,
              events,
              requests,
              bytesWritten,
            } satisfies TrafficSessionEndLine),
          );
        } catch {
          // Best-effort trailer on a failing disk — the meta still
          // carries the honest end reason.
        }
        fs.closeSync(eventsFd);
        fs.closeSync(manifestFd);
        // Awaited, unlike the live-cadence rewrites: `sealed` below is
        // the projection's quiescence signal — once a reader observes
        // it, no write of this session's may still be in flight.
        await writeSessionMeta(options.dir, currentMeta()).catch((err) => {
          logger.warn(SCOPE, `session ${options.sessionId} meta write failed: ${(err as Error).message}`);
        });
        try {
          const sealedBytes = await sealSessionLog(options.dir, options.sealKey, { events, requests });
          await writeSessionMeta(options.dir, { ...currentMeta(), state: 'sealed', sealedBytes });
          state = 'sealed';
        } catch (err) {
          // The plain log stays on disk — nothing recorded is lost; the
          // archive's boot recovery re-attempts the seal.
          logger.warn(SCOPE, `session ${options.sessionId} seal failed: ${(err as Error).message}`);
        }
        options.onSealed?.();
        logger.info(
          SCOPE,
          `session ${options.sessionId} ended (${reason}) — ${requests} requests, ${events} events, ${bytesWritten} bytes`,
        );
      })
      .catch((err) => {
        logger.warn(SCOPE, `session ${options.sessionId} teardown failed: ${(err as Error).message}`);
      });
    return true;
  }

  const durationTimer = setTimeout(() => {
    if (finish('duration-bound')) options.onAutoStop?.('duration-bound');
  }, options.bounds.maxDurationMs);
  durationTimer.unref?.();

  logger.info(SCOPE, `session ${options.sessionId} recording ${options.sourceUid} → ${options.dir}`);

  return {
    get active() {
      return state === 'recording';
    },
    appendEnvelope(msg) {
      if (state !== 'recording') return;
      observeForPulls(msg);
      const atMs = Date.now();
      queue = queue.then(async () => {
        // An envelope accepted while recording still flushes after an
        // explicit stop — its write task is chained BEFORE the stop's
        // trailer task. Only a bound trip or a failed disk discards
        // the queued tail: nothing may land past a tripped bound.
        if (endReason === 'size-bound' || endReason === 'write-error') return;
        try {
          const recorded = await recordMessage(msg);
          const line = JSON.stringify({ kind: 'event', atMs, msg: recorded } satisfies TrafficSessionEventLine);
          // +1 for the newline; a line that would cross the bound is NOT
          // written — a bound trip is a stop, never a silent truncation.
          if (bytesWritten + payloadBytes(line) + 1 > options.bounds.maxBytes) {
            if (finish('size-bound')) options.onAutoStop?.('size-bound');
            return;
          }
          bytesWritten += writeLine(eventsFd, line);
          events++;
        } catch (err) {
          logger.warn(SCOPE, `session ${options.sessionId} write failed: ${(err as Error).message}`);
          if (finish('write-error')) options.onAutoStop?.('write-error');
        }
      });
    },
    stop(reason = 'stopped') {
      finish(reason);
    },
    projection() {
      return {
        sessionId: options.sessionId,
        sourceUid: options.sourceUid,
        name: options.name,
        dirPath: options.dir,
        startedAtMs,
        bounds: options.bounds,
        planes: ['lifecycle'],
        requests,
        events,
        bytesWritten,
        encrypted: options.sealKey !== null,
        state,
        ...(stoppedAtMs !== undefined ? { stoppedAtMs } : {}),
        ...(endReason !== undefined ? { endReason } : {}),
      };
    },
  };
}
