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
import { OH } from '@openheaders/core/storage';
import {
  createInMemoryProductTelemetrySessionStore,
  PRODUCT_TELEMETRY_ENDPOINT,
  ProductTelemetryController,
  parseTelemetryAppVersion,
  type TelemetryEnvelope,
  type TelemetryEvent,
  type TelemetryPlatform,
  type TelemetryTransport,
} from '@openheaders/core/telemetry';

const FLUSH_PERIOD_MS = 60_000;

export interface ProductTelemetryHostDeps {
  storage: Pick<HostStorage, 'get' | 'subscribe'>;
  /** CalVer app version (`app.getVersion()`). */
  appVersion: string;
  /** `process.platform`; unmappable values skip `session_start` rather than misreport. */
  platform: NodeJS.Platform;
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

function readTelemetryEnabled(values: Record<string, unknown> | undefined): boolean {
  return values?.['telemetry.enabled'] !== false;
}

function telemetryPlatform(platform: NodeJS.Platform): TelemetryPlatform | null {
  if (platform === 'darwin') return 'mac';
  if (platform === 'win32') return 'win';
  if (platform === 'linux') return 'linux';
  return null;
}

function buildSessionStart(platform: NodeJS.Platform, appVersion: string): TelemetryEvent | null {
  const mapped = telemetryPlatform(platform);
  if (!mapped) return null;
  return {
    name: 'session_start',
    host: 'desktop',
    appVersion: parseTelemetryAppVersion(appVersion),
    platform: mapped,
    locale: 'en',
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
    getEnabled: () => enabled,
    subscribeEnabled: (fn) => enabledListeners.push(fn),
    buildSessionStart: async () => buildSessionStart(deps.platform, deps.appVersion),
  });
  await controller.init();

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
