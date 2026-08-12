import { vi } from 'vitest';

const storageMock = {
  local: {
    get: vi.fn((_keys, callback) => callback?.({})),
    set: vi.fn((_items, callback) => callback?.()),
    remove: vi.fn((_keys, callback) => callback?.()),
    clear: vi.fn((callback) => callback?.()),
  },
  sync: {
    get: vi.fn((_keys, callback) => callback?.({})),
    set: vi.fn((_items, callback) => callback?.()),
    remove: vi.fn((_keys, callback) => callback?.()),
    clear: vi.fn((callback) => callback?.()),
  },
  session: {
    get: vi.fn(async (_keys?: string | string[] | null) => ({})),
    set: vi.fn(async (_items: Record<string, unknown>) => {}),
    remove: vi.fn(async (_keys: string | string[]) => {}),
    clear: vi.fn(async () => {}),
  },
  onChanged: {
    addListener: vi.fn(),
    removeListener: vi.fn(),
  },
};

const runtimeMock = {
  id: 'test-id',
  reload: vi.fn(),
  onUpdateAvailable: {
    addListener: vi.fn(),
    removeListener: vi.fn(),
  },
  sendMessage: vi.fn((_message, callback) => callback?.({})),
  onMessage: {
    addListener: vi.fn(),
    removeListener: vi.fn(),
  },
  onInstalled: {
    addListener: vi.fn(),
  },
  onStartup: {
    addListener: vi.fn(),
  },
  onConnect: {
    addListener: vi.fn(),
    removeListener: vi.fn(),
  },
  connect: vi.fn((_info?: chrome.runtime.ConnectInfo) => ({
    name: _info?.name ?? '',
    disconnect: vi.fn(),
    onDisconnect: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    postMessage: vi.fn(),
  })),
  getURL: vi.fn((path: string) => `chrome-extension://test-id/${path}`),
  getManifest: vi.fn(() => ({ version: '4.0.0' })),
  getPlatformInfo: vi.fn(async () => ({ os: 'mac', arch: 'arm64', nacl_arch: 'arm' })),
  lastError: null as chrome.runtime.LastError | null,
};

const tabsMock = {
  query: vi.fn((_queryInfo, callback) => callback?.([])),
  get: vi.fn((_tabId, callback) => callback?.({})),
  create: vi.fn((_createProperties, callback) => callback?.({})),
  update: vi.fn((_tabId, _updateProperties, callback) => callback?.({})),
  sendMessage: vi.fn((_tabId, _message, callback) => callback?.({})),
  onUpdated: {
    addListener: vi.fn(),
    removeListener: vi.fn(),
  },
  onActivated: {
    addListener: vi.fn(),
    removeListener: vi.fn(),
  },
  onRemoved: {
    addListener: vi.fn(),
    removeListener: vi.fn(),
  },
  onCreated: {
    addListener: vi.fn(),
    removeListener: vi.fn(),
  },
};

const alarmsMock = {
  create: vi.fn(),
  clear: vi.fn(),
  getAll: vi.fn(() => Promise.resolve([])),
  onAlarm: {
    addListener: vi.fn(),
    removeListener: vi.fn(),
  },
};

const declarativeNetRequestMock = {
  updateDynamicRules: vi.fn(() => Promise.resolve()),
  getDynamicRules: vi.fn(() => Promise.resolve([])),
};

const webRequestMock = {
  onBeforeRequest: { addListener: vi.fn(), removeListener: vi.fn() },
  onSendHeaders: { addListener: vi.fn(), removeListener: vi.fn() },
  onHeadersReceived: { addListener: vi.fn(), removeListener: vi.fn() },
  onCompleted: { addListener: vi.fn(), removeListener: vi.fn() },
  onErrorOccurred: { addListener: vi.fn(), removeListener: vi.fn() },
  onResponseStarted: { addListener: vi.fn(), removeListener: vi.fn() },
  onBeforeRedirect: { addListener: vi.fn(), removeListener: vi.fn() },
};

const webNavigationMock = {
  onCommitted: { addListener: vi.fn() },
  onTabReplaced: { addListener: vi.fn() },
  onDOMContentLoaded: { addListener: vi.fn() },
  getAllFrames: vi.fn(() => Promise.resolve([])),
  getFrame: vi.fn(() => Promise.resolve(null)),
};

const actionMock = {
  setBadgeText: vi.fn(() => Promise.resolve()),
  setBadgeBackgroundColor: vi.fn(() => Promise.resolve()),
  setTitle: vi.fn(() => Promise.resolve()),
};

