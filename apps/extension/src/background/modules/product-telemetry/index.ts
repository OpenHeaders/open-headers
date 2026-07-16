/**
 * Product-telemetry host wiring — binds the controller to this
 * extension's substrates: `chrome.storage.session` for the
 * browser-session id (RAM only, never persisted to disk), the settings
 * store for `telemetry.enabled`, a fetch transport to the published
 * endpoint (`docs/WIRE_TRANSPARENCY.md` §4), and an alarm for flush
 * cadence (the SW is evictable, so `setInterval` is not a cadence).
 */

import type { ProductTelemetrySnapshot } from '@openheaders/core/bridge';
import { getHostStorage, OH, wsKeys } from '@openheaders/core/storage';
import {
  bucketScale,
  mintTelemetrySessionId,
  type PersistedTelemetryQueueEntry,
  PRODUCT_TELEMETRY_ENDPOINT,
  PRODUCT_TELEMETRY_UNINSTALL_ENDPOINT,
  ProductTelemetryController,
  type ProductTelemetryInstallStore,
  type ProductTelemetrySessionStore,
  parseTelemetryAppVersion,
  type TelemetryChannelId,
  type TelemetryEnvelope,
  type TelemetryEvent,
  type TelemetryInstallContext,
  type TelemetryQueueStore,
} from '@openheaders/core/telemetry';
import { get as getSetting, subscribeKey } from '@openheaders/ui/workbench/settings/store';
import { alarms, isEdge, isFirefox, isSafari, runtime } from '@utils/browser-api';

declare const browser: typeof chrome | undefined;

const FLUSH_ALARM = 'productTelemetryFlush';
const FLUSH_PERIOD_MINUTES = 1;

const SESSION_ID_KEY = 'oh.productTelemetry.sessionId';
const LATCH_KEY_PREFIX = 'oh.productTelemetry.latch.';
const INSTALL_RECORD_KEY = 'oh.productTelemetry.install';
const FIRST_RUN_SENT_KEY = 'oh.productTelemetry.firstRunSent';
const QUEUE_KEY = 'oh.productTelemetry.queue';
const QUEUE_EPOCH_KEY = 'oh.productTelemetry.queueEpoch';

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
  async wasLatched(key) {
    const storageKey = LATCH_KEY_PREFIX + key;
    const area = sessionArea();
    if (!area) return fallbackSession[storageKey] === true;
    const items = await area.get(storageKey);
    return items[storageKey] === true;
  },
  async latch(key) {
    const storageKey = LATCH_KEY_PREFIX + key;
    const area = sessionArea();
    if (!area) {
      fallbackSession[storageKey] = true;
      return;
    }
    await area.set({ [storageKey]: true });
  },
};

/**
 * Durable install identity (plan §4, amended 2026-07-16) on
 * `chrome.storage.local`: survives SW eviction and browser restarts,
 * dies with the extension. The record and the first_run sent-bit are
 * separate keys on purpose — toggle-off deletes the identity record
 * while the boolean latch keeps toggle cycles out of install counts.
 */
const installStore: ProductTelemetryInstallStore = {
  async getRecord() {
    const api = typeof browser !== 'undefined' ? browser : chrome;
    const items = await api.storage.local.get(INSTALL_RECORD_KEY);
    const value = items[INSTALL_RECORD_KEY] as TelemetryInstallContext | undefined;
    return typeof value?.installId === 'string' && typeof value?.installedAt === 'number' ? value : null;
  },
  async setRecord(record) {
    const api = typeof browser !== 'undefined' ? browser : chrome;
    await api.storage.local.set({ [INSTALL_RECORD_KEY]: record });
  },
  async clearRecord() {
    const api = typeof browser !== 'undefined' ? browser : chrome;
    await api.storage.local.remove(INSTALL_RECORD_KEY);
  },
  async wasFirstRunSent() {
    const api = typeof browser !== 'undefined' ? browser : chrome;
    const items = await api.storage.local.get(FIRST_RUN_SENT_KEY);
    return items[FIRST_RUN_SENT_KEY] === true;
  },
  async markFirstRunSent() {
    const api = typeof browser !== 'undefined' ? browser : chrome;
    await api.storage.local.set({ [FIRST_RUN_SENT_KEY]: true });
  },
};

/**
 * Durable pending queue on `chrome.storage.local` so SW eviction can't
 * destroy events between track and flush. Session scoping without the
 * session id ever touching disk: a random epoch minted per browser
 * session lives in `chrome.storage.session` and is stamped on the
 * persisted record — after a browser restart the epochs mismatch and
 * the leftover queue is discarded, never carried into a new session's
 * envelope. Engines without a session area skip persistence entirely
 * (RAM-only queue, today's behavior).
 */
interface PersistedQueueRecord {
  epoch: string;
  entries: PersistedTelemetryQueueEntry[];
}

async function queueEpoch(area: chrome.storage.StorageArea): Promise<string> {
  const items = await area.get(QUEUE_EPOCH_KEY);
  const existing = items[QUEUE_EPOCH_KEY];
  if (typeof existing === 'string') return existing;
  const minted = mintTelemetrySessionId();
  await area.set({ [QUEUE_EPOCH_KEY]: minted });
  return minted;
}

