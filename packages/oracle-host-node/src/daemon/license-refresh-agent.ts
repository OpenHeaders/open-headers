/**
 * License refresh agent — the self-serve renewal loop
 * (the licensing plan §3.2). Periodically POSTs
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
 * Personal-seat artifacts attached to directory users (admission
 * provenance) renew on the same ticks, beside the daemon's own file:
 * same gates, same wire payload, same 4xx latch — keyed per licenseId,
 * self-clearing when the stored artifact changes. A renewed artifact
 * is re-verified against the compiled ring and swapped onto the user
 * record; a post-admission lapse only stops renewing (the provenance
 * surfaces in the admin console) — it never evicts the user.
 *
 * The endpoint is a compiled-in constant, overridable only through the
 * options seam for tests — never operator config, which could redirect
 * the delivery channel (harmless for trust, since verification is
 * offline, but pointless to expose).
 */

import {
  emitAuditEntry,
  getIdentitySnapshot,
  listDaemonUsers,
  replacePersonalSeatArtifact,
} from '@openheaders/core/identity';
import { LICENSE_PUBLIC_KEYS, type LicenseKeyRing, verifyLicense } from '@openheaders/core/licensing';
import { logger as consoleLogger } from '@openheaders/core/utils';
import type { RequestTransport, TransportResponse } from '@openheaders/oracle/live/request-exec/transport';
import { createNodeRequestTransport } from '../live/node-request-transport';
import type { LicenseSlotHandle } from './license-slot';

const SCOPE = 'license-refresh';

export const LICENSE_REFRESH_ENDPOINT = 'https://license.openheaders.com/refresh';

/** A signed license file is a few KiB — the cap bounds a hostile answer. */
const MAX_RESPONSE_BODY_BYTES = 256 * 1024;

const nodeTransport = createNodeRequestTransport();

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
  /** Personal-seat renewal seams — default to the live directory. */
  listUsers?: typeof listDaemonUsers;
  replaceArtifact?: typeof replacePersonalSeatArtifact;
  /** Test seam — trust ring for user-attached artifacts; production verifies against the compiled ring. */
  ring?: LicenseKeyRing;
  /** Test seams — production uses the real network (the module's node
   *  transport, which rides the system-proxy plane) and clock. */
  transport?: RequestTransport;
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

type RefreshOutcome = { kind: 'fresh'; text: string } | { kind: 'lapsed'; status: number } | { kind: 'transient' };

