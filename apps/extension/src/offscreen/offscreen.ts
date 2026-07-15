/**
 * Offscreen document broker — bridges the SW ⇄ sandboxed iframe.
 *
 * The SW cannot spawn an iframe, so we hoist one into an offscreen
 * document and broker `chrome.runtime` messages into the iframe via
 * `window.postMessage`. The iframe itself is declared in
 * `manifest.sandbox.pages` so it runs under a unique opaque origin
 * with `'unsafe-eval'` permitted — that's what lets user-provided
 * pre-request / test scripts compile via `new Function(...)`.
 *
 * Lifecycle:
 *   • Offscreen doc is created on demand by `offscreen-host.ts` in
 *     the SW and torn down after an idle timer.
 *   • Inside this doc we hold the sandbox iframe for our whole
 *     lifetime — spawning once is enough because scripts run in
 *     fresh `new Function` scopes each time.
 *
 * Message tags on the `chrome.runtime` boundary:
 *   • `{ target: 'offscreen', type: 'script.execute', ... }` —
 *     SW asks us to run a script.
 *   • `{ target: 'offscreen', type: 'wire.fetch', ... }` —
 *     SW asks us to run a wire fetch in this document context (the
 *     certificate-exception retry — see shared/wire-fetch).
 *   • `{ target: 'background', type: 'script.host-request', ... }` —
 *     sandbox asked for an `oh.*` operation we must bounce to the SW.
 *
 * The `target` field is the discriminator so the SW's general message
 * handler can ignore our host-request traffic (and vice versa).
 */

import type {
  ScriptExecutionRequest,
  ScriptExecutionResult,
  ScriptHostRequest,
  ScriptHostResponse,
} from '@openheaders/core/scripts';
import { executeWirePlan } from '@/shared/wire-fetch/execute-plan';
import type { WirePlan } from '@/shared/wire-fetch/plan';

type PendingExec = (result: ScriptExecutionResult) => void;
const pendingExecs = new Map<string, PendingExec>();
let iframeReady: Promise<void>;
let iframeReadyResolve: (() => void) | null = null;

// Find the sandbox iframe by its src path instead of by id so the
// broker keeps working if the id attribute is renamed.
const iframe = document.querySelector<HTMLIFrameElement>('iframe[src$="sandbox.html"]');
if (!iframe) {
  // The HTML never shipped its iframe — hard fail; the SW's runScript
  // caller will time out on a missing reply.
  throw new Error('offscreen: sandbox iframe element not found');
}

iframeReady = new Promise<void>((resolve) => {
  iframeReadyResolve = resolve;
});

// Sandbox → offscreen messages (results + oh.* host requests).
window.addEventListener('message', (ev) => {
  if (ev.source !== iframe.contentWindow) return;
  const data = ev.data as
    | { type: 'sandbox.ready' }
    | { type: 'script.result'; result: ScriptExecutionResult }
    | { type: 'script.host-request'; request: ScriptHostRequest }
    | undefined;
  if (!data || typeof data !== 'object') return;

  if (data.type === 'sandbox.ready') {
    iframeReadyResolve?.();
    iframeReadyResolve = null;
    return;
  }

  if (data.type === 'script.result') {
    const resolver = pendingExecs.get(data.result.executionId);
    if (resolver) {
      pendingExecs.delete(data.result.executionId);
      resolver(data.result);
    }
    return;
  }

  if (data.type === 'script.host-request') {
    // Forward to SW — it handles oh.variables / oh.vault / oh.sendRequest.
    chrome.runtime
      .sendMessage({
        target: 'background',
        type: 'script.host-request',
        request: data.request,
      })
      .then((response: ScriptHostResponse) => {
        iframe.contentWindow?.postMessage({ type: 'script.host-response', response }, '*');
      })
      .catch((err: Error) => {
        const failure: ScriptHostResponse = {
          executionId: data.request.executionId,
          rpcId: data.request.rpcId,
          ok: false,
          error: `host RPC transport failed: ${err.message}`,
        };
        iframe.contentWindow?.postMessage({ type: 'script.host-response', response: failure }, '*');
      });
  }
});

// SW → offscreen messages (execute + teardown).
chrome.runtime.onMessage.addListener(
  (message: unknown, _sender: chrome.runtime.MessageSender, sendResponse: (response?: unknown) => void) => {
    const msg = message as {
      target?: string;
      type?: string;
      request?: ScriptExecutionRequest;
      plan?: WirePlan;
    } | null;
    if (!msg || msg.target !== 'offscreen') return;

    if (msg.type === 'script.execute' && msg.request) {
      const request = msg.request;
      void (async () => {
        try {
          await iframeReady;
        } catch {
          sendResponse(timeoutResult(request, 'iframe never reported ready'));
          return;
        }
        const resultPromise = new Promise<ScriptExecutionResult>((resolve) => {
          pendingExecs.set(request.executionId, resolve);
        });
        iframe.contentWindow?.postMessage({ type: 'script.execute', request }, '*');
        const result = await resultPromise;
        sendResponse(result);
      })();
      return true; // async reply
    }

    if (msg.type === 'wire.fetch' && msg.plan) {
      // Certificate-retry wire fetch — runs in THIS document context
      // (not the sandbox iframe) because the whole point is the page
      // context: Chromium honors user-accepted certificate exceptions
      // for document-associated requests only, never for SW fetches.
      // See shared/wire-fetch/execute-plan.ts.
      void executeWirePlan(msg.plan).then(sendResponse);
      return true; // async reply
    }

    if (msg.type === 'script.ping') {
      sendResponse({ ok: true });
      return false;
    }

    return undefined;
  },
);

function timeoutResult(req: ScriptExecutionRequest, reason: string): ScriptExecutionResult {
  return {
    executionId: req.executionId,
    succeeded: false,
    error: { name: 'SandboxInitError', message: reason },
    assertions: [],
    consoleLog: [],
    durationMs: 0,
  };
}
