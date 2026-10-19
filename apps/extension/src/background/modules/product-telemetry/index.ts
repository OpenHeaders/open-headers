/**
 * Product-telemetry host wiring — binds the controller to this
 * extension's substrates: `chrome.storage.session` for the
 * browser-session id (RAM only, never persisted to disk), the settings
 * store for `telemetry.enabled`, a fetch transport to the published
 * endpoint (`docs/WIRE_TRANSPARENCY.md` §4), and an alarm for flush
 * cadence (the SW is evictable, so `setInterval` is not a cadence).
 */

import { isDesktopAppBackendUrl } from '@openheaders/core/backends';
import type { ProductTelemetrySnapshot } from '@openheaders/core/bridge';
import { getHostStorage, OH, wsKeys } from '@openheaders/core/storage';
import {
  browserMajorFromUserAgent,
  bucketScale,
  buildTelemetryUninstallUrl,
  mintTelemetrySessionId,
  type PersistedTelemetryQueueEntry,
  PRODUCT_TELEMETRY_ENDPOINT,
  ProductTelemetryController,
  type ProductTelemetryInstallStore,
  type ProductTelemetrySessionStore,
  parseTelemetryAppVersion,
  resolveTelemetrySyncKind,
  type TelemetryBrowserKind,
  type TelemetryChannelId,
  type TelemetryEnvelope,
  type TelemetryEnvelopeFacts,
  type TelemetryEvent,
  type TelemetryInstallContext,
  type TelemetryLocale,
  type TelemetryPlatform,
  type TelemetryQueueStore,
  type TelemetrySyncKind,
  toTelemetryArch,
  toTelemetryLocale,
  windowsMajorFromClientHintPlatformVersion,
} from '@openheaders/core/telemetry';
import { resolveLocale } from '@openheaders/i18n';
import { get as getSetting, subscribeKey } from '@openheaders/ui/workbench/settings/store';
import { alarms, isEdge, isFirefox, isSafari, runtime } from '@utils/browser-api';

declare const browser: typeof chrome | undefined;

const FLUSH_ALARM = 'productTelemetryFlush';
const FLUSH_PERIOD_MINUTES = 1;

const SESSION_ID_KEY = 'oh.productTelemetry.sessionId';
const SESSION_STARTED_AT_KEY = 'oh.productTelemetry.sessionStartedAt';
const LATCH_KEY_PREFIX = 'oh.productTelemetry.latch.';
const LATCH_DAY_KEY = 'oh.productTelemetry.latchDay';
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
export function sessionArea(): chrome.storage.StorageArea | null {
  const api = typeof browser !== 'undefined' ? browser : chrome;
  return api.storage?.session ?? null;
}

const fallbackSession: Record<string, unknown> = {};

