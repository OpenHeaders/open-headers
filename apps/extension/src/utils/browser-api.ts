/**
 * Cross-browser compatibility layer (background-side).
 *
 * Provides unified wrappers for every extension API the background
 * service worker touches: tabs, alarms, declarativeNetRequest, etc.
 *
 * Content scripts must NOT import from this module — top-level reads
 * below touch background-only Chrome namespaces (`chrome.tabs.onActivated`,
 * `chrome.alarms`, `chrome.declarativeNetRequest`) that are `undefined`
 * in a content-script realm and would crash the import graph. Content
 * scripts should import `runtime` and `isFirefox` from
 * `./browser-runtime.ts` directly — that module is lazy and content-safe.
 */

// Detect browser environment
declare const browser: typeof chrome | undefined;

import { isFirefox, runtime } from './browser-runtime';

export { isFirefox, runtime };

const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

// Non-Firefox browser detection — kept here because only background
// code currently branches on these flags.
export const isEdge: boolean = !isFirefox && navigator.userAgent.indexOf('Edg') !== -1;
export const isChrome: boolean = !isFirefox && !isEdge && navigator.userAgent.indexOf('Chrome') !== -1;
export const isSafari: boolean =
  !isFirefox && navigator.userAgent.indexOf('Safari') !== -1 && navigator.userAgent.indexOf('Chrome') === -1;

// Storage callback types
type StorageGetCallback = (items: Record<string, unknown>) => void;
type StorageSetCallback = () => void;

