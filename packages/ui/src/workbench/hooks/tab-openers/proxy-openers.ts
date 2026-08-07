/**
 * Capture-inspect tab openers — editor tabs minted from the Proxy and
 * Live Network tool windows' capture lists (desktop-only; both windows
 * are capability-gated, so these openers never fire elsewhere).
 */

import { useCallback } from 'react';
import { storageDocInnerId } from '../../data/storage-doc-ref';
import type { LiveStorageDocRef } from '../../types';
import type { TabOpenerContext, UseTabOpenersApi } from './shared';

export type ProxyOpeners = Pick<
  UseTabOpenersApi,
  | 'openProxyRequestInspect'
  | 'openLiveNetworkRequestInspect'
  | 'openLiveStorageDocInspect'
  | 'openSessionReplayRequestInspect'
>;

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

  const openLiveStorageDocInspect = useCallback(
    (nodeId: string, tabId: number, doc: LiveStorageDocRef, label: string) => {
      const id = `live-storage-${tabId}@${nodeId}-${storageDocInnerId(doc)}`;
      if (allTabs.some((t) => t.id === id)) {
        switchTab(id);
        return;
      }
      addTab({
        id,
        label,
        ruleType: '',
        dirty: false,
        mode: 'live-storage-doc-inspect',
        liveStorageNodeId: nodeId,
        liveStorageTabId: tabId,
        liveStorageDoc: doc,
      });
    },
    [allTabs, addTab, switchTab],
  );

  const openSessionReplayRequestInspect = useCallback(
    (sessionId: string, partitionTabId: number, requestId: string, label: string) => {
      const id = `session-replay-req-${sessionId}-${requestId}`;
      if (allTabs.some((t) => t.id === id)) {
        switchTab(id);
        return;
      }
      addTab({
        id,
        label,
        ruleType: '',
        dirty: false,
        mode: 'session-replay-request-inspect',
        sessionReplayId: sessionId,
        sessionReplayTabId: partitionTabId,
        sessionReplayRequestId: requestId,
      });
    },
    [allTabs, addTab, switchTab],
  );

  return {
    openProxyRequestInspect,
    openLiveNetworkRequestInspect,
    openLiveStorageDocInspect,
    openSessionReplayRequestInspect,
  };
}
