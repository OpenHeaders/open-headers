/**
 * `FireClientStore` — panel-side bag of `InspectorFire` records arriving
 * on the engine-side `oh-fires:<tabId>` port.
 *
 * Engine-side dedup: the rule-fire hub (`@openheaders/oracle/rule-fire-hub`)
 * already deduplicates by `(ruleUid, requestId)` (or `(ruleUid, t)` for
 * scriptable fires) and merges evidence/authoritative/snapshot upgrades
 * before broadcast. This store therefore is a plain upsert bag keyed by
 * the same identity — every wire arrival overwrites the entry for its
 * key, no merge logic on this side.
 *
 * Replay-on-reconnect is idempotent: the engine re-emits its snapshot
 * after `'ready'`, and the upsert by key absorbs any duplication.
 */

import type { InspectorFire } from './types';
import { createSnapshotPublisher } from './snapshot-publisher';

function dedupKey(ruleUid: string, requestId: string | undefined, t: number): string {
  return requestId ? `${ruleUid}:${requestId}` : `${ruleUid}:t:${t}`;
}

export interface FireClientSnapshot {
  readonly fires: readonly InspectorFire[];
}

const EMPTY_SNAPSHOT: FireClientSnapshot = Object.freeze({
  fires: Object.freeze([]) as readonly InspectorFire[],
});

export class FireClientStore {
  private fires: InspectorFire[] = [];
  private byKey = new Map<string, number>();
  private readonly pub = createSnapshotPublisher<FireClientSnapshot>(
    () => ({ fires: this.fires.slice() }),
    EMPTY_SNAPSHOT,
  );

  /** Insert or overwrite by `(ruleUid, requestId|t)`. */
  upsert(fire: InspectorFire): void {
    const key = dedupKey(fire.ruleUid, fire.requestId, fire.t);
    const existingIdx = this.byKey.get(key);
    if (existingIdx != null) {
      this.fires[existingIdx] = fire;
    } else {
      this.fires.push(fire);
      this.byKey.set(key, this.fires.length - 1);
    }
    this.pub.markDirty();
  }

  clear(): void {
    if (this.fires.length === 0) return;
    this.fires = [];
    this.byKey.clear();
    this.pub.markDirty();
  }

  readonly subscribe = this.pub.subscribe;
  readonly getSnapshot = this.pub.getSnapshot;
}
