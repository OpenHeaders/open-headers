import { getPauseMarkers } from '@openheaders/oracle/entity/pause-markers-store';
import { getRules } from '@openheaders/oracle/entity/rule-store';
import { getUnresolvableRuleUids } from '@openheaders/oracle/rule-engine/variables-resolver';
import { isRuleEffective } from '@openheaders/core/utils';
import { get as getSetting } from '@openheaders/ui/workbench/settings/store';
import { tabs } from '@utils/browser-api';
import { updateExtensionBadge } from '../modules/badge-manager';
import { getActiveRulesForTab } from '../modules/request-tracker';
import { getReconnectAttempts, isWebSocketConnected } from '../websocket';

export async function updateBadgeForCurrentTab(): Promise<void> {
  const isConnected = isWebSocketConnected();
  const attempts = getReconnectAttempts();
  const isPaused = getSetting('rulesEngine.paused');

  tabs.query({ active: true, currentWindow: true }, async (tabList: chrome.tabs.Tab[]) => {
    const currentTab = tabList[0];

    const markers = getPauseMarkers();
    const unresolvable = getUnresolvableRuleUids();
    const effectiveRules = getRules().filter((r) => isRuleEffective(r, markers, isPaused) && !unresolvable.has(r.uid));
    const effectiveUids = new Set(effectiveRules.map((r) => r.uid));

    let matchedRuleCount = 0;
    if (currentTab?.id != null && currentTab.url) {
      const { activeRules } = getActiveRulesForTab(currentTab.id, currentTab.url);
      for (const rule of activeRules) {
        if (!effectiveUids.has(rule.id)) continue;
        if (rule.verdict === 'firing' || rule.verdict === 'silent' || rule.verdict === 'page') {
          matchedRuleCount++;
        }
      }
    }
    await updateExtensionBadge({
      connected: isConnected,
      isPaused,
      reconnectAttempts: attempts,
      matchedRuleCount,
      configuredRuleCount: effectiveRules.length,
    });
  });
}

export const debouncedUpdateBadge = (() => {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void updateBadgeForCurrentTab();
    }, 100);
  };
})();