export function installLicenseRefreshAgent(options: LicenseRefreshAgentOptions): LicenseRefreshAgentHandle {
  const { slot, appVersion } = options;
  const platform = options.platform ?? process.platform;
  const listUsers = options.listUsers ?? listDaemonUsers;
  const replaceArtifact = options.replaceArtifact ?? replacePersonalSeatArtifact;
  const ring = options.ring ?? LICENSE_PUBLIC_KEYS;
  const transport = options.transport ?? nodeTransport;
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
  /** Personal-seat latches — licenseId → the `licenseId:validUntil` refused with 4xx. */
  const personalLapsed = new Map<string, string>();
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

  /** One wire round-trip; owns the once-per-outage delivery logging. */
  const postRefresh = async (licenseKey: string): Promise<RefreshOutcome> => {
    let response: TransportResponse;
    try {
      response = await transport.send({
        method: 'POST',
        url: endpoint,
        headers: [{ key: 'content-type', value: 'application/json' }],
        body: { kind: 'raw', content: JSON.stringify({ licenseKey, appVersion, platform }) },
        redirect: 'follow',
        credentials: 'omit',
        maxBodyBytes: MAX_RESPONSE_BODY_BYTES,
      });
    } catch (err) {
      if (!deliveryDown) {
        deliveryDown = true;
        consoleLogger.warn(SCOPE, 'license endpoint unreachable — will retry on the next tick', err);
      }
      return { kind: 'transient' };
    }
    if (response.status >= 400 && response.status < 500) {
      deliveryDown = false;
      return { kind: 'lapsed', status: response.status };
    }
    if (response.status < 200 || response.status >= 300) {
      if (!deliveryDown) {
        deliveryDown = true;
        consoleLogger.warn(SCOPE, `license endpoint answered ${response.status} — will retry on the next tick`);
      }
      return { kind: 'transient' };
    }
    if (deliveryDown) {
      deliveryDown = false;
      consoleLogger.info(SCOPE, 'license endpoint reachable again');
    }
    return { kind: 'fresh', text: response.body.trim() };
  };

  const attempt = async (licenseKey: string, installedKey: string): Promise<void> => {
    const outcome = await postRefresh(licenseKey);
    if (outcome.kind === 'lapsed') {
      // Definitive: the subscription behind this key lapsed. Stand down
      // for this artifact; a different installed license re-arms.
      lapsedKey = installedKey;
      consoleLogger.warn(
        SCOPE,
        `license endpoint refused the refresh (${outcome.status}) — renewal paused until a different license is installed`,
      );
      return;
    }
    if (outcome.kind === 'transient') return;
    const result = await slot.install(outcome.text, { auditAs: 'daemon.license-refresh' });
    if (result.ok) {
      consoleLogger.info(SCOPE, 'license refreshed');
    } else {
      // The endpoint answered 200 with something the ring refuses —
      // treat as transient (a control-plane bug, not a lapse) and let
      // the next tick retry.
      consoleLogger.warn(SCOPE, `license endpoint returned an artifact the host refuses: ${result.error}`);
    }
  };

  const renewSlot = async (): Promise<void> => {
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
  };

  /**
   * Renew the personal-seat artifacts riding active directory records
   * — the daemon's own gates applied per licenseId: licensed inside
   * the window or in grace renews; expired/invalid stands down until
   * the stored artifact changes (a fresh key redeemed or absorbed).
   */
  const renewPersonal = async (): Promise<void> => {
    let users: Awaited<ReturnType<typeof listUsers>>;
    try {
      users = await listUsers();
    } catch {
      // No readable directory on this host (storage not wired) — the
      // next tick retries; nothing to renew meanwhile.
      return;
    }
    const byLicense = new Map<string, string>();
    for (const record of users) {
      if (record.deactivatedAt !== null || record.admission === undefined) continue;
      if (!byLicense.has(record.admission.licenseId)) {
        byLicense.set(record.admission.licenseId, record.admission.licenseKey);
      }
    }
    for (const [licenseId, licenseKey] of byLicense) {
      const verified = await verifyLicense(licenseKey, new Date(now()), ring);
      if (verified.status !== 'licensed' && verified.status !== 'grace') continue;
      if (verified.license.offline === true) continue;
      const artifactKey = `${licenseId}:${verified.license.validUntil}`;
      const latched = personalLapsed.get(licenseId);
      if (latched !== undefined && latched !== artifactKey) personalLapsed.delete(licenseId);
      if (personalLapsed.get(licenseId) === artifactKey) continue;
      if (verified.status === 'licensed' && verified.license.validUntil - now() >= RENEWAL_WINDOW_MS) continue;
      const outcome = await postRefresh(licenseKey);
      if (outcome.kind === 'lapsed') {
        personalLapsed.set(licenseId, artifactKey);
        consoleLogger.warn(
          SCOPE,
          `license endpoint refused personal-seat refresh for ${licenseId} (${outcome.status}) — renewal paused until its artifact changes`,
        );
        continue;
      }
      if (outcome.kind === 'transient') continue;
      const fresh = await verifyLicense(outcome.text, new Date(now()), ring);
      if (fresh.status !== 'licensed' && fresh.status !== 'grace') {
        consoleLogger.warn(
          SCOPE,
          `license endpoint returned an individual-seat artifact the host refuses (${licenseId})`,
        );
        continue;
      }
      if (fresh.license.licenseId !== licenseId) {
        consoleLogger.warn(SCOPE, `license endpoint answered a different lineage for ${licenseId} — ignored`);
        continue;
      }
      const changed = await replaceArtifact(licenseId, outcome.text);
      if (changed > 0) {
        emitAuditEntry({
          actorUserId: getIdentitySnapshot()?.user.id ?? 'operator',
          capability: 'daemon.license-refresh',
          decision: { allow: true },
        });
        consoleLogger.info(SCOPE, `individual seat ${licenseId} refreshed (${changed} record)`);
      }
    }
  };

  const tick = async (): Promise<void> => {
    if (disposed || ticking) return;
    ticking = true;
    try {
      await renewSlot();
      await renewPersonal();
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
