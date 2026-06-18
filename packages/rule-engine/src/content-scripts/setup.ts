/**
 * Interceptor setup / reset + the page-invisible fire channel name.
 *
 * `oh-setup` captures the page's pristine fetch/XHR/WebSocket/EventSource once,
 * at document_start before any interceptor patches them, AND installs the one
 * fire dispatcher (`window.__ohOrig.fire`) every wrapper reports through — it
 * picks the private Runtime binding when present (a CDP-attached tab), else
 * `window.postMessage`. `oh-reset` restores the pristine references so a rule
 * edit/delete goes live without a page reload (the background re-injects the
 * current set fresh over clean originals).
 */

import type { FuncInjection } from '../builders/types';
import type { OhOriginals, OhRequestCapture, OhResponseCapture } from './types';

/**
 * Name of the page-invisible fire channel. On a CDP-attached (in-scope) tab the
 * SW installs a global of this name via `Runtime.addBinding`; calling it emits a
 * `Runtime.bindingCalled` event straight to the debugger, bypassing the DOM. The
 * SW (`addBinding`) and `oh-setup` (which feature-detects the global) share this
 * one constant. Un-armed tabs have no such global, so the dispatcher falls back
 * to `window.postMessage`. Short + unobtrusive; a fixed name is page-guessable
 * (a page could fabricate a fire) but cannot OBSERVE a real one — a randomized
 * per-attach nonce is the deferred fabrication-hardening follow-up.
 */
export const OH_BINDING = '__ohb';

/** Capture the page's pristine fetch/XHR/WebSocket/EventSource once, at
 *  document_start, before any interceptor patches them, and install the fire
 *  dispatcher every wrapper reports through. */
export function buildSetupInjection(): FuncInjection {
  return { kind: 'func', func: ohSetupFunc as unknown as (cfg: never) => void, args: [OH_BINDING] };
}

function ohSetupFunc(bindingName: string): void {
  const w = window as unknown as { __ohOrig?: OhOriginals } & Record<string, unknown>;
  if (w.__ohOrig) return; // pristine originals already captured this page
  // Capture the private fire binding the SW installed on a CDP-attached tab
  // (absent on un-armed tabs). Held in this closure — NOT re-read from
  // window[bindingName] at fire time — so a real fire still reaches the
  // debugger even if the page later overwrites the global. The page can see
  // the global exists, but bindingCalled never touches the DOM.
  const bound = w[bindingName];
  const fireBinding = typeof bound === 'function' ? (bound as unknown as (payload: string) => void) : undefined;
  w.__ohOrig = {
    fetch: window.fetch,
    xhrOpen: XMLHttpRequest.prototype.open,
    xhrSend: XMLHttpRequest.prototype.send,
    xhrSetHeader: XMLHttpRequest.prototype.setRequestHeader,
    WebSocket: window.WebSocket,
    EventSource: window.EventSource,
    fire(ruleUid: string, url: string, kind: string): void {
      try {
        if (fireBinding) {
          fireBinding(JSON.stringify({ ruleUid, url, kind, t: Date.now() }));
          return;
        }
        window.postMessage({ __ohFire: true, ruleUid, url, kind, t: Date.now() }, '*');
      } catch {
        /* swallow */
      }
    },
    captureResponse(capture: OhResponseCapture): void {
      // Standard-mode only — the fire bridge forwards this to the heuristic
      // correlator. (A CDP-armed tab suppresses injection and captures via the
      // Fetch interceptor instead, so this never double-reports.)
      try {
        window.postMessage({ __ohResponseCapture: true, ...capture }, '*');
      } catch {
        /* swallow */
      }
    },
    captureRequest(capture: OhRequestCapture): void {
      try {
        window.postMessage({ __ohRequestCapture: true, ...capture }, '*');
      } catch {
        /* swallow */
      }
    },
  };
}

/** Restore the pristine references, dropping every chained OH patch.
 *  Re-injecting the current interceptor set afterwards rebuilds a clean
 *  chain — this is how a rule edit goes live without a reload. */
export function buildResetInjection(): FuncInjection {
  return { kind: 'func', func: ohResetFunc as unknown as (cfg: never) => void, args: [null] };
}

function ohResetFunc(): void {
  const w = window as unknown as { __ohOrig?: OhOriginals };
  const o = w.__ohOrig;
  if (!o) return;
  window.fetch = o.fetch;
  XMLHttpRequest.prototype.open = o.xhrOpen;
  XMLHttpRequest.prototype.send = o.xhrSend;
  XMLHttpRequest.prototype.setRequestHeader = o.xhrSetHeader;
  window.WebSocket = o.WebSocket;
  window.EventSource = o.EventSource;
}