/** The browser-session store — SHARED with the error-report channel (one session id; the host boots the two in sequence). */
export const sessionStore: ProductTelemetrySessionStore = {
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
  async getStartedAt() {
    const area = sessionArea();
    const value = area
      ? (await area.get(SESSION_STARTED_AT_KEY))[SESSION_STARTED_AT_KEY]
      : fallbackSession[SESSION_STARTED_AT_KEY];
    return typeof value === 'number' ? value : null;
  },
  async setStartedAt(at) {
    const area = sessionArea();
    if (!area) {
      fallbackSession[SESSION_STARTED_AT_KEY] = at;
      return;
    }
    await area.set({ [SESSION_STARTED_AT_KEY]: at });
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
  async getLatchDay() {
    const area = sessionArea();
    const value = area ? (await area.get(LATCH_DAY_KEY))[LATCH_DAY_KEY] : fallbackSession[LATCH_DAY_KEY];
    return typeof value === 'number' ? value : null;
  },
  async setLatchDay(day) {
    const area = sessionArea();
    if (!area) {
      fallbackSession[LATCH_DAY_KEY] = day;
      return;
    }
    await area.set({ [LATCH_DAY_KEY]: day });
  },
  async clearLatches() {
    const area = sessionArea();
    if (!area) {
      for (const key of Object.keys(fallbackSession)) {
        if (key.startsWith(LATCH_KEY_PREFIX)) delete fallbackSession[key];
      }
      return;
    }
    const items = await area.get(null);
    const keys = Object.keys(items).filter((key) => key.startsWith(LATCH_KEY_PREFIX));
    if (keys.length > 0) await area.remove(keys);
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

function detectBrowserKind(): TelemetryBrowserKind {
  if (isFirefox) return 'firefox';
  if (isEdge) return 'edge';
  if (isSafari) return 'safari';
  if (navigator.userAgent.includes('Chrome')) return 'chrome';
  return 'other';
}

/**
 * Whether the browser loaded this build as a development install
 * (`management.getSelf().installType === 'development'` — unpacked on
 * Chromium, a temporary add-on on Firefox). `getSelf` needs no
 * `management` permission on any engine; an engine without it, or one
 * that throws, reads as not-development. Resolved once at boot and
 * cached: the channel read is synchronous (it feeds the uninstall URL
 * too) and the fact never changes over an extension's lifetime.
 */
let developmentInstall = false;

export async function resolveInstallType(): Promise<void> {
  const api = typeof browser !== 'undefined' ? browser : chrome;
  try {
    const self = await api.management?.getSelf?.();
    developmentInstall = self?.installType === 'development';
  } catch {
    developmentInstall = false;
  }
}

/**
 * The store this build ships through — a static fact of the browser
 * flavor. A development install (above) reports `dev` on every engine
 * so it never inflates store install counts; on Chromium the runtime
 * manifest's `update_url` is the fallback marker (only a
 * store-delivered build carries one). Firefox has no such marker
 * (AMO-listed builds carry none either) and Safari builds only ever
 * arrive through the store.
 */
export function detectDistributionChannel(): TelemetryChannelId {
  if (developmentInstall) return 'dev';
  if (isFirefox) return 'firefox-amo';
  if (isSafari) return 'safari-store';
  if (!runtime.getManifest().update_url) return 'dev';
  if (isEdge) return 'edge-store';
  return 'chrome-store';
}

/**
 * Coarse scale-of-use for `session_start`: active-workspace rule count
 * and workspace count, bucketed. Reads two storage keys at boot; any
 * failure just omits the buckets — context, never worth blocking over.
 */
export async function readScaleBuckets(): Promise<
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

/**
 * How this install keeps its workspaces (S35), the install-wide
 * maximum: a connection record to anything but the desktop app's own
 * loopback wire is a server (a daemon or a team server); the extension
 * never binds git itself. Any read failure omits the fact.
 */
export async function readSyncKind(): Promise<TelemetrySyncKind | undefined> {
  try {
    const storage = getHostStorage();
    if (!storage) return undefined;
    const backends = (await storage.get(OH.backends)) ?? [];
    return resolveTelemetrySyncKind({
      server: backends.some((backend) => !isDesktopAppBackendUrl(backend.url)),
      git: false,
    });
  } catch {
    return undefined;
  }
}

/**
 * User-Agent Client Hints as Chromium exposes them to a service
 * worker; absent on Firefox and Safari. Not yet in `lib.dom`, hence
 * the local shape (the same read the settings schema makes).
 */
interface UserAgentData {
  getHighEntropyValues?(hints: string[]): Promise<{ platformVersion?: string }>;
}

/**
 * The OS major (S35), only where it can be read honestly: Chromium's
 * high-entropy `platformVersion` hint carries the real macOS version
 * and the Windows platform version (13+ = Windows 11). The UA string
 * itself froze both, so Firefox and Safari stay unstamped, and Linux
 * has no product-meaningful major anywhere.
 */
async function telemetryOsMajor(platform: TelemetryPlatform | null): Promise<number | null> {
  if (platform === null || platform === 'linux') return null;
  const uaData = (navigator as Navigator & { userAgentData?: UserAgentData }).userAgentData;
  if (!uaData?.getHighEntropyValues) return null;
  try {
    const { platformVersion } = await uaData.getHighEntropyValues(['platformVersion']);
    if (!platformVersion) return null;
    if (platform === 'win') return windowsMajorFromClientHintPlatformVersion(platformVersion);
    const major = Number.parseInt(platformVersion, 10);
    return Number.isInteger(major) && major > 0 ? major : null;
  } catch {
    return null;
  }
}

/**
 * The platform facts off one `getPlatformInfo` read. Only vocabulary
 * members report; anything else stays unstamped rather than
 * misreporting under the nearest member. The architecture is the
 * browser's own — every engine ships native arm64 builds, so in
 * practice it is the machine's.
 */
async function telemetryPlatformFacts(): Promise<Pick<TelemetryEnvelopeFacts, 'platform' | 'arch' | 'osVersion'>> {
  const api = typeof browser !== 'undefined' ? browser : chrome;
  const info = await api.runtime.getPlatformInfo();
  const platform: TelemetryPlatform | null =
    info.os === 'mac' || info.os === 'win' || info.os === 'linux' ? info.os : null;
  const arch = toTelemetryArch(info.arch);
  const osVersion = await telemetryOsMajor(platform);
  return {
    ...(platform !== null ? { platform } : {}),
    ...(arch !== null ? { arch } : {}),
    ...(osVersion !== null ? { osVersion } : {}),
  };
}

/**
 * The interface language, resolved exactly like the UI resolves it
 * (persisted `general.language` setting, `auto` walking the browser's
 * preference list) and mapped onto the telemetry vocabulary — a locale
 * the catalog gained before the vocabulary reports `other`.
 */
function currentTelemetryLocale(): TelemetryLocale {
  let setting: string;
  try {
    setting = getSetting('general.language');
  } catch {
    setting = 'auto';
  }
  const preferences = typeof navigator !== 'undefined' ? (navigator.languages ?? [navigator.language]) : [];
  return toTelemetryLocale(resolveLocale(setting, preferences));
}

/** Per-process envelope facts (plan §3, S15): read fresh per flush so a language switch re-stamps the next batch. */
export async function buildEnvelopeFacts(): Promise<TelemetryEnvelopeFacts> {
  const browser = detectBrowserKind();
  // The UA freeze never touched the browser major (S35); `other` has no
  // vocabulary and stays unstamped.
  const browserVersion = browserMajorFromUserAgent(browser, navigator.userAgent);
  return {
    channel: detectDistributionChannel(),
    appVersion: parseTelemetryAppVersion(runtime.getManifest().version),
    locale: currentTelemetryLocale(),
    ...(await telemetryPlatformFacts()),
    browser,
    ...(browserVersion !== null ? { browserVersion } : {}),
  };
}

async function buildSessionStart(): Promise<TelemetryEvent | null> {
  // The per-process facts ride the envelope, so the event carries only
  // the measurements taken at session start: the scale-of-use buckets
  // and the sync kind. An unmappable platform (ChromeOS) leaves the
  // envelope unstamped but still counts the session — the install is a
  // real store user either way (S31; before, those installs announced
  // a first_run and were never seen again).
  const sync = await readSyncKind();
  return { name: 'session_start', ...(await readScaleBuckets()), ...(sync !== undefined ? { sync } : {}) };
}

/**
 * The uninstall-URL target for one install identity
 * (WIRE_TRANSPARENCY.md §4): the install id plus the coarse age bucket
 * and distribution channel (S16) — churn segments by age and
 * acquisition. Empty without an identity.
 */
export function uninstallUrlFor(record: TelemetryInstallContext | null): string {
  return record ? buildTelemetryUninstallUrl(record, detectDistributionChannel(), Date.now()) : '';
}

/**
 * Keep the browser's uninstall ping in step with the identity AND the
 * rolling age bucket: recomputed on every identity change and on every
 * flush cadence tick, re-registered only when the URL actually changed
 * (the bucket rolls a handful of times per install lifetime; everything
 * else is a no-op read). Serialized on one chain so a rapid toggle
 * cycle can't interleave reads and register a stale URL. Best effort —
 * not every engine implements `setUninstallURL`.
 */
let lastRegisteredUninstallUrl: string | null = null;
let uninstallUrlChain: Promise<void> = Promise.resolve();

async function refreshUninstallUrl(): Promise<void> {
  const url = uninstallUrlFor(await installStore.getRecord());
  if (url === lastRegisteredUninstallUrl) return;
  lastRegisteredUninstallUrl = url;
  const api = typeof browser !== 'undefined' ? browser : chrome;
  try {
    void api.runtime.setUninstallURL?.(url)?.catch?.(() => undefined);
  } catch {
    // Engines without the API just never ping.
  }
}

function scheduleUninstallUrlRefresh(): void {
  uninstallUrlChain = uninstallUrlChain.then(refreshUninstallUrl).catch(() => undefined);
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
  host: 'extension',
  facts: buildEnvelopeFacts,
  getEnabled: () => getSetting('telemetry.enabled'),
  subscribeEnabled: (fn) => void subscribeKey('telemetry.enabled', fn),
  buildSessionStart,
  onIdentityChanged: scheduleUninstallUrlRefresh,
});

/**
 * Boot the channel. Called after `settingsReady` in `background.ts` —
 * the enabled gate reads the settings store, which must be hydrated.
 * Flushes immediately after boot so `first_run`/`session_start` and any
 * queue restored from a previous SW life go out while this SW is still
 * alive; the alarm is the retry cadence, not the primary delivery path
 * (an evicted SW would lose a RAM-only minute-old queue otherwise).
 */
export function initProductTelemetry(): Promise<void> {
  alarms?.create(FLUSH_ALARM, { periodInMinutes: FLUSH_PERIOD_MINUTES });
  // The install type resolves before the controller boots: the first
  // identity change registers the uninstall URL with the channel in it.
  // The settled promise is the error channel's cue to boot AFTER this
  // one on the shared session store (one session id, never two).
  return resolveInstallType()
    .then(() => controller.init())
    .then(() => {
      // Enabled transitions can queue events of their own (the
      // consent-time session_start re-fire) — flush right behind the
      // controller's listener, which registered first during init, so
      // the transition's work is already on the gate chain.
      subscribeKey('telemetry.enabled', () => void controller.flush().catch(() => undefined));
      return controller.flush();
    })
    .catch(() => undefined);
}

export function isProductTelemetryAlarm(alarm: chrome.alarms.Alarm): boolean {
  return alarm.name === FLUSH_ALARM;
}

export async function handleProductTelemetryAlarm(): Promise<void> {
  // The cadence tick doubles as the age-bucket watchdog: the registered
  // uninstall URL re-derives here and re-registers only on change.
  scheduleUninstallUrlRefresh();
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
