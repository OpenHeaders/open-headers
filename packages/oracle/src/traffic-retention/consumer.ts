/**
 * `TrafficRetentionConsumer` — the third reducer of the lifecycle wire
 * (the agent-traffic plan §1.3): it folds a `LifecycleWireMessage`
 * stream into one source's retention ring under exactly the
 * replay/dedup semantics the panel reducer honors, plus the retention-
 * specific obligations the transport does not deliver by itself
 * (S0 findings 2 and 4):
 *
 *   - **`ready` is the epoch/reset signal.** Every reconnect path (SW
 *     eviction, wire flap, extension queue overflow) delivers a fresh
 *     `ready` + FULL replay from the tab's floor, with replay frames
 *     shaped as synthetic `started` updates indistinguishable from
 *     live. The consumer does NOT clear retained records on `ready` —
 *     retention is history — it absorbs the replay by identity: a
 *     replayed record it still holds is refreshed in place, one the
 *     ring evicted is refused, one it never saw is admitted.
 *   - **Retention starts at arm time.** The watch-session floor is
 *     per-tab, engine-owned and shared across consumers, so a replay
 *     can carry history from before the arm gesture. The FIRST
 *     `ready`'s `watermarkMs` — the newest `startedAtMs` the engine
 *     held at arm — is taken as the arm floor; every record at or
 *     below it is dropped, and later `ready`s never move the floor.
 *   - **Bodies are never retained.** `body-attached` updates and the
 *     stream/override planes are ignored wholesale; HAR facts fold in
 *     through the body-stripping record derivation only. The failure-
 *     body carve-out (PLAN §3) does NOT run through this reducer: the
 *     consumer only fires the `onFailure` seam and stamps the record;
 *     the tap pulls and the ring retains, capped.
 *
 * Host-neutral and transport-blind: the browser-tab tap feeds it port
 * frames, the proxy tap feeds it hub-sink deliveries wrapped in the
 * same envelopes. One reducer, three consumers of the spine — the
 * twin-reducer mirroring law is a triplet law from S1 on.
 */

import type { LifecycleSource, LifecycleWireMessage } from '@openheaders/core/request-lifecycle';
import type { TrafficRetentionStats } from '@openheaders/core/traffic';

import {
  applyHarToRecord,
  applyPatchToRecord,
  applyRedirectToRecord,
  isBodyBearingFailure,
  type RetainedTrafficRecord,
  recordFromLifecycle,
} from './record';
import type { TrafficRetentionRing } from './store';

export interface TrafficRetentionConsumerOptions {
  readonly ring: TrafficRetentionRing;
  /** Provenance stamped on records minted before the first `source`
   *  frame arrives — the proxy tap knows it up front ('proxy'); the
   *  browser tap starts from the default engine ('heuristic'). */
  readonly initialProvenance?: LifecycleSource;
  /** Observes consent-gate refusals (`watch-refused` envelopes) so the
   *  source registry can surface the refused state. */
  readonly onWatchRefused?: () => void;
  /**
   * The eager failure-body seam (PLAN §3 carve-out): fired exactly once
   * per record, the moment it classifies as a body-bearing HTTP failure
   * (error status + ran to completion — a network-level failure has no
   * response body to pull). The tap answers by pulling the body over
   * the source connection; the ring retains it only because the record
   * carries the `failureBodyRequested` stamp this seam sets first.
   */
  readonly onFailure?: (tabId: number, requestId: string, finalHopIndex: number) => void;
  /**
   * The admission/refinement seam (S4 — `traffic_wait`): fired after a
   * record is admitted to the ring or a retained record is refined
   * (phase patch, redirect hop, HAR facts), identity-only — the ring's
   * projections stay the ONLY read shape. Never fires for records the
   * floor dropped, replays the ring refused, or refinements of non-live
   * identities, so a reconnect replay cannot false-trigger a waiter
   * (replayed records below the arm floor never admit). Fired after the
   * ring fold for that envelope has fully settled — a listener may read
   * the ring synchronously.
   */
  readonly onRecord?: (tabId: number, requestId: string) => void;
}

export class TrafficRetentionConsumer {
  private readonly ring: TrafficRetentionRing;
  private readonly onWatchRefused: (() => void) | undefined;
  private readonly onFailure: ((tabId: number, requestId: string, finalHopIndex: number) => void) | undefined;
  private readonly onRecord: ((tabId: number, requestId: string) => void) | undefined;
  private provenance: LifecycleSource;
  /** Arm floor (`startedAtMs`, exclusive) — set by the FIRST `ready`. */
  private armFloorMs: number | null = null;
  private readyEpochs = 0;
  private droppedPreArm = 0;
  private droppedEvictedReplay = 0;

