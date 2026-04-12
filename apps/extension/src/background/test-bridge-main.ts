/**
 * Test bridge (MAIN world) — sets window.__OH_TEST__ before any page script runs.
 *
 * Registered by the test-runner via `chrome.scripting.registerContentScripts`
 * with `world: 'MAIN'` and `runAt: 'document_start'` for the duration of a
 * test session, scoped to the target URL's origin.
 *
 * Runs in the page's actual JS context (not an isolated world), so it avoids
 * Content-Security-Policy restrictions that would otherwise block inline
 * script injection from the ISOLATED-world bridge.
 *
 * All the generated delay/body/mock/header-merge scripts check
 * `window.__OH_TEST__` at request time to decide whether to emit the
 * `oh:test:fired` CustomEvent that the ISOLATED bridge forwards to background.
 */

(() => {
  (window as unknown as { __OH_TEST__: boolean }).__OH_TEST__ = true;
})();
