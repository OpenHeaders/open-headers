/**
 * Sealed-session read plane for replay (the agent-traffic plan §11.1
 * "replay is the live UI", C6) — the first consumer that reads an
 * event log back. One sealed session opens into:
 *
 *   - an ordered {@link LifecycleWireMessage} envelope stream — the
 *     verbatim reducer INPUT the recorder teed (§11.3), so replay is
 *     "re-run the live reducers" with zero viewer changes; and
 *   - a body resolver over the content-addressed blob store — the one
 *     pull that always succeeds, because the archive holds what the
 *     wire has long forgotten.
 *
 * Blob-ref markers resolve where the LIVE view's contract puts each
 * payload (the C6 decision): `har-attached` bodies/postData and stream
 * message frames arrive PUSHED inline on a live wire, so they are
 * re-inlined into the stream here; `body-attached` events are the live
 * lazy-pull answer, so they are WITHHELD from the stream and served on
 * the consumer's `request-body` pull — the exact live idiom, and the
 * renderer never holds bodies nobody asked for.
 *
 * §11.5 boundary: the raw line vocabulary stays in this package; what
 * leaves {@link readSessionReplay} is wire vocabulary plus the narrow
 * facts a replay acceptor needs.
 */

import * as fsp from 'node:fs/promises';
import * as path from 'node:path';

import { hostLogger as logger } from '@openheaders/core/logger';
import type {
  LifecycleSource,
  LifecycleWireMessage,
  StreamMessage,
  StreamMessageCapture,
} from '@openheaders/core/request-lifecycle';
import type { InspectorHarBody, InspectorHarEntry } from '@openheaders/core/types';

import type { TrafficBlobStore } from './blob-store';
import { openContainer } from './seal';
import {
  isBlobRefMarker,
  type RecordedHarEntry,
  type RecordedPayload,
  type RecordedWireMessage,
  SESSION_SEAL_FILE,
  type TrafficSessionLine,
} from './session-recorder';

const SCOPE = 'TrafficSessionReader';

/** One recorded `body-attached` event, withheld from the stream and
 *  served on the consumer's pull. */
interface WithheldBody {
  readonly tabId: number;
  readonly requestId: string;
  readonly hopIndex: number;
  readonly body: Omit<InspectorHarBody, 'content'> & { content: RecordedPayload };
}

/**
 * One sealed session, opened for replay. `envelopes` is fully resolved
 * wire vocabulary in arrival order; a consumer folds it exactly as it
 * folds a live stream.
 */
export interface TrafficSessionReplay {
  /** The lifecycle partition the recorded envelopes address. */
  readonly partitionTabId: number;
  /**
   * Provenance at record start — the header's fidelity stamp. The
   * `source` frame that set it crossed the wire BEFORE recording
   * began, so the log itself starts source-less; a replay acceptor
   * replants it after its `ready` (the mirror's late-joiner idiom),
   * and any mid-session flip the log DID record replays verbatim
   * after.
   */
  readonly initialFidelity: LifecycleSource;
  readonly envelopes: ReadonlyArray<LifecycleWireMessage>;
  /**
   * Serve one withheld body — the `request-body` pull's archive-backed
   * answer. `null` when the session never recorded that hop's body
   * (the wire contract: an unanswerable pull is silently dropped).
   */
  resolveBody(requestId: string, hopIndex: number): Promise<LifecycleWireMessage | null>;
}

function bodyKey(requestId: string, hopIndex: number): string {
  return `${requestId}:${hopIndex}`;
}