  constructor(options: TrafficRetentionConsumerOptions) {
    this.ring = options.ring;
    this.provenance = options.initialProvenance ?? 'heuristic';
    this.onWatchRefused = options.onWatchRefused;
    this.onFailure = options.onFailure;
    this.onRecord = options.onRecord;
  }

  /** Fold one wire envelope. Replay and live share this single path. */
  handle(message: LifecycleWireMessage): void {
    switch (message.kind) {
      case 'ready': {
        this.readyEpochs++;
        if (this.armFloorMs === null) this.armFloorMs = message.watermarkMs;
        return;
      }
      case 'source': {
        this.provenance = message.source;
        return;
      }
      case 'watch-refused': {
        this.onWatchRefused?.();
        return;
      }
      case 'tab-cleared':
        // The tab was forgotten upstream. Retained records are history
        // and stay; refinements for the dead tab simply stop arriving.
        return;
      case 'lifecycle-update': {
        this.handleUpdate(message.update);
        return;
      }
    }
  }

  /** Fire the eager failure-body seam exactly once per record. The
   *  stamp lives ON the record (and survives replay reconciliation via
   *  the ring's carry-over), so a reconnect replay never re-fires. */
  private checkFailure(record: RetainedTrafficRecord): void {
    if (this.onFailure === undefined || record.failureBodyRequested === true) return;
    if (!isBodyBearingFailure(record)) return;
    record.failureBodyRequested = true;
    this.onFailure(record.tabId, record.requestId, record.redirectHopCount);
  }

  /** The consumer's slice of the stats projection; the ring contributes
   *  the bounds/eviction counters. */
  stats(): TrafficRetentionStats {
    return {
      ...this.ring.counters(),
      droppedPreArm: this.droppedPreArm,
      droppedEvictedReplay: this.droppedEvictedReplay,
      readyEpochs: this.readyEpochs,
    };
  }

  private handleUpdate(update: Extract<LifecycleWireMessage, { kind: 'lifecycle-update' }>['update']): void {
    switch (update.kind) {
      case 'started': {
        // A frame arriving before any `ready` would have no floor to
        // honor — the wire contract makes that impossible (`ready` is
        // always first), so an unset floor here drops defensively.
        if (this.armFloorMs === null || update.lifecycle.startedAtMs <= this.armFloorMs) {
          this.droppedPreArm++;
          return;
        }
        const record = recordFromLifecycle(update.lifecycle, this.provenance);
        const outcome = this.ring.upsert(record);
        if (outcome === 'refused-evicted') this.droppedEvictedReplay++;
        // A replayed lifecycle can arrive terminal — an admitted or
        // reconciled record classifies right here.
        if (outcome === 'admitted' || outcome === 'updated') {
          this.checkFailure(record);
          this.onRecord?.(record.tabId, record.requestId);
        }
        return;
      }
      case 'phase': {
        const mutated = this.ring.update(update.tabId, update.requestId, (record) => {
          applyPatchToRecord(record, update.patch);
          this.checkFailure(record);
        });
        if (mutated) this.onRecord?.(update.tabId, update.requestId);
        return;
      }
      case 'redirect': {
        const mutated = this.ring.update(update.tabId, update.requestId, (record) => {
          applyRedirectToRecord(record, update.hop, update.nextUrl);
        });
        if (mutated) this.onRecord?.(update.tabId, update.requestId);
        return;
      }
      case 'har-attached': {
        // HAR facts can supply the error status a lifecycle never
        // patched — classification re-checks here too.
        const mutated = this.ring.update(update.tabId, update.requestId, (record) => {
          applyHarToRecord(record, update.har);
          this.checkFailure(record);
        });
        if (mutated) this.onRecord?.(update.tabId, update.requestId);
        return;
      }
      case 'gone': {
        // Removal upstream is not removal here — retention is the
        // history the live store no longer holds.
        return;
      }
      // Bodies, stream messages and override captures carry payloads
      // the store must never retain (PLAN §3) — ignored wholesale.
      case 'body-attached':
      case 'message-appended':
      case 'message-capture-appended':
      case 'response-override-attached':
      case 'request-override-attached':
        return;
    }
  }
}
