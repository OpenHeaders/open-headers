/**
 * `FireClientStore` — transitional panel-side store of `InspectorFire`
 * records arriving on the legacy `devtools-inspector:<tabId>` port.
 *
 * Q3=B (session 18 design): inspector-store.ts dies in this epic, but
 * the engine-side fire broadcaster (a W-a equivalent for fires) lands
 * in its own session. Until then, this thin store reads ONLY the
 * `fire` messages off the legacy port. No correlation logic — the
 * join key is the lifecycle's `requestId`, applied at the facet via
 * `attachFiresToRows`.
 *
 * Dedup: fires arrive via two channels in dev mode (Chrome's
 * `onRuleMatchedDebug` and the in-page fire-bridge). Both can describe
 * the same logical fire. Deduped by `(ruleUid, requestId)` when a
 * requestId is present; by `(ruleUid, t)` otherwise (scriptable-only).
 * Race-independent: whichever arrival is the stronger signal wins via
 * `mergeFireEvidence`. Same algorithm as the legacy store; lifted into
 * its own module here so the death of inspector-store doesn't take it
 * with it.
 */

import { mergeFireEvidence, type InspectorFire } from './types';

const MAX_FIRES = 5_000;

export interface FireClientSnapshot {
  readonly fires: readonly InspectorFire[];
}

const EMPTY_SNAPSHOT: FireClientSnapshot = Object.freeze({
  fires: Object.freeze([]) as readonly InspectorFire[],
});

function dedupKey(ruleUid: string, requestId: string | undefined, t: number): string {
  return requestId ? `${ruleUid}:${requestId}` : `${ruleUid}:t:${t}`;
}

export class FireClientStore {
  private fires: InspectorFire[] = [];
  private byKey = new Map<string, number>();
  private snapshotCache: FireClientSnapshot = EMPTY_SNAPSHOT;
  private snapshotDirty = false;
  private readonly listeners = new Set<() => void>();

  ingest(fire: InspectorFire): void {
    const key = dedupKey(fire.ruleUid, fire.requestId, fire.t);
    const existingIdx = this.byKey.get(key);
    if (existingIdx != null) {
      const merged = mergeFireEvidence(this.fires[existingIdx], fire);
      if (merged === this.fires[existingIdx]) return;
      this.fires[existingIdx] = merged;
      this.snapshotDirty = true;
      this.notify();
      return;
    }
    this.fires.push(fire);
    this.byKey.set(key, this.fires.length - 1);
    if (this.fires.length > MAX_FIRES) {
      // Drop oldest. Repair the index — rare path; full rebuild is
      // simpler than tracking position deltas.
      const dropCount = this.fires.length - MAX_FIRES;
      const dropped = this.fires.splice(0, dropCount);
      for (const d of dropped) {
        this.byKey.delete(dedupKey(d.ruleUid, d.requestId, d.t));
      }
      this.byKey.clear();
      for (let i = 0; i < this.fires.length; i++) {
        const f = this.fires[i];
        this.byKey.set(dedupKey(f.ruleUid, f.requestId, f.t), i);
      }
    }
    this.snapshotDirty = true;
    this.notify();
  }

  clear(): void {
    if (this.fires.length === 0) return;
    this.fires = [];
    this.byKey.clear();
    this.snapshotDirty = true;
    this.notify();
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  readonly getSnapshot = (): FireClientSnapshot => {
    if (this.snapshotDirty) {
      this.snapshotCache = { fires: this.fires.slice() };
      this.snapshotDirty = false;
    }
    return this.snapshotCache;
  };

  private notify(): void {
    for (const listener of this.listeners) listener();
  }
}
