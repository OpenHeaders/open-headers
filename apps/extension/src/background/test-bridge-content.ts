/**
 * Test bridge (ISOLATED world) — listens for `oh:test:fired` CustomEvents on
 * window and forwards each one to the background test-runner via
 * `chrome.runtime.sendMessage`.
 *
 * Setting `window.__OH_TEST__` is handled by the companion MAIN-world bridge
 * (`test-bridge-main.ts`), which runs in the page's actual JS context and is
 * not subject to Content-Security-Policy restrictions that would otherwise
 * block inline script injection from ISOLATED.
 *
 * Registered by the test-runner via `chrome.scripting.registerContentScripts`
 * scoped to the target URL's origin, then unregistered when the session ends.
 */

(() => {
  window.addEventListener('oh:test:fired', (ev: Event) => {
    const detail = (ev as CustomEvent).detail as {
      ruleUid: string;
      url: string;
      kind: string;
      t: number;
    };
    try {
      chrome.runtime.sendMessage({
        type: 'testScriptableFired',
        ruleUid: detail.ruleUid,
        url: detail.url,
        kind: detail.kind,
        t: detail.t,
      });
    } catch {
      // Background may have unregistered the bridge — ignore.
    }
  });
})();
