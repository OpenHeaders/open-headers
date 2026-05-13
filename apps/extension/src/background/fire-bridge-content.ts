/**
 * Fire bridge (ISOLATED world) — always-on listener for rule fire events.
 *
 * Registered as a static content script via manifest.json with matches:["<all_urls>"]
 * at document_start. Runs on every page the extension has host access to,
 * whether or not any consumer is currently interested in the page.
 *
 * Listens for `window.postMessage` payloads tagged with `__ohFire: true`
 * from MAIN-world generated scripts (delay/body/mock/header-merge) and
 * forwards them to the background via the shared bridge as `tabFire`
 * messages. The background drops fires on the floor for tabs that
 * aren't being tracked, so the overhead on untracked tabs is one message
 * listener + one cheap Map lookup per fire.
 *
 * Why postMessage and not CustomEvent: Chrome MV3 content scripts run in
 * isolated JS realms. `CustomEvent.detail` is an opaque cross-realm JS
 * object — even when the event bubbles through the shared DOM, the detail
 * property is not accessible from the other world (it comes through as
 * null or throws). `window.postMessage` is the canonical MAIN↔ISOLATED
 * channel in MV3 — it performs structured cloning of the payload, which
 * works across realms.
 */

import { call } from '@utils/bridge';

interface OhFirePayload {
  __ohFire: true;
  ruleUid: string;
  url: string;
  kind: string;
  t: number;
}

(() => {
  window.addEventListener('message', (ev: MessageEvent) => {
    if (ev.source !== window) return;
    const data = ev.data as OhFirePayload | null | undefined;
    if (!data || data.__ohFire !== true) return;
    // Fire-and-forget: the background handler always resolves with
    // `{ success: true }`. The `catch` swallows SW-evicted / context-
    // invalidated errors that surface through `BridgeError`.
    call('tabFire', {
      ruleUid: data.ruleUid,
      url: data.url,
      t: data.t,
    }).catch(() => {
      /* background service worker evicted or reloading — ignore */
    });
  });
})();
