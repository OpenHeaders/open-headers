/**
 * Product-telemetry host adapter for the desktop main process
 * (the telemetry plan §7) — the persistent-process twin of the
 * extension SW module. One process launch is one session, so the
 * session id and the session_start latch live in the shared controller's
 * in-memory store (never persisted); cadence is a plain interval because
 * nothing evicts this process.
 *
 * The enabled gate rides the file-backed host storage the renderer
 * writes through: `telemetry.enabled` inside the `oh.settings.user`
 * blob (default on, absent key = on). It is subscribed, so a toggle
 * takes effect live without a restart.
 *
 * "Product telemetry" naming: plain "telemetry" in this codebase means
 * the per-tab traffic telemetry the inspector shows — this channel is
 * always the product one.
 */

import type { ProductTelemetrySnapshot } from '@openheaders/core/bridge';
import { getLicenseSnapshot } from '@openheaders/core/licensing';
import type { HostStorage } from '@openheaders/core/storage';
import { OH } from '@openheaders/core/storage';
import {
  createInMemoryProductTelemetrySessionStore,
  osMajorFromSystemVersion,
  PRODUCT_TELEMETRY_ENDPOINT,
  ProductTelemetryController,
  type ProductTelemetryHostReadings,
  type ProductTelemetryInstallStore,
  type ProductTelemetrySessionStore,
  type ProductTelemetryStateStore,
  type ProductTelemetryTrackScope,
  parseTelemetryAppVersion,
  planBucketFromLicenseSnapshot,
  readHostReadingsFromStorage,
  readInstallStateRecord,
  type TelemetryChannelId,
  type TelemetryEnvelope,
  type TelemetryEnvelopeFacts,
  type TelemetryEvent,
  type TelemetryPlatform,
  type TelemetryTransport,
  toTelemetryArch,
  toTelemetryLocale,
} from '@openheaders/core/telemetry';

const FLUSH_PERIOD_MS = 60_000;

export interface ProductTelemetryHostDeps {
  storage: Pick<HostStorage, 'get' | 'set' | 'remove' | 'subscribe'>;
  /** CalVer app version (`app.getVersion()`). */
  appVersion: string;
  /** `process.platform`; unmappable values skip `session_start` rather than misreport. */
  platform: NodeJS.Platform;
  /** `process.arch` — the build's architecture; unlisted values leave the envelope unstamped. */
  arch: NodeJS.Architecture;
  /** Electron's `app.runningUnderARM64Translation`: an x64 build under Rosetta or Windows ARM64 translation. */
  runningUnderArm64Translation: boolean;
  /**
   * Electron's `process.getSystemVersion()` — the OS marketing version
   * on macOS (`15.1`), `10.0.<build>` on Windows, a kernel string on
   * Linux. Only the coarse major ever leaves the process (S35): macOS
   * as read, Windows 11 from build 22000, Linux never.
   */
  systemVersion: string;
  /** This build's distribution channel, stamped on every envelope (packaged = github-release; unpackaged = dev). */
  channel: TelemetryChannelId;
  /**
   * The resolved interface locale (the main-process locale module's
   * current value) — read per flush so a language switch re-stamps the
   * next envelope; mapped onto the vocabulary here.
   */
  locale(): string;
  /**
   * The session store the controller boots on — SHARED with the error
   * report controller (one session id per launch; the host inits the
   * two in sequence). Defaults to a fresh in-memory store.
   */
  sessionStore?: ProductTelemetrySessionStore;
  /** Test seams; production uses the fetch transport + wall clock. */
  transport?: TelemetryTransport;
  now?: () => number;
}

export interface ProductTelemetryHandle {
  /** Record one vocabulary event (bridge RPC + main-process call sites); a once-per-workspace event names its scope. */
  track(event: TelemetryEvent, scope?: ProductTelemetryTrackScope): void;
  /** The telemetry inspector's snapshot (bridge RPC). */
  snapshot(): Promise<ProductTelemetrySnapshot>;
  flush(): Promise<void>;
  /** Stop the flush cadence and fire one best-effort final flush. */
  dispose(): void;
}

/**
 * Durable install identity on the file-backed host storage — the typed
 * keys of `OH.productTelemetryInstall` / `OH.productTelemetryFirstRunSent`
 * (identity record wiped on toggle-off; the sent-bit survives by design).
 */
function createStorageInstallStore(storage: Pick<HostStorage, 'get' | 'set' | 'remove'>): ProductTelemetryInstallStore {
  return {
    async getRecord() {
      const record = await storage.get(OH.productTelemetryInstall);
      return typeof record?.installId === 'string' && typeof record?.installedAt === 'number' ? record : null;
    },
    setRecord: (record) => storage.set(OH.productTelemetryInstall, record),
    clearRecord: () => storage.remove(OH.productTelemetryInstall),
    wasFirstRunSent: async () => (await storage.get(OH.productTelemetryFirstRunSent)) === true,
    markFirstRunSent: () => storage.set(OH.productTelemetryFirstRunSent, true),
  };
}