export async function readSessionReplay(
  dir: string,
  sealKey: Buffer | null,
  blobs: TrafficBlobStore,
): Promise<TrafficSessionReplay> {
  const framed = await fsp.readFile(path.join(dir, SESSION_SEAL_FILE));
  const { header, content } = openContainer(framed, sealKey);
  if (header.kind !== 'session-log') throw new Error('sealed artifact is not a session log');

  /** Digest → decoded text, memoized per open — a payload repeated
   *  across events reads from the store once. */
  const resolved = new Map<string, Promise<string>>();
  function resolvePayload(payload: RecordedPayload): Promise<string> {
    if (!isBlobRefMarker(payload)) return Promise.resolve(payload);
    const ref = payload['$oh-blob'];
    let pending = resolved.get(ref.sha256);
    if (pending === undefined) {
      pending = blobs
        .get(ref.sha256)
        .then((buffer) => {
          if (buffer !== null) return buffer.toString('utf8');
          logger.warn(SCOPE, `blob ${ref.sha256} absent — replaying an empty payload`);
          return '';
        })
        .catch((err) => {
          logger.warn(SCOPE, `blob ${ref.sha256} unreadable: ${(err as Error).message}`);
          return '';
        });
      resolved.set(ref.sha256, pending);
    }
    return pending;
  }

  /** Re-inline the two HAR carve points — a live wire pushes these
   *  bodies inline, so a replayed frame must too. */
  async function inlineHar(recorded: RecordedHarEntry): Promise<InspectorHarEntry> {
    const { request: recRequest, response: recResponse, ...bare } = recorded;
    const har: InspectorHarEntry = { ...bare };
    if (recRequest !== undefined) {
      const { postData, ...requestBare } = recRequest;
      har.request = { ...requestBare };
      if (postData !== undefined) {
        const { text, ...postBare } = postData;
        har.request.postData = { ...postBare, ...(text !== undefined ? { text: await resolvePayload(text) } : {}) };
      }
    }
    if (recResponse !== undefined) {
      const { content, ...responseBare } = recResponse;
      const { text, ...contentBare } = content;
      har.response = {
        ...responseBare,
        content: { ...contentBare, ...(text !== undefined ? { text: await resolvePayload(text) } : {}) },
      };
    }
    return har;
  }

  const envelopes: LifecycleWireMessage[] = [];
  const withheld = new Map<string, WithheldBody>();
  let partitionTabId = 0;
  let initialFidelity: LifecycleSource = 'heuristic';

  for (const raw of content.toString('utf8').split('\n')) {
    if (raw.length === 0) continue;
    let line: TrafficSessionLine;
    try {
      line = JSON.parse(raw) as TrafficSessionLine;
    } catch {
      logger.warn(SCOPE, `unparseable line in ${dir} — skipped`);
      continue;
    }
    if (line.kind === 'header') {
      if (line.formatVersion !== 2) throw new Error(`unknown session log formatVersion ${line.formatVersion}`);
      partitionTabId = line.partitionTabId;
      initialFidelity = line.initialFidelity;
      continue;
    }
    if (line.kind === 'end') continue;
    if (line.kind !== 'event') continue;
    const msg: RecordedWireMessage = line.msg;
    if (msg.kind !== 'lifecycle-update') {
      envelopes.push(msg);
      continue;
    }
    const update = msg.update;
    switch (update.kind) {
      case 'body-attached':
        // The live lazy-pull answer — withheld; last write per hop wins,
        // matching the store's own fold of repeated attachments.
        withheld.set(bodyKey(update.requestId, update.hopIndex), {
          tabId: update.tabId,
          requestId: update.requestId,
          hopIndex: update.hopIndex,
          body: update.body,
        });
        break;
      case 'har-attached':
        envelopes.push({
          kind: 'lifecycle-update',
          update: {
            kind: 'har-attached',
            tabId: update.tabId,
            requestId: update.requestId,
            hopIndex: update.hopIndex,
            har: await inlineHar(update.har),
          },
        });
        break;
      case 'message-appended': {
        const { data: recorded, ...messageBare } = update.message;
        const message: StreamMessage = { ...messageBare, data: await resolvePayload(recorded) };
        envelopes.push({
          kind: 'lifecycle-update',
          update: { kind: 'message-appended', tabId: update.tabId, requestId: update.requestId, message },
        });
        break;
      }
      case 'message-capture-appended': {
        const { original, delivered, ...captureBare } = update.capture;
        const capture: StreamMessageCapture = {
          ...captureBare,
          ...(original !== undefined ? { original: await resolvePayload(original) } : {}),
          ...(delivered !== undefined ? { delivered: await resolvePayload(delivered) } : {}),
        };
        envelopes.push({
          kind: 'lifecycle-update',
          update: { kind: 'message-capture-appended', tabId: update.tabId, requestId: update.requestId, capture },
        });
        break;
      }
      default:
        envelopes.push({ kind: 'lifecycle-update', update });
    }
  }

  return {
    partitionTabId,
    initialFidelity,
    envelopes,
    async resolveBody(requestId, hopIndex) {
      const entry = withheld.get(bodyKey(requestId, hopIndex));
      if (entry === undefined) return null;
      const body: InspectorHarBody = { ...entry.body, content: await resolvePayload(entry.body.content) };
      return {
        kind: 'lifecycle-update',
        update: { kind: 'body-attached', tabId: entry.tabId, requestId, hopIndex, body },
      };
    },
  };
}
