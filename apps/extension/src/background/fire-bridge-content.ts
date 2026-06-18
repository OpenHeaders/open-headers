/**
 * Fire bridge (ISOLATED world) — always-on listener for rule fire events.
 *
 * Registered as a static content script via manifest.json with matches:["<all_urls>"]
 * at document_start. Runs on every page the extension has host access to,
 * whether or not any consumer is currently interested in the page.
 *
 * Listens for `window.postMessage` payloads tagged with `__ohFire: true`
 * from MAIN-world generated scripts (delay/body/response/header-merge) and
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

import type { InspectorRequestSnapshot, InspectorResponseSnapshot } from '@openheaders/core/request-lifecycle';
import { call } from '@utils/bridge';

interface OhFirePayload {
  __ohFire: true;
  ruleUid: string;
  url: string;
  kind: string;
  t: number;
}

interface OhResponseCapturePayload {
  __ohResponseCapture: true;
  ruleUid: string;
  url: string;
  method: string;
  startedAt: number;
  served: InspectorResponseSnapshot;
  original?: InspectorResponseSnapshot;
}

interface OhRequestCapturePayload {
  __ohRequestCapture: true;
  ruleUid: string;
  url: string;
  method: string;
  startedAt: number;
  sent: InspectorRequestSnapshot;
  original?: InspectorRequestSnapshot;
}

(() => {
  window.addEventListener('message', (ev: MessageEvent) => {
    if (ev.source !== window) return;
    const data = ev.data as (
      | OhFirePayload
      | OhResponseCapturePayload
      | OhRequestCapturePayload
      | null
      | undefined
    ) & {
      __ohFire?: true;
      __ohResponseCapture?: true;
      __ohRequestCapture?: true;
    };
    if (!data) return;
    // Fire-and-forget for both bridges: the background handlers resolve with
    // `{ success: true }`; the `catch` swallows SW-evicted / context-
    // invalidated errors that surface through `BridgeError`.
    if (data.__ohFire === true) {
      const fire = data as OhFirePayload;
      call('tabFire', { ruleUid: fire.ruleUid, url: fire.url, t: fire.t }).catch(() => {
        /* background service worker evicted or reloading — ignore */
      });
      return;
    }
    if (data.__ohResponseCapture === true) {
      const cap = data as OhResponseCapturePayload;
      call('tabResponseOverride', {
        ruleUid: cap.ruleUid,
        url: cap.url,
        method: cap.method,
        startedAt: cap.startedAt,
        served: cap.served,
        ...(cap.original !== undefined ? { original: cap.original } : {}),
      }).catch(() => {
        /* background service worker evicted or reloading — ignore */
      });
      return;
    }
    if (data.__ohRequestCapture === true) {
      const cap = data as OhRequestCapturePayload;
      call('tabRequestOverride', {
        ruleUid: cap.ruleUid,
        url: cap.url,
        method: cap.method,
        startedAt: cap.startedAt,
        sent: cap.sent,
        ...(cap.original !== undefined ? { original: cap.original } : {}),
      }).catch(() => {
        /* background service worker evicted or reloading — ignore */
      });
    }
  });
})();
