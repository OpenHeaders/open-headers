/**
 * Extension bridge — one module owns every cross-context message.
 *
 * Why: 21 files used to call `runtime.sendMessage` / `runtime.connect`
 * directly with handwritten lastError handling, inline response casts,
 * and ad-hoc port lifecycles. Consolidating them gives:
 *
 *   - type-safe request/response (contract-driven, no `any` casts)
 *   - single lastError surface (`BridgeError`, never a dropped reject)
 *   - broadcast + subscribe with compile-time message-type filtering
 *   - one place to harden SW wake/retry behavior in the future
 *
 * Public API:
 *
 *   call(type, payload)            → Promise<res>  typed RPC to the SW
 *   tabCall(tabId, type, payload)  → Promise<res>  typed message to a content script
 *   receive(type, handler)         → () => void    content-script listener for tabCall
 *   broadcast(type, body)          → void          SW-side fire-and-forget push
 *   subscribe(type, fn)            → () => void    typed listener for broadcasts
 *   presence(name)                 → () => void    presence port for popup open/close
 *
 * See ./contracts.ts for the message-type registry.
 */

import { getBrowserAPI } from '@/types/browser';
// Import `runtime` from the content-safe module — NOT `../browser-api`.
// The fire-bridge + workflow-recorder content scripts pull this module
// in transitively, and `browser-api.ts` has background-only top-level
// reads (tabs event hooks, dnr, alarms) that crash in a content-script
// realm where those Chrome namespaces are undefined.
import { runtime } from '../browser-runtime';
import { logger } from '../logger';
import {
  type BridgeBroadcastPayload,
  type BridgeBroadcastType,
  BridgeError,
  type BridgeRpcRequest,
  type BridgeRpcResponse,
  type BridgeRpcType,
  type BridgeTabRequest,
  type BridgeTabResponse,
  type BridgeTabType,
} from './contracts';

/**
 * Type the union of all broadcast shapes so the runtime.onMessage listener
 * can narrow by the discriminated `type` field at the use site.
 */
type BroadcastEnvelope = {
  [K in BridgeBroadcastType]: { type: K } & BridgeBroadcastPayload<K>;
}[BridgeBroadcastType];

/**
 * Send a typed RPC to the background service worker and resolve with the
 * typed response. Rejects with `BridgeError` when Chrome surfaces a
 * `lastError` — never silently resolves to `undefined` on error.
 *
 * `runtime.sendMessage` auto-wakes a sleeping MV3 service worker, so there
 * is no queueing/retry layer here: the background script's top-level
 * `onMessage` listener registers synchronously on wake, and Chrome dispatches
 * the queued message into it. If `lastError` *does* fire, it means something
 * structurally wrong (no listener, context invalidated) and a silent retry
 * would hide the bug.
 */
export function call<K extends BridgeRpcType>(
  type: K,
  ...args: BridgeRpcRequest<K> extends Record<string, never> ? [] : [payload: BridgeRpcRequest<K>]
): Promise<BridgeRpcResponse<K>> {
  const payload = args[0] ?? ({} as BridgeRpcRequest<K>);
  const message = { type, ...payload };
  return new Promise((resolve, reject) => {
    runtime.sendMessage(message, (response: unknown) => {
      const api = getBrowserAPI();
      if (api.runtime.lastError) {
        reject(new BridgeError(type, api.runtime.lastError.message ?? 'unknown error'));
        return;
      }
      resolve(response as BridgeRpcResponse<K>);
    });
  });
}

/**
 * Send a typed message DIRECTLY to a content script in a specific tab
 * and resolve with its typed response. Rejects with `BridgeError` when
 * Chrome surfaces a `lastError` — that covers "receiving end does not
 * exist" (no content script injected / listener not registered), "tab
 * was closed", "context invalidated", and any other underlying failure.
 *
 * Unlike `call`, there is no single global handler on the other side —
 * the receiving content script must have called `receive(type, handler)`
 * to opt in for this message type. Chrome routes the message to every
 * content script in the tab; the first one whose listener calls
 * `sendResponse` wins and the rest are ignored.
 *
 * Callers who expect the "no content script" case (e.g. restricted URLs,
 * navigation races) should catch `BridgeError` and treat it as advisory
 * rather than propagating the error.
 */
export function tabCall<K extends BridgeTabType>(
  tabId: number,
  type: K,
  ...args: BridgeTabRequest<K> extends Record<string, never> ? [] : [payload: BridgeTabRequest<K>]
): Promise<BridgeTabResponse<K>> {
  const payload = args[0] ?? ({} as BridgeTabRequest<K>);
  const message = { type, ...payload };
  return new Promise((resolve, reject) => {
    const api = getBrowserAPI();
    api.tabs.sendMessage(tabId, message, (response: unknown) => {
      if (api.runtime.lastError) {
        reject(new BridgeError(type, api.runtime.lastError.message ?? 'unknown error'));
        return;
      }
      resolve(response as BridgeTabResponse<K>);
    });
  });
}

/**
 * Content-script-side listener for typed `tabCall` messages. Runs
 * `handler` when the incoming message's `type` matches `subscribedType`,
 * and relays the return value (sync or async) back to the caller as the
 * response. Returns an unsubscribe function.
 *
 * Only registers a listener for the one type it cares about — multiple
 * `receive` calls in the same content script each install their own
 * filter, which is O(listeners) per message but negligible at the scale
 * we use it (under ten types per tab).
 */
