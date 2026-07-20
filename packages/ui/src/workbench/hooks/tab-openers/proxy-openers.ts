/**
 * Proxy tab openers — editor tabs minted from the Proxy tool window's
 * capture list (desktop-only; the window itself is gated on the
 * `proxyCapture` capability, so these openers never fire elsewhere).
 */

import { useCallback } from 'react';
import type { TabOpenerContext, UseTabOpenersApi } from './shared';

export type ProxyOpeners = Pick<UseTabOpenersApi, 'openProxyRequestInspect'>;

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

  return { openProxyRequestInspect };
}
