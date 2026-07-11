/**
 * License refresh agent — the self-serve renewal loop
 * (LICENSING_PLAN.md §3.2). Periodically POSTs
 * `{ licenseKey, appVersion, platform }` — the whole payload, publicly
 * documented in `docs/WIRE_TRANSPARENCY.md` — to the license endpoint
 * and swaps the fresh signed file in through the slot's one write
 * path. The agent only ever delivers files; it never validates online —
 * `slot.install` re-verifies through the compiled trust ring before
 * anything persists.
 *
 * Cadence: a tick every six hours (±10 min jitter; first tick shortly
 * after boot so a long-offline host renews promptly). A tick is
 * local-only — no request leaves — unless every gate passes: a
 * `licensed`/`grace` snapshot, no `offline: true` marker, and the file
 * inside the renewal window (`validUntil − now < 30 days`; grace is
 * always inside). Transient failures (network, 5xx) need no dedicated
 * backoff — the next tick is the silent retry, per the failure ladder;
 * the grace countdown the slot already runs is the only degradation.
 *
 * A 4xx answer is a definitive refusal — the subscription lapsed — and
 * latches the agent off for the currently installed artifact, keyed by
 * `licenseId:validUntil`, so a lapsed key never hammers the endpoint.
 * The latch self-clears when a tick sees a different license installed
 * (renewed subscription, new key pasted in).
 *
 * The endpoint is a compiled-in constant, overridable only through the
 * options seam for tests — never operator config, which could redirect
 * the delivery channel (harmless for trust, since verification is
 * offline, but pointless to expose).
 */

import { logger as consoleLogger } from '@openheaders/core/utils';
import type { LicenseSlotHandle } from './license-slot';

const SCOPE = 'license-refresh';

export const LICENSE_REFRESH_ENDPOINT = 'https://license.openheaders.io/refresh';

const DAY_MS = 24 * 60 * 60 * 1000;
/** First tick waits out host startup, mirroring the update checker. */
const FIRST_TICK_DELAY_MS = 60_000;
const TICK_INTERVAL_MS = 6 * 60 * 60 * 1000;
/** ±10min so a fleet doesn't thundering-herd the endpoint. */
const TICK_JITTER_MS = 10 * 60 * 1000;
/** POST only when `validUntil − now` drops below this (45-day files renew from ~day 15). */
const RENEWAL_WINDOW_MS = 30 * DAY_MS;

export interface LicenseRefreshAgentOptions {
  slot: LicenseSlotHandle;
  appVersion: string;
  /** Payload `platform`; defaults to `process.platform`. */
  platform?: string;
  /** Test seams — production uses the real network and clock. */
  fetchFn?: typeof fetch;
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => NodeJS.Timeout;
  clearTimer?: (handle: NodeJS.Timeout) => void;
  random?: () => number;
  endpoint?: string;
}

export interface LicenseRefreshAgentHandle {
  /** One gate-checked refresh attempt (the timer's path; exposed for tests). */
  tick(): Promise<void>;
  dispose(): void;
}

export function installLicenseRefreshAgent(options: LicenseRefreshAgentOptions): LicenseRefreshAgentHandle {
  const { slot, appVersion } = options;
  const platform = options.platform ?? process.platform;
  const fetchFn = options.fetchFn ?? fetch;
  const now = options.now ?? Date.now;
  const setTimer = options.setTimer ?? setTimeout;
  const clearTimer = options.clearTimer ?? clearTimeout;
  const random = options.random ?? Math.random;
  const endpoint = options.endpoint ?? LICENSE_REFRESH_ENDPOINT;

  let timer: NodeJS.Timeout | null = null;
  let disposed = false;
  let ticking = false;
  /** `licenseId:validUntil` of an artifact the endpoint refused with 4xx. */
  let lapsedKey: string | null = null;
  // Log the outage once when it starts and the recovery once when it
  // ends — an unreachable endpoint under a 6h cadence stays quiet.
  let deliveryDown = false;

  const arm = (delayMs: number): void => {
    if (timer !== null) clearTimer(timer);
    timer = null;
    if (disposed) return;
    const jitter = Math.round((random() * 2 - 1) * TICK_JITTER_MS);
    timer = setTimer(
      () => {
        timer = null;
        void tick().finally(() => {
          if (timer === null) arm(TICK_INTERVAL_MS);
        });
      },
      Math.max(FIRST_TICK_DELAY_MS, delayMs + jitter),
    );
    timer.unref?.();
  };

  const attempt = async (licenseKey: string, installedKey: string): Promise<void> => {
    let response: Response;
    try {
      response = await fetchFn(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ licenseKey, appVersion, platform }),
      });
    } catch (err) {
      if (!deliveryDown) {
        deliveryDown = true;
        consoleLogger.warn(SCOPE, 'license endpoint unreachable — will retry on the next tick', err);
      }
      return;
    }
    if (response.status >= 400 && response.status < 500) {
      // Definitive: the subscription behind this key lapsed. Stand down
      // for this artifact; a different installed license re-arms.
      lapsedKey = installedKey;
      deliveryDown = false;
      consoleLogger.warn(
        SCOPE,
        `license endpoint refused the refresh (${response.status}) — renewal paused until a different license is installed`,
      );
      return;
    }
    if (!response.ok) {
      if (!deliveryDown) {
        deliveryDown = true;
        consoleLogger.warn(SCOPE, `license endpoint answered ${response.status} — will retry on the next tick`);
      }
      return;
    }
    if (deliveryDown) {
      deliveryDown = false;
      consoleLogger.info(SCOPE, 'license endpoint reachable again');
    }
    const fresh = (await response.text()).trim();
    const result = await slot.install(fresh, { auditAs: 'daemon.license-refresh' });
    if (result.ok) {
      consoleLogger.info(SCOPE, 'license refreshed');
    } else {
      // The endpoint answered 200 with something the ring refuses —
      // treat as transient (a control-plane bug, not a lapse) and let
      // the next tick retry.
      consoleLogger.warn(SCOPE, `license endpoint returned an artifact the host refuses: ${result.error}`);
    }
  };

  const tick = async (): Promise<void> => {
    if (disposed || ticking) return;
    ticking = true;
    try {
      const snapshot = slot.getSnapshot();
      if (snapshot.status !== 'licensed' && snapshot.status !== 'grace') return;
      if (snapshot.offline === true) return;
      const installedKey = `${snapshot.licenseId}:${snapshot.validUntil}`;
      if (lapsedKey !== null && lapsedKey !== installedKey) lapsedKey = null;
      if (lapsedKey === installedKey) return;
      if (snapshot.validUntil - now() >= RENEWAL_WINDOW_MS) return;
      const licenseKey = await slot.getInstalledText();
      if (licenseKey === null) return;
      await attempt(licenseKey, installedKey);
    } catch (err) {
      consoleLogger.warn(SCOPE, 'refresh tick failed', err);
    } finally {
      ticking = false;
    }
  };

  arm(FIRST_TICK_DELAY_MS);

  return {
    tick,
    dispose() {
      disposed = true;
      if (timer !== null) clearTimer(timer);
      timer = null;
    },
  };
}
