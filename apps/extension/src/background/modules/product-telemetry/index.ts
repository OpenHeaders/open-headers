/**
 * Product-telemetry host wiring — binds the controller to this
 * extension's substrates: `chrome.storage.session` for the
 * browser-session id (RAM only, never persisted to disk), the settings
 * store for `telemetry.enabled`, `hostStorage` for the disclosure flag,
 * a fetch transport to the published endpoint
 * (`docs/WIRE_TRANSPARENCY.md` §4), and an alarm for flush cadence
 * (the SW is evictable, so `setInterval` is not a cadence).
 */

import type { ProductTelemetrySnapshot } from '@openheaders/core/bridge';
import { hostStorage, OH } from '@openheaders/core/storage';
import {
  PRODUCT_TELEMETRY_ENDPOINT,
  ProductTelemetryController,
  type ProductTelemetrySessionStore,
  parseTelemetryAppVersion,
  type TelemetryEnvelope,
  type TelemetryEvent,
} from '@openheaders/core/telemetry';
import { get as getSetting, subscribeKey } from '@openheaders/ui/workbench/settings/store';
import { alarms, isEdge, isFirefox, isSafari, runtime } from '@utils/browser-api';

declare const browser: typeof chrome | undefined;

const FLUSH_ALARM = 'productTelemetryFlush';
const FLUSH_PERIOD_MINUTES = 1;

const SESSION_ID_KEY = 'oh.productTelemetry.sessionId';
const SESSION_START_SENT_KEY = 'oh.productTelemetry.sessionStartSent';

/**
 * `chrome.storage.session` survives SW eviction but lives in memory only
 * and is cleared when the browser exits — exactly the session scope the
 * plan's identity law wants. Absent substrate (very old browsers) falls
 * back to per-wake state, which only shortens sessions, never persists.
 */
function sessionArea(): chrome.storage.StorageArea | null {
  const api = typeof browser !== 'undefined' ? browser : chrome;
  return api.storage?.session ?? null;
}

const fallbackSession: Record<string, unknown> = {};

const sessionStore: ProductTelemetrySessionStore = {
  async getSessionId() {
    const area = sessionArea();
    if (!area) return (fallbackSession[SESSION_ID_KEY] as string | undefined) ?? null;
    const items = await area.get(SESSION_ID_KEY);
    const value = items[SESSION_ID_KEY];
    return typeof value === 'string' ? value : null;
  },
  async setSessionId(id) {
    const area = sessionArea();
    if (!area) {
      fallbackSession[SESSION_ID_KEY] = id;
      return;
    }
    await area.set({ [SESSION_ID_KEY]: id });
  },
  async wasSessionStartSent() {
    const area = sessionArea();
    if (!area) return fallbackSession[SESSION_START_SENT_KEY] === true;
    const items = await area.get(SESSION_START_SENT_KEY);
    return items[SESSION_START_SENT_KEY] === true;
  },
  async markSessionStartSent() {
    const area = sessionArea();
    if (!area) {
      fallbackSession[SESSION_START_SENT_KEY] = true;
      return;
    }
    await area.set({ [SESSION_START_SENT_KEY]: true });
  },
};

function detectBrowserKind(): 'chrome' | 'firefox' | 'edge' | 'safari' | 'other' {
  if (isFirefox) return 'firefox';
  if (isEdge) return 'edge';
  if (isSafari) return 'safari';
  if (navigator.userAgent.includes('Chrome')) return 'chrome';
  return 'other';
}

async function buildSessionStart(): Promise<TelemetryEvent | null> {
  const api = typeof browser !== 'undefined' ? browser : chrome;
  const info = await api.runtime.getPlatformInfo();
  // Only vocabulary platforms report; anything else skips the event
  // rather than misreporting under the nearest member.
  if (info.os !== 'mac' && info.os !== 'win' && info.os !== 'linux') return null;
  return {
    name: 'session_start',
    host: 'extension',
    appVersion: parseTelemetryAppVersion(runtime.getManifest().version),
    platform: info.os,
    browser: detectBrowserKind(),
    locale: 'en',
  };
}

const controller = new ProductTelemetryController({
  transport: {
    async send(envelope: TelemetryEnvelope): Promise<boolean> {
      const response = await fetch(PRODUCT_TELEMETRY_ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(envelope),
      });
      return response.ok;
    },
  },
  now: Date.now,
  sessionStore,
  getEnabled: () => getSetting('telemetry.enabled'),
  subscribeEnabled: (fn) => void subscribeKey('telemetry.enabled', fn),
  getDisclosed: async () => (await hostStorage.get(OH.productTelemetryDisclosed)) === true,
  subscribeDisclosed: (fn) => void hostStorage.subscribe(OH.productTelemetryDisclosed, fn),
  buildSessionStart,
});

/**
 * Boot the channel. Called after `settingsReady` in `background.ts` —
 * the enabled gate reads the settings store, which must be hydrated.
 */
export function initProductTelemetry(): void {
  alarms?.create(FLUSH_ALARM, { periodInMinutes: FLUSH_PERIOD_MINUTES });
  void controller.init();
}

export function isProductTelemetryAlarm(alarm: chrome.alarms.Alarm): boolean {
  return alarm.name === FLUSH_ALARM;
}

export async function handleProductTelemetryAlarm(): Promise<void> {
  await controller.flush();
}

/** UI-surface entry (bridge RPC): record one vocabulary event. */
export function trackProductTelemetryEvent(event: TelemetryEvent): void {
  void controller.track(event);
}

/** UI-surface entry (bridge RPC): the inspector's snapshot. */
export function readProductTelemetrySnapshot(): Promise<ProductTelemetrySnapshot> {
  return controller.snapshot();
}
