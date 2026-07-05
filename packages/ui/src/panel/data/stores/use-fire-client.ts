/**
 * `useFireClient` — React hook that opens the engine-side rule-fire pipe
 * for the inspected tab and feeds the `FireClientStore`.
 *
 * Pipe shape:
 *   - Port name `oh-fires:<tabId>`.
 *   - First message is a `'ready'` envelope (consumer discards it).
 *   - Subsequent messages are `'fire-update'` envelopes carrying a
 *     `RuleFireUpdate` — engine has already deduped + merged by
 *     `(ruleUid, requestId)` (or `(ruleUid, t)` for scriptable fires),
 *     so the store is a plain upsert/clear bag.
 *
 * Port lifecycle (connect / reconnect / cleanup) is delegated to
 * `useLifelineClient`. Unlike the lifecycle / page hooks, the store is
 * NOT cleared on `'ready'`: engine dedup already makes re-emits
 * idempotent, so a reconnect-driven replay reapplies the same upserts
 * without producing duplicates.
 */

import { type RuleFireWireMessage, ruleFirePortName } from '@openheaders/core/rule-fire-stream';
import { useRef, useSyncExternalStore } from 'react';
import type { InspectorFire } from '../types';
import { useLifelineClient } from '../use-lifeline-client';
import { type FireClientSnapshot, FireClientStore } from './fire-client-store';

export interface UseFireClientResult {
  readonly snapshot: FireClientSnapshot;
  readonly tabId: number | null;
  readonly store: FireClientStore;
}

export function useFireClient(): UseFireClientResult {
  const storeRef = useRef<FireClientStore | null>(null);
  if (!storeRef.current) storeRef.current = new FireClientStore();
  const store = storeRef.current;

  const { tabId } = useLifelineClient<RuleFireWireMessage>({
    portName: ruleFirePortName,
    handler: (msg) => {
      if (msg.kind !== 'fire-update') return;
      const update = msg.update;
      if (update.kind === 'tab-cleared') {
        store.clear();
        return;
      }
      const fire: InspectorFire = {
        ruleUid: update.record.ruleUid,
        t: update.record.t,
        pattern: update.record.pattern,
        authoritative: update.authoritative,
        requestId: update.record.requestId,
        url: update.record.url,
        shadowedBy: update.record.shadowedBy,
        evidence: update.record.evidence,
        resourceType: update.record.resourceType,
        ...(update.record.ruleSnapshot ? { ruleSnapshot: update.record.ruleSnapshot } : {}),
      };
      store.upsert(fire);
    },
  });

  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot);

  return { snapshot, tabId, store };
}
