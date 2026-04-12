/**
 * Test bridge — ISOLATED-world content script programmatically registered
 * by the test-runner for the duration of a test session.
 *
 * Two jobs:
 *
 *  1. At document_start, set window.__OH_TEST__ = true in the MAIN world so
 *     the generated delay/body/mock/inject scripts (which check that flag)
 *     start dispatching oh:test:fired CustomEvents.
 *
 *  2. Listen for oh:test:fired on window and forward each event to the
 *     background test-runner via chrome.runtime.sendMessage.
 *
 * Runs only on the test tab — registered via chrome.scripting.registerContentScripts
 * with an origin matching the test URL, and unregistered when the session ends.
 */

(() => {
  const script = document.createElement('script');
  script.textContent = 'window.__OH_TEST__ = true;';
  (document.head || document.documentElement).appendChild(script);
  script.remove();

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
