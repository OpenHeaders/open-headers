/**
 * Capture-inspect tab openers — editor tabs minted from the Proxy and
 * Live Network tool windows' capture lists (desktop-only; both windows
 * are capability-gated, so these openers never fire elsewhere).
 */

import { useCallback } from 'react';
import type { TabOpenerContext, UseTabOpenersApi } from './shared';

export type ProxyOpeners = Pick<UseTabOpenersApi, 'openProxyRequestInspect' | 'openLiveNetworkRequestInspect'>;

export function useProxyOpeners({ allTabs, addTab, switchTab }: TabOpenerContext): ProxyOpeners {
  const openProxyRequestInspect = useCallback(
    (requestId: string, label: string) => {
      const id = `proxy-req-${requestId}`;
      if (allTabs.some((t) => t.id === id)) {
        switchTab(id);
        return;
      }
      addTab({
        id,
        label,
        ruleType: '',
        dirty: false,
        mode: 'proxy-request-inspect',
        proxyRequestId: requestId,
      });
    },
    [allTabs, addTab, switchTab],
  );

  const openLiveNetworkRequestInspect = useCallback(
    (nodeId: string, tabId: number, requestId: string, label: string) => {
      const id = `live-net-req-${tabId}@${nodeId}-${requestId}`;
      if (allTabs.some((t) => t.id === id)) {
        switchTab(id);
        return;
      }
      addTab({
        id,
        label,
        ruleType: '',
        dirty: false,
        mode: 'live-network-request-inspect',
        liveNetworkNodeId: nodeId,
        liveNetworkTabId: tabId,
        liveNetworkRequestId: requestId,
      });
    },
    [allTabs, addTab, switchTab],
  );

  return { openProxyRequestInspect, openLiveNetworkRequestInspect };
}
