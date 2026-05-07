/**
 * Content-safe cross-browser `runtime` wrapper.
 *
 * Extracted from `browser-api.ts` so modules that run in content-script
 * contexts (which do not have `chrome.tabs`, `chrome.alarms`,
 * `chrome.declarativeNetRequest`, etc.) can import the runtime API
 * without evaluating the background-only surface.
 *
 * Rule: nothing at module top-level in this file may read properties
 * off a background-only Chrome namespace. The only namespaces a content
 * script is guaranteed to see are `chrome.runtime` and `chrome.storage`;
 * every other wrapper stays in `browser-api.ts`.
 *
 * `browser-api.ts` re-exports `runtime` + `isFirefox` from this file so
 * background code keeps a single import site.
 */

declare const browser: typeof chrome | undefined;

import { logger } from './logger';

const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

// Browser detection via UA — Chrome MV3 aliases `browser` to `chrome`,
// so `typeof browser` is useless as a discriminator.
export const isFirefox: boolean = /Firefox/.test(navigator.userAgent);

type MessageCallback = (response: unknown) => void;
type MessageListener = (
  message: unknown,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
  // biome-ignore lint/suspicious/noConfusingVoidType: matches Chrome extension API — void for sync listeners, true for async
) => boolean | void;

/**
 * Cross-browser `runtime` wrapper. Every method is lazy — it only
 * touches `chrome.runtime.*` when called — so importing this module
 * has no side-effects beyond the `isFirefox` detection above. That
 * makes it safe to pull into the fire-bridge content script via
 * `@utils/bridge`.
 */
export const runtime = {
  getURL: (path: string): string => browserAPI.runtime.getURL(path),
  sendMessage: (message: unknown, callback?: MessageCallback): void => {
    if (isFirefox) {
      const promise = browserAPI.runtime.sendMessage(message);
      if (callback) {
        promise
          .then((response: unknown) => callback(response))
          .catch((error: Error) => {
            logger.info('BrowserAPI', 'Firefox message error:', error.message);
            callback(undefined);
          });
      }
    } else {
      try {
        browserAPI.runtime.sendMessage(message, (response: unknown) => {
          // Read lastError to suppress "Unchecked runtime.lastError" console
          // noise (e.g. when broadcasting to pages that aren't open).
          void browserAPI.runtime.lastError;
          if (callback) {
            callback(response);
          }
        });
      } catch (error) {
        logger.info('BrowserAPI', 'Chrome message error:', (error as Error).message);
        if (callback) {
          setTimeout(() => callback(undefined), 0);
        }
      }
    }
  },
  onMessage: {
    addListener: (listener: MessageListener): void => browserAPI.runtime.onMessage.addListener(listener),
    removeListener: (listener: MessageListener): void => browserAPI.runtime.onMessage.removeListener(listener),
  },
  get lastError() {
    return browserAPI.runtime.lastError;
  },
  getManifest: (): chrome.runtime.Manifest => browserAPI.runtime.getManifest(),
  onInstalled: {
    addListener: (listener: (details: chrome.runtime.InstalledDetails) => void): void =>
      browserAPI.runtime.onInstalled.addListener(listener),
    removeListener: (listener: (details: chrome.runtime.InstalledDetails) => void): void =>
      browserAPI.runtime.onInstalled.removeListener(listener),
  },
  onStartup: {
    addListener: (listener: () => void): void => browserAPI.runtime.onStartup.addListener(listener),
    removeListener: (listener: () => void): void => browserAPI.runtime.onStartup.removeListener(listener),
  },
  // `onConnect` / `onSuspend` are only present in background contexts —
  // gate via a lazy getter so the module itself never touches them at
  // load time.
  get onConnect() {
    const api = browserAPI.runtime.onConnect;
    if (!api) return null;
    return {
      addListener: (listener: (port: chrome.runtime.Port) => void): void => api.addListener(listener),
      removeListener: (listener: (port: chrome.runtime.Port) => void): void => api.removeListener(listener),
    };
  },
  get onSuspend() {
    const api = browserAPI.runtime.onSuspend;
    if (!api) return null;
    return {
      addListener: (listener: () => void): void => api.addListener(listener),
      removeListener: (listener: () => void): void => api.removeListener(listener),
    };
  },
  connect: (connectInfo?: chrome.runtime.ConnectInfo): chrome.runtime.Port => browserAPI.runtime.connect(connectInfo),
};
