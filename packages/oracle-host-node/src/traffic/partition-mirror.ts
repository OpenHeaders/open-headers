/**
 * Traffic partition mirror — the single authoritative host-side store
 * per watched browser-tab partition (the agent-traffic plan §11.2, C2).
 *
 * Before C2 every consumer of a `(nodeId, tabId)` partition — the
 * Traffic Monitor's viewer port, the agent tap, each inspect tab — was
 * its own relay consumer with its own extension-side stream session:
 * one watched-and-armed tab streamed every frame twice. The mirror
 * collapses that fan-out to ONE wire session per partition feeding ONE
 * fold, with every reader becoming a read-policy on the result:
 *
 *   - **Viewers** (workbench ports on the qualified lifeline) are served
 *     hub-style per the §10 read-model law — a `RequestLifecycleHub`
 *     over the mirrored `RequestLifecycleStore` answers each attach with
 *     `ready` + a LOCAL snapshot, then live diffs. The wire vocabulary
 *     and ordering are exactly what the relay pass-through delivered, so
 *     the panel's client reducer is untouched; a reopen no longer
 *     re-replays over the wire at all.
 *   - **The tap** rides a verbatim envelope fan-out — the same
 *     `LifecycleWireMessage` stream its port carried before C2, so the
 *     `TrafficRetentionConsumer`'s replay/dedup/arm-floor contract is
 *     byte-identical. A tap attaching to a LIVE session gets a
 *     synthesized `ready` whose watermark is the mirror's own (the
 *     newest `startedAtMs` the engine holds — the arm-floor semantics of
 *     STATUS finding 6), so pre-arm history never leaks past the floor.
 *
 * Interposition, not relay surgery: `installInterposer` wraps the
 * lifeline server so qualified lifecycle viewer ports (real tabs only —
 * `tabId >= 0`) are claimed here before any later acceptor sees them;
 * storage/console ports and every other name pass through untouched.
 * The mirror's own relay dials bypass the intercept (synchronous dial,
 * synchronous flag), so the relay keeps serving exactly one consumer
 * per partition: this mirror. Zero edits to the relay itself.
 *
 * Session lifecycle: the wire is dialed on the first reader (viewer
 * subscribe or tap attach) and released — entry, store and all — when
 * the last reader leaves (the no-viewer → silence law, now enforced
 * once for all readers). A reconnect epoch (`ready` on a live wire)
 * resets the fold and re-attaches viewers so their next `ready` is the
 * reset signal, mirroring today's direct-wire contract; the engine's
 * fresh replay then rebuilds both planes through the one path.
 */

import {
  getLifelineServer,
  type IncomingLifelinePort,
  type LifelineServer,
  setLifelineServer,
} from '@openheaders/core/awareness';
import { hostLogger as logger } from '@openheaders/core/logger';
import {
  type LifecycleConsumerMessage,
  type LifecycleSource,
  type LifecycleWireMessage,
  parseQualifiedLifecyclePortName,
  qualifiedLifecyclePortName,
} from '@openheaders/core/request-lifecycle';
import {
  type AttachmentHandle,
  RequestLifecycleHub,
  type WatchSessionFloors,
} from '@openheaders/oracle/request-lifecycle-hub';
import { RequestLifecycleStore } from '@openheaders/oracle/request-lifecycle-store';
import { TabLifecycleBus } from '@openheaders/oracle/tab-lifecycle-bus';

import type { LoopbackLifelineDialer, LoopbackLifelinePort } from './loopback-lifeline';

const SCOPE = 'TrafficPartitionMirror';

export interface TrafficPartitionMirrorDeps {
  readonly dialer: LoopbackLifelineDialer;
}

/** The tap's seat on one mirrored partition. */
export interface TrafficMirrorTapSeat {
  /** Forward one on-demand body pull over the partition's wire session. */
  requestBody(requestId: string, hopIndex: number): void;
  /** Leave the partition; the last reader out releases the wire. */
  detach(): void;
}

