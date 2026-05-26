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
 * Reconnect: same 250ms backoff as the lifecycle / page hooks. The
 * engine snapshot is replayed on each connect, so the store CAN clear
 * on `'ready'` without losing data — but engine dedup already makes
 * re-emits idempotent, so we don't bother.
 */

import { type LifelinePort, lifelineTransport } from '@openheaders/core/awareness';
import { hostNavigation } from '@openheaders/core/navigation';
import { type RuleFireWireMessage, ruleFirePortName } from '@openheaders/core/rule-fire-stream';
import { useEffect, useRef, useSyncExternalStore } from 'react';

import { FireClientStore, type FireClientSnapshot } from './fire-client-store';
import type { InspectorFire } from './types';

const RECONNECT_DELAY_MS = 250;

export interface UseFireClientResult {
  readonly snapshot: FireClientSnapshot;
  readonly tabId: number | null;
  readonly store: FireClientStore;
}

export function useFireClient(): UseFireClientResult {
  const storeRef = useRef<FireClientStore | null>(null);
  if (!storeRef.current) storeRef.current = new FireClientStore();
  const store = storeRef.current;

  const tabIdRef = useRef<number | null>(hostNavigation.inspectedTabId());

  useEffect(() => {
    const tabId = tabIdRef.current;
    if (tabId == null) return;

    let activePort: LifelinePort | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;

    const handler = (msg: RuleFireWireMessage): void => {
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
        shadowedBy: update.record.shadowedBy,
        evidence: update.record.evidence,
        ...(update.record.ruleSnapshot ? { ruleSnapshot: update.record.ruleSnapshot } : {}),
      };
      store.upsert(fire);
    };

    const connect = (): void => {
      if (disposed) return;
      let port: LifelinePort;
      try {
        port = lifelineTransport.connect(ruleFirePortName(tabId));
      } catch {
        activePort = null;
        if (disposed) return;
        reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
        return;
      }
      activePort = port;
      port.onMessage<RuleFireWireMessage>(handler);
      port.onDisconnect(() => {
        activePort = null;
        if (disposed) return;
        reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
      });
    };

    connect();

    return () => {
      disposed = true;
      if (reconnectTimer != null) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (activePort) {
        try {
          activePort.disconnect();
        } catch {
          /* already disconnected */
        }
        activePort = null;
      }
    };
  }, [store]);

  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot);

  return { snapshot, tabId: tabIdRef.current, store };
}