const queueStore: TelemetryQueueStore = {
  async load() {
    const area = sessionArea();
    if (!area) return null;
    const api = typeof browser !== 'undefined' ? browser : chrome;
    const items = await api.storage.local.get(QUEUE_KEY);
    const record = items[QUEUE_KEY] as PersistedQueueRecord | undefined;
    if (!record || !Array.isArray(record.entries)) return null;
    return record.epoch === (await queueEpoch(area)) ? record.entries : null;
  },
  async save(entries) {
    const area = sessionArea();
    if (!area) return;
    const api = typeof browser !== 'undefined' ? browser : chrome;
    if (entries.length === 0) {
      await api.storage.local.remove(QUEUE_KEY);
      return;
    }
    const record: PersistedQueueRecord = { epoch: await queueEpoch(area), entries: [...entries] };
    await api.storage.local.set({ [QUEUE_KEY]: record });
  },
};

function detectBrowserKind(): 'chrome' | 'firefox' | 'edge' | 'safari' | 'other' {
  if (isFirefox) return 'firefox';
  if (isEdge) return 'edge';
  if (isSafari) return 'safari';
  if (navigator.userAgent.includes('Chrome')) return 'chrome';
  return 'other';
}

/** The store this build ships through — a static fact of the browser flavor. */
export function detectDistributionChannel(): TelemetryChannelId {
  if (isFirefox) return 'firefox-amo';
  if (isEdge) return 'edge-store';
  if (isSafari) return 'safari-store';
  return 'chrome-store';
}

/**
 * Coarse scale-of-use for `session_start`: active-workspace rule count
 * and workspace count, bucketed. Reads two storage keys at boot; any
 * failure just omits the buckets — context, never worth blocking over.
 */
async function readScaleBuckets(): Promise<
  Pick<Extract<TelemetryEvent, { name: 'session_start' }>, 'rules' | 'workspaces'>
> {
  try {
    const storage = getHostStorage();
    if (!storage) return {};
    const workspaces = (await storage.get(OH.workspaces)) ?? [];
    const activeId = (await storage.get(OH.runtimeActive)) ?? workspaces[0]?.id;
    const rules = activeId ? ((await storage.get(wsKeys(activeId).rules)) ?? []) : [];
    return { rules: bucketScale(rules.length), workspaces: bucketScale(workspaces.length) };
  } catch {
    return {};
  }
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
    ...(await readScaleBuckets()),
  };
}

/** The uninstall-URL target for one install id (WIRE_TRANSPARENCY.md §4). */
export function uninstallUrlFor(installId: string | null): string {
  return installId ? `${PRODUCT_TELEMETRY_UNINSTALL_ENDPOINT}?i=${installId}` : '';
}

/**
 * Keep the browser's uninstall ping in step with the identity: set while
 * an install id exists, cleared the moment the toggle wipes it. Best
 * effort — not every engine implements `setUninstallURL`.
 */
function syncUninstallUrl(installId: string | null): void {
  const api = typeof browser !== 'undefined' ? browser : chrome;
  try {
    void api.runtime.setUninstallURL?.(uninstallUrlFor(installId))?.catch?.(() => undefined);
  } catch {
    // Engines without the API just never ping.
  }
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
  installStore,
  queueStore,
  channel: detectDistributionChannel(),
  getEnabled: () => getSetting('telemetry.enabled'),
  subscribeEnabled: (fn) => void subscribeKey('telemetry.enabled', fn),
  buildSessionStart,
  onIdentityChanged: syncUninstallUrl,
});

/**
 * Boot the channel. Called after `settingsReady` in `background.ts` —
 * the enabled gate reads the settings store, which must be hydrated.
 * Flushes immediately after boot so `first_run`/`session_start` and any
 * queue restored from a previous SW life go out while this SW is still
 * alive; the alarm is the retry cadence, not the primary delivery path
 * (an evicted SW would lose a RAM-only minute-old queue otherwise).
 */
export function initProductTelemetry(): void {
  alarms?.create(FLUSH_ALARM, { periodInMinutes: FLUSH_PERIOD_MINUTES });
  void controller
    .init()
    .then(() => controller.flush())
    .catch(() => undefined);
}

export function isProductTelemetryAlarm(alarm: chrome.alarms.Alarm): boolean {
  return alarm.name === FLUSH_ALARM;
}

export async function handleProductTelemetryAlarm(): Promise<void> {
  await controller.flush();
}

/**
 * Record one vocabulary event — UI surfaces reach it over the bridge
 * RPC, SW modules call it directly. Fire-and-forget by law (plan §7):
 * a failure (e.g. the settings store not yet hydrated on a cold call
 * path) drops the event silently, never throws at a caller. Each track
 * kicks an opportunistic flush so delivery never waits on the alarm —
 * this SW may not live to see it fire.
 */
export function trackProductTelemetryEvent(event: TelemetryEvent): void {
  void controller
    .track(event)
    .then(() => controller.flush())
    .catch(() => undefined);
}

/** UI-surface entry (bridge RPC): the inspector's snapshot. */
export function readProductTelemetrySnapshot(): Promise<ProductTelemetrySnapshot> {
  return controller.snapshot();
}
