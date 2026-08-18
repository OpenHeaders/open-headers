/**
 * NM identity bootstrap — the extension side of the Phase 7 token
 * handoff (the observability plan §4 + §8), POLICY layer: which backends
 * get an attempt, when a record is minted, and the loop discipline. The
 * wire mechanics live in `@/shared/nm-handoff`.
 *
 * Two paths, both silent:
 *
 *   - **Fill**: a loopback backend with no credential (fresh record) or
 *     one actively evicting this peer (revoked/rotated token) gets the
 *     handoff; the minted secret is written into the record — the
 *     registry fingerprint changes, the connection manager redials,
 *     HELLO carries the new token.
 *   - **Auto-join**: no loopback record exists at all — the desktop-app
 *     scenario was never configured. One handoff is attempted at the
 *     default loopback address; a verified mint CREATES the record,
 *     enabled, token in hand. The daemon's OS-truth verification IS the
 *     probe the probe-gated-enable law demands, so the record earns its
 *     wire in the same act that proves the peer. A loopback record that
 *     already exists — even DISABLED — suppresses auto-join entirely:
 *     the user's kill switch outranks automation, and a second silent
 *     record is never minted beside a configured one.
 *
 * Both paths sit behind the `backend.nmAutoJoin` consent setting (the
 * governing off-switch, default on): off means the NM plane never
 * attempts on its own and the explicit gestures — the wizard's
 * `nmAutoPair` capability, device-flow pairing — are the only paths.
 *
 * Degraded mode (ratified S17): every failure — no NM permission
 * (the Safari manifest), no registered host (dev desktop without
 * the packed binary), a refused identity chain — leaves the existing
 * device-flow pairing gesture as the path, surfaced by the existing
 * connection UX. Nothing here retries on its own: one attempt per
 * backend per stored-token value (and one auto-join probe per SW life),
 * so a failed bootstrap never loops — the next attempt needs the stored
 * token to have changed or an SW restart.
 */

import { createBackend, getBackends, isLoopbackBackendUrl, updateBackend } from '@openheaders/core/backends';
import { WS_PORT } from '@openheaders/core/protocol';
import { get as getSetting } from '@openheaders/ui/workbench/settings/store';
import { logger } from '@utils/logger';
import { nativeMessagingAvailable, performNmHandoff, type SendNativeMessage } from '../../shared/nm-handoff';
import { peekSyncInstallId } from './sync-install-id';

const SCOPE = 'NmBootstrap';

/** Where auto-join dials when no record names an address: the desktop
 *  app's default loopback bind. */
const AUTO_JOIN_URL = `ws://127.0.0.1:${WS_PORT}`;

export interface NmBootstrapDeps {
  /** Test seam — defaults to `chrome.runtime.sendNativeMessage`. */
  readonly sendNativeMessage?: SendNativeMessage;
  /** Per-backend eviction signal (sticky auth rejection, audit X-1). */
  readonly isBackendEvicting?: (backendId: string) => boolean;
}

export type NmBootstrapBackendOutcome = 'token-written' | 'auto-joined' | 'refused' | 'unreachable' | 'error';

export interface NmBootstrapResult {
  readonly backendId: string;
  readonly outcome: NmBootstrapBackendOutcome;
}

// One attempt per backend per stored-token value (the loop guard the
// module docs describe). SW-lifetime state by design: an SW restart is
// a legitimate re-attempt.
const attemptedTokens = new Map<string, string>();

// One auto-join probe per SW life — a missing desktop stays missing
// until the next cold boot, not polled on every socket close. The
// periodic alarm below is the deliberate exception: it re-arms this
// guard on a slow cadence so "installed the desktop AFTER the
// extension" converges without waiting for an SW restart.
const AUTO_JOIN_GUARD_KEY = 'nm-auto-join';

/** Alarm identity for the periodic auto-join re-probe. */
export const NM_AUTO_JOIN_ALARM = 'nmAutoJoinProbe';

/** Slow enough that a desktop-less machine pays one tiny host spawn
 *  per tick at most; fast enough that a fresh desktop install
 *  connects "on its own" within a couple of minutes. */
export const NM_AUTO_JOIN_ALARM_PERIOD_MINUTES = 2;

export function isNmAutoJoinAlarm(alarm: chrome.alarms.Alarm): boolean {
  return alarm.name === NM_AUTO_JOIN_ALARM;
}