/** The tracker's record on the same storage, under its own typed key; wiped with the identity. */
function createStorageStateStore(storage: Pick<HostStorage, 'get' | 'set' | 'remove'>): ProductTelemetryStateStore {
  return {
    getRecord: async () => readInstallStateRecord(await storage.get(OH.productTelemetryState)),
    setRecord: (record) => storage.set(OH.productTelemetryState, record),
    clearRecord: () => storage.remove(OH.productTelemetryState),
  };
}

function readTelemetryEnabled(values: Record<string, unknown> | undefined): boolean {
  return values?.['telemetry.enabled'] !== false;
}

function telemetryPlatform(platform: NodeJS.Platform): TelemetryPlatform | null {
  if (platform === 'darwin') return 'mac';
  if (platform === 'win32') return 'win';
  if (platform === 'linux') return 'linux';
  return null;
}

/**
 * The install's readings for the state block (the telemetry v2 plan
 * §3): the shared storage reading (rules, saved requests, workspaces,
 * the sync kind, the directory's role and team) plus what only this
 * process knows — the plan, from the spine's license slot through the
 * same provider the seat gate reads (never the license file).
 */
async function readHostState(storage: Pick<HostStorage, 'get'>): Promise<ProductTelemetryHostReadings> {
  return {
    ...(await readHostReadingsFromStorage(storage, { git: true })),
    plan: planBucketFromLicenseSnapshot(getLicenseSnapshot()),
  };
}

function buildSessionStart(platform: NodeJS.Platform): TelemetryEvent | null {
  // Unmappable platforms skip the event rather than misreport (the
  // envelope stays unstamped too); the per-process facts ride the
  // envelope and the measurements ride its state block, so the event
  // itself is bare.
  return telemetryPlatform(platform) ? { name: 'session_start' } : null;
}

/** Per-process envelope facts (plan §3, S15): read fresh per flush so a language switch re-stamps the next batch; the error channel's envelope carries the same. */
export function buildEnvelopeFacts(deps: ProductTelemetryHostDeps): TelemetryEnvelopeFacts {
  const platform = telemetryPlatform(deps.platform);
  const arch = toTelemetryArch(deps.arch, deps.runningUnderArm64Translation);
  const osVersion = platform !== null ? osMajorFromSystemVersion(platform, deps.systemVersion) : null;
  return {
    channel: deps.channel,
    appVersion: parseTelemetryAppVersion(deps.appVersion),
    locale: toTelemetryLocale(deps.locale()),
    ...(platform !== null ? { platform } : {}),
    ...(arch !== null ? { arch } : {}),
    ...(osVersion !== null ? { osVersion } : {}),
  };
}

const fetchTransport: TelemetryTransport = {
  async send(envelope: TelemetryEnvelope): Promise<boolean> {
    const response = await fetch(PRODUCT_TELEMETRY_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(envelope),
    });
    return response.ok;
  },
};

export async function installProductTelemetry(deps: ProductTelemetryHostDeps): Promise<ProductTelemetryHandle> {
  let enabled = readTelemetryEnabled(await deps.storage.get(OH.settingsUser));
  const enabledListeners: Array<() => void> = [];
  deps.storage.subscribe(OH.settingsUser, (next) => {
    enabled = readTelemetryEnabled(next);
    for (const fn of enabledListeners) fn();
  });

  const controller = new ProductTelemetryController({
    transport: deps.transport ?? fetchTransport,
    now: deps.now ?? Date.now,
    sessionStore: deps.sessionStore ?? createInMemoryProductTelemetrySessionStore(),
    installStore: createStorageInstallStore(deps.storage),
    stateStore: createStorageStateStore(deps.storage),
    host: 'desktop',
    facts: () => buildEnvelopeFacts(deps),
    readHostState: () => readHostState(deps.storage),
    getEnabled: () => enabled,
    subscribeEnabled: (fn) => enabledListeners.push(fn),
    buildSessionStart: async () => buildSessionStart(deps.platform),
  });
  await controller.init();
  // Enabled transitions can queue a consent-time session_start; flush
  // right behind the controller's own listener (registered first, so
  // the transition is already on the gate chain) instead of waiting
  // out a full interval.
  enabledListeners.push(() => void controller.flush());

  // The cadence must never keep a quitting app's event loop alive.
  const timer = setInterval(() => void controller.flush(), FLUSH_PERIOD_MS);
  timer.unref();

  return {
    track: (event, scope) => void controller.track(event, scope),
    snapshot: () => controller.snapshot(),
    flush: () => controller.flush(),
    dispose: () => {
      clearInterval(timer);
      void controller.flush();
    },
  };
}
