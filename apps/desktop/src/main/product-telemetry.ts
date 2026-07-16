/**
 * Product-telemetry host adapter for the desktop main process
 * (`TELEMETRY_PLAN.md` §7) — the persistent-process twin of the
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
import type { HostStorage } from '@openheaders/core/storage';
import { OH, wsKeys } from '@openheaders/core/storage';
import {
  bucketScale,
  createInMemoryProductTelemetrySessionStore,
  PRODUCT_TELEMETRY_ENDPOINT,
  ProductTelemetryController,
  type ProductTelemetryInstallStore,
  parseTelemetryAppVersion,
  type TelemetryChannelId,
  type TelemetryEnvelope,
  type TelemetryEvent,
  type TelemetryPlatform,
  type TelemetryTransport,
} from '@openheaders/core/telemetry';

const FLUSH_PERIOD_MS = 60_000;

export interface ProductTelemetryHostDeps {
  storage: Pick<HostStorage, 'get' | 'set' | 'remove' | 'subscribe'>;
  /** CalVer app version (`app.getVersion()`). */
  appVersion: string;
  /** `process.platform`; unmappable values skip `session_start` rather than misreport. */
  platform: NodeJS.Platform;
  /** This build's distribution channel, stamped on `first_run` (packaged = github-release; dev = unknown). */
  channel: TelemetryChannelId;
  /** Test seams; production uses the fetch transport + wall clock. */
  transport?: TelemetryTransport;
  now?: () => number;
}

export interface ProductTelemetryHandle {
  /** Record one vocabulary event (bridge RPC + main-process call sites). */
  track(event: TelemetryEvent): void;
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
 * Coarse scale-of-use for `session_start`, read from the same storage
 * the workbench writes. An empty workspace list means the keys aren't
 * in use on this install — omit the buckets rather than misreport zero.
 */
async function readScaleBuckets(
  storage: Pick<HostStorage, 'get'>,
): Promise<Pick<Extract<TelemetryEvent, { name: 'session_start' }>, 'rules' | 'workspaces'>> {
  try {
    const workspaces = (await storage.get(OH.workspaces)) ?? [];
    if (workspaces.length === 0) return {};
    const activeId = (await storage.get(OH.runtimeActive)) ?? workspaces[0]?.id;
    const rules = activeId ? ((await storage.get(wsKeys(activeId).rules)) ?? []) : [];
    return { rules: bucketScale(rules.length), workspaces: bucketScale(workspaces.length) };
  } catch {
    return {};
  }
}

async function buildSessionStart(
  platform: NodeJS.Platform,
  appVersion: string,
  storage: Pick<HostStorage, 'get'>,
): Promise<TelemetryEvent | null> {
  const mapped = telemetryPlatform(platform);
  if (!mapped) return null;
  return {
    name: 'session_start',
    host: 'desktop',
    appVersion: parseTelemetryAppVersion(appVersion),
    platform: mapped,
    locale: 'en',
    ...(await readScaleBuckets(storage)),
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
    sessionStore: createInMemoryProductTelemetrySessionStore(),
    installStore: createStorageInstallStore(deps.storage),
    channel: deps.channel,
    getEnabled: () => enabled,
    subscribeEnabled: (fn) => enabledListeners.push(fn),
    buildSessionStart: () => buildSessionStart(deps.platform, deps.appVersion, deps.storage),
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
    track: (event) => void controller.track(event),
    snapshot: () => controller.snapshot(),
    flush: () => controller.flush(),
    dispose: () => {
      clearInterval(timer);
      void controller.flush();
    },
  };
}
