/**
 * `useFireClient` — React hook that opens a fire-only reader on the
 * legacy `devtools-inspector:<tabId>` port and feeds the
 * `FireClientStore`. Transitional (Q3=B): replaced by a dedicated
 * engine-side `RuleFireHub` + `oh-fires:<tabId>` port in its own
 * session.
 *
 * Filters to the `fire` variant only — every other
 * `InspectorPortMessage` variant is now owned by the lifecycle /
 * page-stream pipes and is ignored here. Once the legacy port carries
 * only fires, retiring it is a one-shot delete.
 *
 * Reconnect: same 250ms backoff as the lifecycle / page hooks. The
 * legacy port's "ready" envelope is ignored — fires accumulate
 * idempotently via the store's dedup, so replay-after-reconnect
 * cannot duplicate; we don't need to clear on `ready`.
 */

import { type LifelinePort, lifelineTransport } from '@openheaders/core/awareness';
import { hostNavigation } from '@openheaders/core/navigation';
import type { InspectorPortMessage } from '@openheaders/core/types';
import { useEffect, useRef, useSyncExternalStore } from 'react';

import { FireClientStore, type FireClientSnapshot } from './fire-client-store';
import type { InspectorFire } from './types';

const RECONNECT_DELAY_MS = 250;
const LEGACY_PORT_PREFIX = 'devtools-inspector:';

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

    const handler = (msg: InspectorPortMessage): void => {
      if (msg.type !== 'fire') return;
      const fire: InspectorFire = {
        ruleUid: msg.record.ruleUid,
        t: msg.record.t,
        pattern: msg.record.pattern,
        authoritative: msg.authoritative,
        requestId: msg.record.requestId,
        shadowedBy: msg.record.shadowedBy,
        evidence: msg.record.evidence,
        ...(msg.record.ruleSnapshot ? { ruleSnapshot: msg.record.ruleSnapshot } : {}),
      };
      store.ingest(fire);
    };

    const connect = (): void => {
      if (disposed) return;
      let port: LifelinePort;
      try {
        port = lifelineTransport.connect(`${LEGACY_PORT_PREFIX}${tabId}`);
      } catch {
        activePort = null;
        if (disposed) return;
        reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
        return;
      }
      activePort = port;
      port.onMessage<InspectorPortMessage>(handler);
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