const downloadsMock = {
  download: vi.fn((_options, callback) => callback?.(1)),
};

const cookiesMock = {
  getAll: vi.fn((_details, callback) => callback?.([])),
  // Echo the set details back as a Cookie-ish object so write tests can
  // assert the URL reconstruction / attribute mapping the SW performs.
  set: vi.fn((details: chrome.cookies.SetDetails, callback?: (cookie: chrome.cookies.Cookie | null) => void) => {
    const cookie = {
      name: details.name ?? '',
      value: details.value ?? '',
      domain: details.domain ?? new URL(details.url).hostname,
      path: details.path ?? '/',
      secure: !!details.secure,
      httpOnly: !!details.httpOnly,
      hostOnly: details.domain == null,
      session: details.expirationDate == null,
      sameSite: details.sameSite ?? 'unspecified',
      storeId: details.storeId ?? '0',
      ...(details.expirationDate != null ? { expirationDate: details.expirationDate } : {}),
      ...(details.partitionKey ? { partitionKey: details.partitionKey } : {}),
    } as chrome.cookies.Cookie;
    callback?.(cookie);
  }),
  remove: vi.fn(
    (details: chrome.cookies.CookieDetails, callback?: (d: chrome.cookies.CookieDetails | null) => void) => {
      callback?.(details);
    },
  ),
};

const windowsMock = {
  getCurrent: vi.fn((callback) => callback?.({ id: 1 })),
};

// chrome.debugger — an event-emitter mock. `attach`/`detach`/`sendCommand`
// are spies resolving immediately; `onEvent`/`onDetach` are real emitters
// so tests drive CDP traces in via `emitEvent` / `emitDetach`.
type DebuggerEventListener = (source: chrome.debugger.DebuggerSession, method: string, params?: object) => void;
type DebuggerDetachListener = (source: chrome.debugger.Debuggee, reason: string) => void;

const debuggerEventListeners = new Set<DebuggerEventListener>();
const debuggerDetachListeners = new Set<DebuggerDetachListener>();

const debuggerMock = {
  attach: vi.fn((_target: chrome.debugger.Debuggee, _version: string) => Promise.resolve()),
  detach: vi.fn((_target: chrome.debugger.Debuggee) => Promise.resolve()),
  sendCommand: vi.fn(
    // Matches the real `chrome.debugger.sendCommand` return — `object |
    // undefined` — so result-returning commands (e.g. Network.getResponseBody)
    // can be stubbed with `mockResolvedValueOnce({...})`.
    (_target: chrome.debugger.DebuggerSession, _method: string, _params?: Record<string, unknown>) =>
      Promise.resolve<object | undefined>(undefined),
  ),
  getTargets: vi.fn(() => Promise.resolve<chrome.debugger.TargetInfo[]>([])),
  onEvent: {
    addListener: vi.fn((cb: DebuggerEventListener) => debuggerEventListeners.add(cb)),
    removeListener: vi.fn((cb: DebuggerEventListener) => debuggerEventListeners.delete(cb)),
  },
  onDetach: {
    addListener: vi.fn((cb: DebuggerDetachListener) => debuggerDetachListeners.add(cb)),
    removeListener: vi.fn((cb: DebuggerDetachListener) => debuggerDetachListeners.delete(cb)),
  },
  /** Test helper — drive an instrumentation event into registered listeners. */
  emitEvent(source: chrome.debugger.DebuggerSession, method: string, params?: object): void {
    for (const cb of [...debuggerEventListeners]) cb(source, method, params);
  },
  /** Test helper — drive an `onDetach` into registered listeners. */
  emitDetach(source: chrome.debugger.Debuggee, reason: string): void {
    for (const cb of [...debuggerDetachListeners]) cb(source, reason);
  },
};

export const chrome = {
  storage: storageMock,
  runtime: runtimeMock,
  debugger: debuggerMock,
  tabs: tabsMock,
  alarms: alarmsMock,
  declarativeNetRequest: declarativeNetRequestMock,
  webRequest: webRequestMock,
  webNavigation: webNavigationMock,
  action: actionMock,
  downloads: downloadsMock,
  cookies: cookiesMock,
  windows: windowsMock,
  scripting: {
    executeScript: vi.fn(() => Promise.resolve([])),
  },
  browsingData: {
    remove: vi.fn(() => Promise.resolve()),
  },
  system: {
    display: {
      getInfo: vi.fn((callback) => callback?.([])),
    },
  },
};