// Use proper storage APIs
export const storage = {
  sync: {
    get: (keys: string | string[] | null, callback: StorageGetCallback): void | Promise<void> => {
      if (isFirefox) {
        return (browserAPI.storage.sync.get(keys as string[]) as unknown as Promise<Record<string, unknown>>).then(
          callback,
        );
      } else {
        return browserAPI.storage.sync.get(keys as string[], callback);
      }
    },
    set: (items: Record<string, unknown>, callback?: StorageSetCallback): void | Promise<void> => {
      if (isFirefox) {
        return (browserAPI.storage.sync.set(items) as unknown as Promise<void>).then(callback || (() => {}));
      } else {
        return browserAPI.storage.sync.set(items, callback!);
      }
    },
    remove: (keys: string | string[], callback?: StorageSetCallback): void | Promise<void> => {
      if (isFirefox) {
        return (browserAPI.storage.sync.remove(keys as string[]) as unknown as Promise<void>).then(
          callback || (() => {}),
        );
      } else {
        return browserAPI.storage.sync.remove(keys as string[], callback!);
      }
    },
    clear: (callback?: StorageSetCallback): void | Promise<void> => {
      if (isFirefox) {
        return (browserAPI.storage.sync.clear() as unknown as Promise<void>).then(callback || (() => {}));
      } else {
        return browserAPI.storage.sync.clear(callback!);
      }
    },
  },
  local: {
    get: (keys: string | string[] | null, callback: StorageGetCallback): void | Promise<void> => {
      if (isFirefox) {
        return (browserAPI.storage.local.get(keys as string[]) as unknown as Promise<Record<string, unknown>>).then(
          callback,
        );
      } else {
        return browserAPI.storage.local.get(keys as string[], callback);
      }
    },
    set: (items: Record<string, unknown>, callback?: StorageSetCallback): void | Promise<void> => {
      if (isFirefox) {
        return (browserAPI.storage.local.set(items) as unknown as Promise<void>).then(callback || (() => {}));
      } else {
        return browserAPI.storage.local.set(items, callback!);
      }
    },
    remove: (keys: string | string[], callback?: StorageSetCallback): void | Promise<void> => {
      if (isFirefox) {
        return (browserAPI.storage.local.remove(keys as string[]) as unknown as Promise<void>).then(
          callback || (() => {}),
        );
      } else {
        return browserAPI.storage.local.remove(keys as string[], callback!);
      }
    },
    clear: (callback?: StorageSetCallback): void | Promise<void> => {
      if (isFirefox) {
        return (browserAPI.storage.local.clear() as unknown as Promise<void>).then(callback || (() => {}));
      } else {
        return browserAPI.storage.local.clear(callback!);
      }
    },
  },
  onChanged: {
    addListener: (
      listener: (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => void,
    ): void => {
      browserAPI.storage.onChanged.addListener(listener);
    },
    removeListener: (
      listener: (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => void,
    ): void => {
      browserAPI.storage.onChanged.removeListener(listener);
    },
  },
};

type MessageCallback = (response: unknown) => void;

type TabCallback = (tab: chrome.tabs.Tab) => void;
type TabsQueryCallback = (tabs: chrome.tabs.Tab[]) => void;

// Cross-browser tabs API
export const tabs = {
  create: (options: chrome.tabs.CreateProperties, callback?: TabCallback): void | Promise<void> => {
    if (isFirefox) {
      return (browserAPI.tabs.create(options) as unknown as Promise<chrome.tabs.Tab>).then(callback || (() => {}));
    } else {
      return browserAPI.tabs.create(options, callback!);
    }
  },
  query: (options: chrome.tabs.QueryInfo, callback?: TabsQueryCallback): void | Promise<void> => {
    if (isFirefox) {
      return (browserAPI.tabs.query(options) as unknown as Promise<chrome.tabs.Tab[]>).then(callback || (() => {}));
    } else {
      return browserAPI.tabs.query(options, callback!);
    }
  },
  get: (tabId: number, callback?: TabCallback): void | Promise<void> => {
    if (isFirefox) {
      return (browserAPI.tabs.get(tabId) as unknown as Promise<chrome.tabs.Tab>).then(callback || (() => {}));
    } else {
      return browserAPI.tabs.get(tabId, callback!);
    }
  },
  update: (
    tabId: number,
    options: chrome.tabs.UpdateProperties,
    callback?: (tab?: chrome.tabs.Tab) => void,
  ): void | Promise<void> => {
    if (isFirefox) {
      return (browserAPI.tabs.update(tabId, options) as unknown as Promise<chrome.tabs.Tab>).then(
        callback || (() => {}),
      );
    } else {
      return browserAPI.tabs.update(tabId, options, callback!);
    }
  },
  sendMessage: (tabId: number, message: unknown, callback?: MessageCallback): void | Promise<void> => {
    if (isFirefox) {
      return (browserAPI.tabs.sendMessage(tabId, message) as unknown as Promise<unknown>).then(callback || (() => {}));
    } else {
      return (
        browserAPI.tabs.sendMessage as (tabId: number, message: unknown, callback: (response: unknown) => void) => void
      )(tabId, message, callback!);
    }
  },
  remove: (tabId: number, callback?: () => void): void | Promise<void> => {
    if (isFirefox) {
      return (browserAPI.tabs.remove(tabId) as unknown as Promise<void>).then(callback || (() => {}));
    } else {
      return browserAPI.tabs.remove(tabId, callback!);
    }
  },
  onActivated: browserAPI.tabs.onActivated,
  onUpdated: browserAPI.tabs.onUpdated,
  onRemoved: browserAPI.tabs.onRemoved,
  onReplaced: browserAPI.tabs.onReplaced,
  onCreated: browserAPI.tabs.onCreated,
};

// Cross-browser alarms API
export const alarms = browserAPI.alarms
  ? {
      create: (name: string, alarmInfo: chrome.alarms.AlarmCreateInfo): void => {
        browserAPI.alarms.create(name, alarmInfo);
      },
      clear: (name: string): void => {
        // Ignore the boolean/promise return — callers that need to
        // know whether the alarm existed should `get` first.
        void browserAPI.alarms.clear(name);
      },
      getAll: (): Promise<chrome.alarms.Alarm[]> => {
        // Chrome returns a promise (MV3) OR calls a callback (MV2-style
        // in older polyfills). The modern API is promise-first; fall
        // back to callback when the return isn't thenable.
        const result = browserAPI.alarms.getAll();
        if (result && typeof (result as Promise<unknown>).then === 'function') {
          return result as Promise<chrome.alarms.Alarm[]>;
        }
        return new Promise<chrome.alarms.Alarm[]>((resolve) => {
          browserAPI.alarms.getAll((alarms: chrome.alarms.Alarm[]) => resolve(alarms ?? []));
        });
      },
      onAlarm: {
        addListener: (listener: (alarm: chrome.alarms.Alarm) => void): void =>
          browserAPI.alarms.onAlarm.addListener(listener),
        removeListener: (listener: (alarm: chrome.alarms.Alarm) => void): void =>
          browserAPI.alarms.onAlarm.removeListener(listener),
      },
    }
  : null;

// Cross-browser declarativeNetRequest API
export const declarativeNetRequest = browserAPI.declarativeNetRequest
  ? {
      updateDynamicRules: (options: chrome.declarativeNetRequest.UpdateRuleOptions): Promise<void> => {
        if (isFirefox) {
          return browserAPI.declarativeNetRequest.updateDynamicRules(options);
        } else {
          return new Promise<void>((resolve, reject) => {
            try {
              browserAPI.declarativeNetRequest.updateDynamicRules(options, () => {
                if (browserAPI.runtime.lastError) {
                  reject(browserAPI.runtime.lastError);
                } else {
                  resolve();
                }
              });
            } catch (e) {
              reject(e);
            }
          });
        }
      },
      getDynamicRules: (): Promise<chrome.declarativeNetRequest.Rule[]> => {
        if (isFirefox) {
          return browserAPI.declarativeNetRequest.getDynamicRules();
        } else {
          return new Promise<chrome.declarativeNetRequest.Rule[]>((resolve, reject) => {
            try {
              browserAPI.declarativeNetRequest.getDynamicRules((rules) => {
                if (browserAPI.runtime.lastError) {
                  reject(browserAPI.runtime.lastError);
                } else {
                  resolve(rules);
                }
              });
            } catch (e) {
              reject(e);
            }
          });
        }
      },
      /**
       * Updates session-scoped DNR workbench — ephemeral workbench that live only for
       * the current browser session. Used by the test-runner to apply
       * tab-scoped test workbench alongside the user's normal dynamic workbench.
       */
      updateSessionRules: (options: chrome.declarativeNetRequest.UpdateRuleOptions): Promise<void> => {
        const dnr = browserAPI.declarativeNetRequest as typeof chrome.declarativeNetRequest & {
          updateSessionRules?: (
            opts: chrome.declarativeNetRequest.UpdateRuleOptions,
            cb?: () => void,
          ) => Promise<void> | void;
        };
        if (typeof dnr.updateSessionRules !== 'function') {
          return Promise.resolve();
        }
        if (isFirefox) {
          return dnr.updateSessionRules(options) as Promise<void>;
        }
        return new Promise<void>((resolve, reject) => {
          try {
            dnr.updateSessionRules!(options, () => {
              if (browserAPI.runtime.lastError) {
                reject(browserAPI.runtime.lastError);
              } else {
                resolve();
              }
            });
          } catch (e) {
            reject(e);
          }
        });
      },
      getSessionRules: (): Promise<chrome.declarativeNetRequest.Rule[]> => {
        const dnr = browserAPI.declarativeNetRequest as typeof chrome.declarativeNetRequest & {
          getSessionRules?: (
            cb?: (rules: chrome.declarativeNetRequest.Rule[]) => void,
          ) => Promise<chrome.declarativeNetRequest.Rule[]> | undefined;
        };
        if (typeof dnr.getSessionRules !== 'function') {
          return Promise.resolve([]);
        }
        if (isFirefox) {
          return dnr.getSessionRules() as Promise<chrome.declarativeNetRequest.Rule[]>;
        }
        return new Promise<chrome.declarativeNetRequest.Rule[]>((resolve, reject) => {
          try {
            dnr.getSessionRules!((rules) => {
              if (browserAPI.runtime.lastError) {
                reject(browserAPI.runtime.lastError);
              } else {
                resolve(rules);
              }
            });
          } catch (e) {
            reject(e);
          }
        });
      },
      /**
       * Returns workbench matched by the declarativeNetRequest API for a given tab.
       * Requires the `declarativeNetRequestFeedback` permission. Used by the
       * test-runner to verify which workbench actually fired during a test session.
       * Not all browsers implement this — returns an empty result shape when
       * the underlying API is missing so callers can degrade gracefully.
       */
      getMatchedRules: (
        filter: chrome.declarativeNetRequest.MatchedRulesFilter,
      ): Promise<chrome.declarativeNetRequest.RulesMatchedDetails> => {
        const dnr = browserAPI.declarativeNetRequest as typeof chrome.declarativeNetRequest & {
          getMatchedRules?: (
            f: chrome.declarativeNetRequest.MatchedRulesFilter,
            cb?: (d: chrome.declarativeNetRequest.RulesMatchedDetails) => void,
          ) => Promise<chrome.declarativeNetRequest.RulesMatchedDetails> | undefined;
        };
        if (typeof dnr.getMatchedRules !== 'function') {
          return Promise.resolve({ rulesMatchedInfo: [] });
        }
        if (isFirefox) {
          return dnr.getMatchedRules(filter) as Promise<chrome.declarativeNetRequest.RulesMatchedDetails>;
        }
        return new Promise<chrome.declarativeNetRequest.RulesMatchedDetails>((resolve, reject) => {
          try {
            dnr.getMatchedRules!(filter, (details) => {
              if (browserAPI.runtime.lastError) {
                reject(browserAPI.runtime.lastError);
              } else {
                resolve(details);
              }
            });
          } catch (e) {
            reject(e);
          }
        });
      },
    }
  : null;

type DownloadCallback = (downloadId: number) => void;

// Cross-browser downloads API
export const downloads = browserAPI.downloads
  ? {
      download: (options: chrome.downloads.DownloadOptions, callback?: DownloadCallback): void | Promise<void> => {
        if (isFirefox) {
          return (browserAPI.downloads.download(options) as unknown as Promise<number>).then(callback || (() => {}));
        } else {
          return browserAPI.downloads.download(options, callback!);
        }
      },
    }
  : null;

/**
 * Cross-browser scripting API.
 *
 * Only surfaces the methods the test-runner needs for session bridge management.
 * The inject-manager still uses `browserAPI.scripting` directly for executeScript/
 * insertCSS since those hot paths predate this adapter.
 */
export const scripting = browserAPI.scripting
  ? {
      registerContentScripts: (
        scripts: Array<{
          id: string;
          js?: string[];
          css?: string[];
          matches: string[];
          runAt?: 'document_start' | 'document_end' | 'document_idle';
          world?: 'ISOLATED' | 'MAIN';
          persistAcrossSessions?: boolean;
          allFrames?: boolean;
        }>,
      ): Promise<void> => {
        const api = browserAPI.scripting as typeof chrome.scripting & {
          registerContentScripts?: (
            scripts: chrome.scripting.RegisteredContentScript[],
            cb?: () => void,
          ) => Promise<void> | void;
        };
        if (typeof api.registerContentScripts !== 'function') return Promise.resolve();
        if (isFirefox) {
          return api.registerContentScripts(
            scripts as unknown as chrome.scripting.RegisteredContentScript[],
          ) as Promise<void>;
        }
        return new Promise<void>((resolve, reject) => {
          try {
            api.registerContentScripts!(scripts as unknown as chrome.scripting.RegisteredContentScript[], () => {
              if (browserAPI.runtime.lastError) {
                reject(browserAPI.runtime.lastError);
              } else {
                resolve();
              }
            });
          } catch (e) {
            reject(e);
          }
        });
      },
      unregisterContentScripts: (filter: { ids: string[] }): Promise<void> => {
        const api = browserAPI.scripting as typeof chrome.scripting & {
          unregisterContentScripts?: (
            filter: chrome.scripting.ContentScriptFilter,
            cb?: () => void,
          ) => Promise<void> | void;
        };
        if (typeof api.unregisterContentScripts !== 'function') return Promise.resolve();
        if (isFirefox) {
          return api.unregisterContentScripts(filter) as Promise<void>;
        }
        return new Promise<void>((resolve, reject) => {
          try {
            api.unregisterContentScripts!(filter, () => {
              if (browserAPI.runtime.lastError) {
                reject(browserAPI.runtime.lastError);
              } else {
                resolve();
              }
            });
          } catch (e) {
            reject(e);
          }
        });
      },
    }
  : null;

// Cross-browser cookies API
export const cookies = browserAPI.cookies
  ? {
      getAll: (
        details: chrome.cookies.GetAllDetails,
        callback?: (cookies: chrome.cookies.Cookie[]) => void,
      ): void | Promise<void> => {
        if (isFirefox) {
          return (browserAPI.cookies.getAll(details) as unknown as Promise<chrome.cookies.Cookie[]>).then(
            callback || (() => {}),
          );
        } else {
          return browserAPI.cookies.getAll(details, callback!);
        }
      },
    }
  : null;

// Cross-browser windows API
export const windows = browserAPI.windows
  ? {
      WINDOW_ID_NONE: browserAPI.windows.WINDOW_ID_NONE,
      onFocusChanged: browserAPI.windows.onFocusChanged
        ? {
            addListener: (listener: (windowId: number) => void): void =>
              browserAPI.windows.onFocusChanged.addListener(listener),
            removeListener: (listener: (windowId: number) => void): void =>
              browserAPI.windows.onFocusChanged.removeListener(listener),
          }
        : null,
    }
  : null;

type WebNavigationListener = (details: chrome.webNavigation.WebNavigationTransitionCallbackDetails) => void;
type WebNavigationErrorListener = (details: chrome.webNavigation.WebNavigationFramedErrorCallbackDetails) => void;
// Cross-browser webNavigation API
/**
 * `chrome.identity` wrapper (OAuth 2.0 / OIDC — ARCHITECTURE §18).
 *
 * `launchWebAuthFlow` drives the authorization-code + PKCE flow by
 * opening the provider's authorization URL in a dedicated window and
 * intercepting the `https://<extension-id>.chromiumapp.org/` redirect.
 * `getRedirectURL` returns the stable per-extension redirect origin
 * so we can show the user the exact string they must register with
 * the provider.
 *
 * Firefox + Safari: `browser.identity.*` has the same shape as
 * Chrome's; the `browserAPI` indirection above uses `browser` when
 * present. If identity isn't available (extremely old browsers), the
 * wrapper surfaces the absence so callers can fall back to a clear
 * error message instead of a confusing undefined crash.
 */
interface IdentityLaunchWebAuthFlowOptions {
  url: string;
  interactive: boolean;
  /** Passed through verbatim so the caller keeps raw control (e.g. for abandonDetails). */
  [key: string]: unknown;
}

interface IdentityApi {
  launchWebAuthFlow: (
    details: IdentityLaunchWebAuthFlowOptions,
    callback?: (responseUrl?: string) => void,
  ) => Promise<string | undefined> | void;
  getRedirectURL: (path?: string) => string;
}

function getIdentityApi(): IdentityApi | null {
  const id = (browserAPI as unknown as { identity?: IdentityApi }).identity;
  if (!id || typeof id.launchWebAuthFlow !== 'function') return null;
  return id;
}

export const identity = {
  isAvailable: (): boolean => getIdentityApi() !== null,
  launchWebAuthFlow: (options: IdentityLaunchWebAuthFlowOptions): Promise<string | null> => {
    // Chrome supports a promise-returning form natively; Firefox's
    // `browser.identity.launchWebAuthFlow` also returns a promise. We
    // wrap anyway so `chrome.runtime.lastError` is surfaced as a
    // proper rejection on Chrome's callback-form fallback.
    const id = getIdentityApi();
    if (!id) {
      return Promise.reject(new Error('chrome.identity.launchWebAuthFlow is not available in this browser'));
    }
    return new Promise<string | null>((resolve, reject) => {
      try {
        const maybePromise = id.launchWebAuthFlow(options, (responseUrl) => {
          if (browserAPI.runtime.lastError) {
            reject(new Error(browserAPI.runtime.lastError.message ?? 'identity error'));
            return;
          }
          resolve(responseUrl ?? null);
        });
        if (maybePromise && typeof (maybePromise as Promise<string>).then === 'function') {
          (maybePromise as Promise<string | undefined>).then((url) => resolve(url ?? null), reject);
        }
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  },
  getRedirectURL: (path = ''): string => {
    const id = getIdentityApi();
    if (!id) return '';
    return id.getRedirectURL(path);
  },
};

export const webNavigation = browserAPI.webNavigation
  ? {
      onCommitted: browserAPI.webNavigation.onCommitted
        ? {
            addListener: (listener: WebNavigationListener): void =>
              browserAPI.webNavigation.onCommitted.addListener(listener),
            removeListener: (listener: WebNavigationListener): void =>
              browserAPI.webNavigation.onCommitted.removeListener(listener),
          }
        : null,
      onHistoryStateUpdated: browserAPI.webNavigation.onHistoryStateUpdated
        ? {
            addListener: (listener: WebNavigationListener): void =>
              browserAPI.webNavigation.onHistoryStateUpdated.addListener(listener),
            removeListener: (listener: WebNavigationListener): void =>
              browserAPI.webNavigation.onHistoryStateUpdated.removeListener(listener),
          }
        : null,
      onErrorOccurred: browserAPI.webNavigation.onErrorOccurred
        ? {
            addListener: (listener: WebNavigationErrorListener): void =>
              browserAPI.webNavigation.onErrorOccurred.addListener(listener),
            removeListener: (listener: WebNavigationErrorListener): void =>
              browserAPI.webNavigation.onErrorOccurred.removeListener(listener),
          }
        : null,
      onTabReplaced: browserAPI.webNavigation.onTabReplaced
        ? {
            addListener: (
              listener: (details: { replacedTabId: number; tabId: number; timeStamp: number }) => void,
            ): void =>
              (
                browserAPI.webNavigation.onTabReplaced as unknown as chrome.events.Event<
                  (details: { replacedTabId: number; tabId: number; timeStamp: number }) => void
                >
              ).addListener(listener),
            removeListener: (
              listener: (details: { replacedTabId: number; tabId: number; timeStamp: number }) => void,
            ): void =>
              (
                browserAPI.webNavigation.onTabReplaced as unknown as chrome.events.Event<
                  (details: { replacedTabId: number; tabId: number; timeStamp: number }) => void
                >
              ).removeListener(listener),
          }
        : null,
    }
  : null;
