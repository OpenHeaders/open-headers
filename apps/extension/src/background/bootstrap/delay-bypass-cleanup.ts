import { forgetDelayBypassForTab, resolveDelayBypass } from '../dnr-manager';
import { forgetCacheBypassForTab } from '../modules/cache-bypass';
import { forgetNetworkConditionsForTab } from '../modules/network-conditions';
import { forgetTabOverridesForTab } from '../modules/tab-overrides';

declare const browser: typeof chrome | undefined;

export function setupDelayBypassCleanup(): void {
  const api = typeof browser !== 'undefined' ? browser : chrome;

  if (api.webNavigation?.onCommitted) {
    api.webNavigation.onCommitted.addListener(
      (details: chrome.webNavigation.WebNavigationTransitionCallbackDetails) => {
        if (details.frameId !== 0) return;
        if (details.url.startsWith(api.runtime.getURL('delay.html'))) return;
        resolveDelayBypass(details.tabId, details.url);
      },
    );
  }

  if (api.webNavigation?.onErrorOccurred) {
    api.webNavigation.onErrorOccurred.addListener((details: { tabId: number; frameId: number; url: string }) => {
      if (details.frameId !== 0) return;
      resolveDelayBypass(details.tabId, details.url);
    });
  }

  if (api.tabs?.onRemoved) {
    api.tabs.onRemoved.addListener((tabId: number) => {
      forgetDelayBypassForTab(tabId);
      void forgetCacheBypassForTab(tabId);
      forgetNetworkConditionsForTab(tabId);
      forgetTabOverridesForTab(tabId);
    });
  }
}