/**
 * Periodic auto-join tick: only worth a spawn while NO loopback record
 * exists — a joined registry (or a user-disabled record, the sacred
 * kill switch) keeps this a free no-op; the consent gate inside
 * `runNmBootstrap` still governs the attempt itself.
 */
export async function handleNmAutoJoinAlarm(): Promise<void> {
  // Its own opt-out, separate from the consent gate: a user may keep
  // boot-time auto-join while refusing periodic background checks.
  if (!getSetting('backend.nmAutoJoinProbe')) return;
  if (getBackends().some((b) => isLoopbackBackendUrl(b.url))) return;
  attemptedTokens.delete(AUTO_JOIN_GUARD_KEY);
  await runNmBootstrap();
}

export function resetNmBootstrapForTests(): void {
  attemptedTokens.clear();
}

/**
 * Attempt the NM token handoff for every loopback backend that needs a
 * credential — and, when none is configured at all, the silent
 * auto-join probe. Safe to call repeatedly (boot, socket close) — the
 * attempt guards make extra calls cheap no-ops.
 */
export async function runNmBootstrap(deps: NmBootstrapDeps = {}): Promise<NmBootstrapResult[]> {
  // The availability guard covers the real API only — browsers whose
  // manifest carries no `nativeMessaging` permission (Safari) simply
  // have no candidates to attempt.
  if (deps.sendNativeMessage === undefined && !nativeMessagingAvailable()) return [];
  // The consent gate governs the whole silent plane; explicit gestures
  // (wizard capability, device-flow pairing) don't route through here.
  if (!getSetting('backend.nmAutoJoin')) return [];
  const send = deps.sendNativeMessage;
  const isEvicting = deps.isBackendEvicting ?? (() => false);
  const results: NmBootstrapResult[] = [];
  let sawLoopbackRecord = false;
  for (const backend of getBackends()) {
    if (!isLoopbackBackendUrl(backend.url)) continue;
    sawLoopbackRecord = true;
    if (!backend.enabled) continue;
    if (backend.authToken.length > 0 && !isEvicting(backend.id)) continue;
    if (attemptedTokens.get(backend.id) === backend.authToken) continue;
    attemptedTokens.set(backend.id, backend.authToken);
    const handoff = await performNmHandoff(backend.url, peekSyncInstallId(), send);
    if (!handoff.ok) {
      logger.info(SCOPE, `bootstrap ${handoff.reason} for ${backend.url}`);
      results.push({ backendId: backend.id, outcome: handoff.reason === 'unavailable' ? 'error' : handoff.reason });
      continue;
    }
    await updateBackend(backend.id, { authToken: handoff.token });
    // The freshly written token is this backend's settled credential —
    // guard against re-attempting on the next close event racing the
    // registry watch.
    attemptedTokens.set(backend.id, handoff.token);
    logger.info(SCOPE, `nmSession token installed for ${backend.url} (${handoff.browser})`);
    results.push({ backendId: backend.id, outcome: 'token-written' });
  }

  // Auto-join: no loopback record anywhere (a disabled one counts as
  // the user's answer) and this SW life hasn't probed yet.
  if (!sawLoopbackRecord && !attemptedTokens.has(AUTO_JOIN_GUARD_KEY)) {
    attemptedTokens.set(AUTO_JOIN_GUARD_KEY, '');
    const handoff = await performNmHandoff(AUTO_JOIN_URL, peekSyncInstallId(), send);
    if (handoff.ok) {
      const record = await createBackend({ url: AUTO_JOIN_URL, authToken: handoff.token });
      // The daemon's OS-truth verification is the probe — the record
      // earns its wire in the same act that proved the peer.
      await updateBackend(record.id, { enabled: true });
      attemptedTokens.set(record.id, handoff.token);
      logger.info(SCOPE, `auto-joined the desktop app at ${AUTO_JOIN_URL} (${handoff.browser})`);
      results.push({ backendId: record.id, outcome: 'auto-joined' });
    } else {
      // Silent by design — no desktop, no verified browser, no consent
      // on the daemon side. The pairing gesture remains.
      logger.info(SCOPE, `auto-join ${handoff.reason} at ${AUTO_JOIN_URL}`);
    }
  }
  return results;
}