export interface TrafficPartitionMirror {
  /**
   * Wrap the lifeline server so qualified lifecycle viewer ports are
   * served from the mirror. Install BEFORE the relay's acceptor
   * registers. Returns the uninstall (restores the wrapped server).
   */
  installInterposer(): () => void;
  /**
   * Join the partition as the retention tap: verbatim wire envelopes
   * flow to `onEnvelope` exactly as a dedicated relay port would carry
   * them. `null` when the relay refused the dial (not installed).
   */
  attachTapConsumer(
    nodeId: string,
    tabId: number,
    onEnvelope: (message: LifecycleWireMessage) => void,
  ): TrafficMirrorTapSeat | null;
  /** Release every partition. Idempotent. */
  dispose(): void;
}

/**
 * Viewer floors for the mirror hub. The mirror's content is already
 * scoped by the ENGINE's per-tab watch-session floor (that floor decides
 * what crosses the wire), so local attaches replay everything retained —
 * a floor of `-1` under epoch-ms `startedAtMs` values. The DevTools
 * session token observed on the wire is carried through so viewer
 * `ready` envelopes report the same token a direct port would.
 */
class MirrorViewerFloors implements WatchSessionFloors {
  token: string | undefined;

  resolveFloor(): number {
    return -1;
  }
  startSession(): boolean {
    return false;
  }
  sessionToken(): string | undefined {
    return this.token;
  }
  reset(): void {}
  forget(): void {}
}

interface ViewerSeat {
  readonly port: IncomingLifelinePort;
  handle: AttachmentHandle | null;
  subscribed: boolean;
}

interface TapSeatState {
  readonly onEnvelope: (message: LifecycleWireMessage) => void;
}

interface PartitionEntry {
  readonly key: string;
  readonly nodeId: string;
  readonly tabId: number;
  readonly store: RequestLifecycleStore;
  readonly bus: TabLifecycleBus;
  readonly hub: RequestLifecycleHub;
  readonly floors: MirrorViewerFloors;
  readonly viewers: Set<ViewerSeat>;
  readonly taps: Set<TapSeatState>;
  wire: LoopbackLifelinePort | null;
  wireReady: boolean;
  /** Latest wire-observed provenance; synthesized for late joiners only
   *  once a real `source` frame has been seen. */
  provenance: LifecycleSource;
  sourceSeen: boolean;
}

function partitionKey(nodeId: string, tabId: number): string {
  return `${nodeId} ${tabId}`;
}

function isConsumerMessage(msg: unknown): msg is LifecycleConsumerMessage {
  const kind = (msg as { kind?: unknown } | null)?.kind;
  return kind === 'subscribe' || kind === 'clear-session' || kind === 'request-body';
}