export function receive<K extends BridgeTabType>(
  subscribedType: K,
  handler: (payload: BridgeTabRequest<K>) => BridgeTabResponse<K> | Promise<BridgeTabResponse<K>>,
): () => void {
  const listener = (
    message: unknown,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void,
  ): boolean => {
    if (!message || typeof message !== 'object') return false;
    const envelope = message as { type?: unknown };
    if (envelope.type !== subscribedType) return false;
    let result: BridgeTabResponse<K> | Promise<BridgeTabResponse<K>>;
    try {
      result = handler(envelope as unknown as BridgeTabRequest<K>);
    } catch (err) {
      logger.info('Bridge', `receive(${subscribedType}) handler threw:`, (err as Error).message);
      sendResponse(undefined);
      return false;
    }
    if (result instanceof Promise) {
      result
        .then((value) => sendResponse(value))
        .catch((err: Error) => {
          logger.info('Bridge', `receive(${subscribedType}) handler rejected:`, err.message);
          sendResponse(undefined);
        });
      // Return true to keep the message channel open for the async
      // sendResponse — required by chrome.runtime.onMessage contract.
      return true;
    }
    sendResponse(result);
    return false;
  };
  runtime.onMessage.addListener(listener);
  return () => runtime.onMessage.removeListener(listener);
}

/**
 * Fire-and-forget broadcast from the background to all open extension
 * pages (popup, workspace tabs). Swallows "no listeners" — that is the
 * expected case when nothing is open.
 *
 * Called only from the background service worker; popup/workspace code
 * should use `call` for SW communication instead.
 */
export function broadcast<K extends BridgeBroadcastType>(
  type: K,
  ...args: BridgeBroadcastPayload<K> extends Record<string, never> ? [] : [payload: BridgeBroadcastPayload<K>]
): void {
  const payload = args[0] ?? ({} as BridgeBroadcastPayload<K>);
  const api = getBrowserAPI();
  // `type` MUST appear after the spread so the bridge-level
  // discriminator wins over any field with the same name embedded in
  // `payload`. The `SyncBroadcastEvent` protocol carries its own
  // `type: 'oh.sync.broadcast'` for code that switches on a wire union
  // (`SyncBridgeMessage`), and prior to this fix that protocol type
  // was overwriting `'syncBroadcast'` after the spread — every
  // subscriber filters on the bridge type, so syncBroadcast events
  // were silently dropped at the type-filter check. The renderer
  // mirrors only ever saw the boot-time snapshot; entities created
  // during the session never reached the mirror, which surfaced as
  // "Rule was deleted from another tab" on the first save of any
  // newly-created rule.
  const message = { ...payload, type };
  try {
    // Go directly through the raw runtime API — the cross-browser wrapper
    // in `utils/browser-api` logs Firefox promise rejections via
    // `logger.info`, which would spam every broadcast when no pages are
    // open. For broadcasts we want true silence: "no receiver" is the
    // normal case, not an error.
    const result = api.runtime.sendMessage(message) as Promise<unknown> | undefined;
    if (result && typeof (result as Promise<unknown>).catch === 'function') {
      (result as Promise<unknown>).catch(() => {
        /* no listeners — ignore */
      });
    }
    // Chrome's callback-shaped sendMessage will set lastError if nobody
    // listens; reading it here suppresses the "Unchecked runtime.lastError"
    // console noise.
    void api.runtime.lastError;
  } catch {
    // Context invalidated (e.g. during extension reload) — nothing to do.
  }
}

/**
 * Subscribe to a broadcast message. The handler fires only for messages
 * whose `type` matches `subscribedType`, and receives a payload narrowed
 * to that type's contract. Returns an unsubscribe function.
 */
export function subscribe<K extends BridgeBroadcastType>(
  subscribedType: K,
  handler: (payload: BridgeBroadcastPayload<K>) => void,
): () => void {
  const listener = (
    message: unknown,
    _sender: chrome.runtime.MessageSender,
    _sendResponse: (response?: unknown) => void,
  ): void => {
    if (!message || typeof message !== 'object') return;
    const envelope = message as { type?: unknown };
    if (envelope.type !== subscribedType) return;
    handler(envelope as unknown as BridgeBroadcastPayload<K>);
  };
  runtime.onMessage.addListener(listener);
  return () => runtime.onMessage.removeListener(listener);
}

/**
 * Open a presence port to the background service worker. Used by the popup
 * to announce open/close via `onConnect` / `onDisconnect` so the background's
 * tab-listeners can refresh the badge when the popup closes.
 *
 * Returns a disposer that cleanly disconnects. Errors during connect are
 * logged (the SW may be in an invalid state) but never throw — presence
 * is advisory, not required for correctness.
 */
export function presence(name: string): () => void {
  let port: chrome.runtime.Port | null = null;
  try {
    port = runtime.connect({ name });
    port.onDisconnect.addListener(() => {
      const api = getBrowserAPI();
      if (api.runtime.lastError) {
        logger.info('Bridge', `presence(${name}) disconnected:`, api.runtime.lastError.message);
      }
    });
  } catch (error) {
    logger.info('Bridge', `presence(${name}) connect failed:`, (error as Error).message);
  }
  return () => {
    if (!port) return;
    try {
      port.disconnect();
    } catch {
      // already disconnected — nothing to do
    }
    port = null;
  };
}

export type { BridgeMessageType, LiveWorkflowRunSnapshot } from './contracts';
export { BridgeError } from './contracts';
export type {
  BridgeBroadcastPayload,
  BridgeBroadcastType,
  BridgeRpcRequest,
  BridgeRpcResponse,
  BridgeRpcType,
  BridgeTabRequest,
  BridgeTabResponse,
  BridgeTabType,
  BroadcastEnvelope,
};
