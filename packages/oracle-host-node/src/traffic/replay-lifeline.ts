/**
 * Lifeline acceptor for sessions-archive replay (AGENT_TRAFFIC_PLAN.md
 * §11.1, C6) — a workbench surface opens `oh-replay:<archiveId>` and is
 * served the sealed session's recorded envelope stream over the SAME
 * wire vocabulary a live lifecycle lifeline speaks. No bespoke viewer
 * protocol exists: the consumer's `subscribe` answers with a `ready`
 * followed by the resolved event log in arrival order (instant fold —
 * the recorded frames carry their own clocks, so the waterfall stays
 * true), and its `request-body` pulls are answered from the archive's
 * blob store — the one pull that always succeeds.
 *
 * Refusals are honest: a session that cannot be opened (unknown,
 * unsealed, corrupt, or encrypted under a key this host no longer
 * holds) answers `watch-refused` with the `replay-unavailable` reason
 * instead of an empty list. `clear-session` is ignored — the archive
 * is immutable through this path (closing a replay changes nothing).
 *
 * Precedent: `daemon/proxy/capture-lifeline.ts` (acceptor serving a
 * synthetic partition). The distinct port prefix keeps replay dials
 * out of the partition mirror's interposer and the browser relay, and
 * live dials out of here — by name shape, not by ordering.
 */

import { getLifelineServer, type IncomingLifelinePort } from '@openheaders/core/awareness';
import { hostLogger as logger } from '@openheaders/core/logger';
import {
  type LifecycleConsumerMessage,
  type LifecycleWireMessage,
  parseReplayLifecyclePortName,
} from '@openheaders/core/request-lifecycle';

import type { TrafficSessionReplay } from './session-reader';

const SCOPE = 'TrafficReplayLifeline';

/** The one archive read this acceptor needs — the full archive
 *  interface stays out of the seam. */
export interface TrafficReplayArchive {
  openReplay(id: string): Promise<TrafficSessionReplay>;
}

/**
 * Accept one incoming lifeline if it addresses a replay port. Returns
 * `true` when claimed (message/disconnect handlers installed).
 */
export function acceptTrafficReplayLifeline(archive: TrafficReplayArchive, port: IncomingLifelinePort): boolean {
  const parsedId = parseReplayLifecyclePortName(port.name);
  if (parsedId === null) return false;
  // Rebound so the hoisted helpers below see the narrowed string.
  const archiveId: string = parsedId;

  /** Opened once per port, on the first subscribe — a reconnect on the
   *  same port re-streams from memory instead of re-reading the seal. */
  let opened: Promise<TrafficSessionReplay> | null = null;
  let disconnected = false;
  /** Serialized delivery — a re-subscribe or pull never interleaves
   *  with a stream still being posted. */
  let chain: Promise<void> = Promise.resolve();

  function post(message: LifecycleWireMessage): void {
    if (disconnected) return;
    port.postMessage(message);
  }

  function open(): Promise<TrafficSessionReplay> {
    if (opened === null) opened = archive.openReplay(archiveId);
    return opened;
  }

  function enqueue(task: () => Promise<void>): void {
    chain = chain.then(task).catch((err) => {
      logger.warn(SCOPE, `replay ${archiveId}: ${(err as Error).message}`);
    });
  }

  port.onMessage<LifecycleConsumerMessage>((msg) => {
    if (disconnected) return;
    if (msg?.kind === 'subscribe') {
      enqueue(async () => {
        let replay: TrafficSessionReplay;
        try {
          replay = await open();
        } catch (err) {
          logger.warn(SCOPE, `replay ${archiveId} refused: ${(err as Error).message}`);
          post({ kind: 'watch-refused', tabId: 0, reason: 'replay-unavailable' });
          return;
        }
        // The consumer clears its fold on every `ready`; leading with a
        // synthesized one makes the re-subscribe contract hold even for
        // a log whose own first frame is not a `ready`. The provenance
        // replant follows (the mirror's late-joiner idiom): the `source`
        // frame that set the session's fidelity crossed the wire before
        // recording began, so the log starts source-less — without the
        // replant a CDP session would render heuristic and the panel's
        // lazy body pull would never fire. The recorded stream then
        // folds exactly as it did live.
        post({ kind: 'ready', tabId: replay.partitionTabId, watermarkMs: -1 });
        post({ kind: 'source', tabId: replay.partitionTabId, source: replay.initialFidelity });
        for (const envelope of replay.envelopes) {
          if (disconnected) return;
          post(envelope);
        }
      });
      return;
    }
    if (msg?.kind === 'request-body') {
      const { requestId, hopIndex } = msg;
      enqueue(async () => {
        if (opened === null) return;
        const answer = await (await opened).resolveBody(requestId, hopIndex).catch(() => null);
        if (answer !== null) post(answer);
      });
    }
    // `clear-session` falls through — the archive is immutable here.
  });
  port.onDisconnect(() => {
    disconnected = true;
    opened = null;
  });
  return true;
}

/**
 * Register the acceptor on the host's installed lifeline server. Call
 * once at spine boot; returns the unsubscribe for dispose. On a host
 * with no lifeline server (headless daemon) the core seam's default
 * never fires — a clean no-op.
 */
export function installTrafficReplayLifeline(archive: TrafficReplayArchive): () => void {
  return getLifelineServer().onConnect((port) => {
    acceptTrafficReplayLifeline(archive, port);
  });
}