export function createTrafficPartitionMirror(deps: TrafficPartitionMirrorDeps): TrafficPartitionMirror {
  const entries = new Map<string, PartitionEntry>();
  /** Non-zero while the mirror itself is dialing the relay — those
   *  loopback offers must pass the interposer through, not self-claim. */
  let dialBypassDepth = 0;
  let disposed = false;

  function dialThroughRelay(name: string): LoopbackLifelinePort | null {
    dialBypassDepth++;
    try {
      return deps.dialer.dial(name);
    } finally {
      dialBypassDepth--;
    }
  }

  function ensureEntry(nodeId: string, tabId: number): PartitionEntry {
    const key = partitionKey(nodeId, tabId);
    let entry = entries.get(key);
    if (entry) return entry;
    const store = new RequestLifecycleStore();
    const bus = new TabLifecycleBus();
    const floors = new MirrorViewerFloors();
    entry = {
      key,
      nodeId,
      tabId,
      store,
      bus,
      hub: new RequestLifecycleHub({ store, bus, sessionFloors: floors }),
      floors,
      viewers: new Set(),
      taps: new Set(),
      wire: null,
      wireReady: false,
      provenance: 'heuristic',
      sourceSeen: false,
    };
    entries.set(key, entry);
    return entry;
  }

  /** Serve one viewer from the local hub: `ready` + snapshot + live, in
   *  the wire vocabulary the direct relay port used to carry. */
  function attachViewer(entry: PartitionEntry, seat: ViewerSeat): void {
    seat.handle = entry.hub.attach(entry.tabId, {
      deliverReady(tabId, watermarkMs, sessionToken) {
        seat.port.postMessage({
          kind: 'ready',
          tabId,
          watermarkMs,
          ...(sessionToken !== undefined ? { sessionToken } : {}),
        } satisfies LifecycleWireMessage);
      },
      deliverUpdate(update) {
        seat.port.postMessage({ kind: 'lifecycle-update', update } satisfies LifecycleWireMessage);
      },
      deliverTabCleared(tabId) {
        seat.port.postMessage({ kind: 'tab-cleared', tabId } satisfies LifecycleWireMessage);
      },
      close() {
        // Hub dispose path; the port teardown owns the seat.
      },
    });
    // The wire sends `source` after its replay; a late joiner missed
    // that frame, so replant the current provenance once it is known.
    if (entry.sourceSeen) {
      seat.port.postMessage({
        kind: 'source',
        tabId: entry.tabId,
        source: entry.provenance,
      } satisfies LifecycleWireMessage);
    }
  }

  function reattachViewer(entry: PartitionEntry, seat: ViewerSeat): void {
    seat.handle?.detach();
    seat.handle = null;
    attachViewer(entry, seat);
  }

  function forwardToTaps(entry: PartitionEntry, message: LifecycleWireMessage): void {
    for (const tapSeat of [...entry.taps]) {
      try {
        tapSeat.onEnvelope(message);
      } catch (err) {
        logger.warn(SCOPE, `tap envelope handler threw for ${entry.key}`, err);
      }
    }
  }

  function handleWireMessage(entry: PartitionEntry, message: LifecycleWireMessage): void {
    switch (message.kind) {
      case 'ready': {
        entry.floors.token = message.sessionToken;
        if (entry.wireReady) {
          // Reconnect epoch (SW eviction, wire flap, overflow
          // self-heal): reset the fold and hand each viewer a fresh
          // `ready` — the engine's canonical replay rebuilds the
          // mirror through the one live path, exactly as the
          // direct-port consumer contract behaves.
          entry.store.forgetTab(entry.tabId);
          for (const seat of entry.viewers) {
            if (seat.subscribed) reattachViewer(entry, seat);
          }
        } else {
          entry.wireReady = true;
          for (const seat of entry.viewers) {
            if (seat.subscribed && seat.handle === null) attachViewer(entry, seat);
          }
        }
        forwardToTaps(entry, message);
        return;
      }
      case 'lifecycle-update': {
        entry.store.apply(message.update);
        forwardToTaps(entry, message);
        return;
      }
      case 'tab-cleared': {
        entry.store.forgetTab(message.tabId);
        // The bus pulse fans `deliverTabCleared` to every attached
        // viewer through the hub's own subscription.
        entry.bus.notifyTabForgotten(message.tabId);
        forwardToTaps(entry, message);
        return;
      }
      case 'source': {
        entry.provenance = message.source;
        entry.sourceSeen = true;
        for (const seat of entry.viewers) {
          if (seat.handle !== null) seat.port.postMessage(message);
        }
        forwardToTaps(entry, message);
        return;
      }
      case 'watch-refused': {
        // Pending viewers included — the refusal is what a gated
        // subscribe answers with, and the panel renders the gate from it.
        for (const seat of entry.viewers) seat.port.postMessage(message);
        forwardToTaps(entry, message);
        return;
      }
    }
  }

  function ensureWire(entry: PartitionEntry): boolean {
    if (entry.wire !== null) return true;
    const port = dialThroughRelay(qualifiedLifecyclePortName(entry.tabId, entry.nodeId));
    if (port === null) return false;
    entry.wire = port;
    port.onMessage<LifecycleWireMessage>((message) => handleWireMessage(entry, message));
    // Arming subscribes (PLAN §1.1) — the relay forwards this to the
    // owning peer and re-sends it on every peer reconnect.
    port.send({ kind: 'subscribe' });
    return true;
  }

  function maybeReleaseEntry(entry: PartitionEntry): void {
    if (entry.viewers.size > 0 || entry.taps.size > 0) return;
    entries.delete(entry.key);
    entry.wire?.disconnect();
    entry.hub.dispose();
    entry.bus.dispose();
  }

  function acceptViewerPort(entry: PartitionEntry, port: IncomingLifelinePort): void {
    const seat: ViewerSeat = { port, handle: null, subscribed: false };
    entry.viewers.add(seat);
    port.onMessage<LifecycleConsumerMessage>((msg) => {
      if (!isConsumerMessage(msg)) return;
      if (msg.kind === 'subscribe') {
        seat.subscribed = true;
        if (!ensureWire(entry)) {
          logger.warn(SCOPE, `no acceptor claimed the wire dial for ${entry.key} — viewer stays silent`);
          return;
        }
        if (entry.wireReady && seat.handle === null) attachViewer(entry, seat);
        return;
      }
      if (msg.kind === 'clear-session') {
        // Advance the ENGINE's shared floor (so a reconnect never
        // resurrects the cleared rows) and reset the local fold — every
        // reader of the one store converges on the clear at once.
        entry.wire?.send(msg);
        entry.store.forgetTab(entry.tabId);
        entry.bus.notifyTabForgotten(entry.tabId);
        return;
      }
      entry.wire?.send(msg);
    });
    port.onDisconnect(() => {
      seat.handle?.detach();
      seat.handle = null;
      entry.viewers.delete(seat);
      maybeReleaseEntry(entry);
    });
  }

  return {
    installInterposer() {
      const inner = getLifelineServer();
      /** Ports already claimed here — every downstream handler's wrap
       *  sees each incoming port, so the claim must be idempotent. */
      const claimed = new WeakSet<IncomingLifelinePort>();
      const composite: LifelineServer = {
        onConnect(handler) {
          return inner.onConnect((port) => {
            if (!disposed && dialBypassDepth === 0) {
              const target = parseQualifiedLifecyclePortName(port.name);
              // Real browser tabs only — synthetic partitions (negative
              // ids) and storage/console names pass through untouched.
              if (target !== null && target.tabId >= 0) {
                if (!claimed.has(port)) {
                  claimed.add(port);
                  acceptViewerPort(ensureEntry(target.nodeId, target.tabId), port);
                }
                return;
              }
            }
            handler(port);
          });
        },
      };
      setLifelineServer(composite);
      return () => setLifelineServer(inner);
    },
    attachTapConsumer(nodeId, tabId, onEnvelope) {
      const entry = ensureEntry(nodeId, tabId);
      const seat: TapSeatState = { onEnvelope };
      // Join the fan-out BEFORE dialing: a synchronously-answering
      // acceptor delivers `ready` + replay inside the dial, and those
      // envelopes must reach this seat verbatim — only a seat joining a
      // session that was ALREADY live gets the synthesized floor below.
      const wasReady = entry.wireReady;
      entry.taps.add(seat);
      if (!ensureWire(entry)) {
        entry.taps.delete(seat);
        maybeReleaseEntry(entry);
        return null;
      }
      if (wasReady) {
        // Joining a live session: synthesize the arm-floor `ready` from
        // the mirror's own watermark — the newest `startedAtMs` the
        // engine holds right now, which is exactly the floor a dedicated
        // wire session's first `ready` would have carried (finding 6).
        // No snapshot follows: everything retained sits at or below the
        // floor, so the consumer would drop it anyway.
        const token = entry.floors.token;
        onEnvelope({
          kind: 'ready',
          tabId,
          watermarkMs: entry.store.tabWatermark(tabId),
          ...(token !== undefined ? { sessionToken: token } : {}),
        });
        if (entry.sourceSeen) onEnvelope({ kind: 'source', tabId, source: entry.provenance });
      }
      return {
        requestBody(requestId, hopIndex) {
          entry.wire?.send({ kind: 'request-body', requestId, hopIndex } satisfies LifecycleConsumerMessage);
        },
        detach() {
          if (!entry.taps.delete(seat)) return;
          maybeReleaseEntry(entry);
        },
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const entry of [...entries.values()]) {
        entries.delete(entry.key);
        for (const seat of entry.viewers) seat.handle?.detach();
        entry.viewers.clear();
        entry.taps.clear();
        entry.wire?.disconnect();
        entry.hub.dispose();
        entry.bus.dispose();
      }
    },
  };
}
