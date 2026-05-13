/**
 * TOTP scheduler — keeps a `TotpRegistry` mirror warm for the DNR
 * compile pipeline AND ticks the rule engine at each window-flip so
 * the codes baked into static rules never go stale by more than the
 * `period` of the soonest-expiring entry.
 *
 * Why ticks: a `{{vault.X}}` reference inside a header rule resolves
 * at DNR compile time. Chrome stores the compiled ruleset until the
 * next compile and fires it on every matching webRequest. Without a
 * periodic recompile, a code minted at second 0 is still firing at
 * second 35 — past its window — and the provider 401s. Ticking on
 * window-flip keeps the baked code current.
 *
 * Mirror pattern: module-level `cachedTotpCodes` map, refreshed on
 * the alarm fire AND on every `onEnvironmentStoreChange` (covers
 * vault edits — adding a TOTP entry, rotating a seed, deleting an
 * entry). The DNR compile path (`variables-resolver.syncResolverFromStores`)
 * reads `getCachedTotpCodes()` synchronously — async crypto stays
 * out of the resolver's hot path.
 *
 * Alarm cadence: a single one-shot alarm scheduled at the next
 * window-flip of the soonest-expiring TOTP entry. After it fires we
 * recompute codes, signal a recompile via the injected callback, and
 * schedule the next one-shot. No tick is scheduled when the vault
 * holds zero TOTP entries — purely event-driven from there.
 *
 * Chrome MV3 minimum: `chrome.alarms` accepts down to ~30s in stable
 * builds. TOTP standard period is 30s — at the boundary but works.
 * Periods <30s would need a different transport; the schema clamps to
 * `period >= 1` but the UI defaults to 30, so this is a non-issue in
 * practice.
 */

import { generateTotp } from '@openheaders/core/totp';
import type { Vault, VaultSecretTotp } from '@openheaders/core/types';
import { EMPTY_TOTP_REGISTRY, type TotpRegistry } from '@openheaders/core/variables';
import { logger } from '@utils/logger';
import { getVault, onEnvironmentStoreChange } from './environment-store';

const ALARM_NAME = 'oh-totp-tick';
/** Guardband added to the next window-flip — schedule slightly AFTER
 *  the flip so the recomputed code reflects the new window, not the
 *  one we're leaving. */
const FLIP_GUARDBAND_MS = 250;

let cachedCodes: TotpRegistry = EMPTY_TOTP_REGISTRY;
let onTickRef: (() => void) | null = null;
let _scheduled = false;

/**
 * Sync read of the current TOTP code mirror. Returns
 * {@link EMPTY_TOTP_REGISTRY} until {@link bootstrapTotpScheduler} has
 * had its first refresh land. The DNR compile path reads from here on
 * every `syncResolverFromStores` call.
 */
export function getCachedTotpCodes(): TotpRegistry {
  return cachedCodes;
}

function totpEntries(vault: Vault): VaultSecretTotp[] {
  return vault.secrets.filter((s): s is VaultSecretTotp => s.kind === 'totp');
}

/**
 * Recompute the cache from the current vault. Called from three
 * places: bootstrap, the alarm tick, and the compile-path's
 * {@link refreshCachedTotpCodes} pre-resolve hook.
 *
 * Exposed as {@link refreshCachedTotpCodes} so the DNR compile path
 * can `await` a fresh cache before reading it. Without that hook the
 * compile would race the listener-driven refresh: a vault edit fires
 * `onEnvironmentStoreChange`, which triggers BOTH `scheduleUpdate('vars',
 * { immediate: true })` (bypasses debounce → compile runs now) AND
 * this scheduler's async listener — the compile would read the
 * pre-refresh cache. Awaiting in `rebuildAll` removes that race.
 *
 * One `Promise.all` batch — N TOTP entries pay N concurrent
 * `crypto.subtle.sign` calls, not N serial waits.
 */
async function rebuildCodes(): Promise<void> {
  const entries = totpEntries(getVault());
  if (entries.length === 0) {
    cachedCodes = EMPTY_TOTP_REGISTRY;
    return;
  }
  const next = new Map<string, string>();
  const results = await Promise.all(
    entries.map(async (e) => {
      try {
        const code = await generateTotp({
          seed: e.seed,
          algorithm: e.algorithm,
          digits: e.digits,
          period: e.period,
        });
        return [e.name, code] as const;
      } catch (err) {
        logger.info('TotpScheduler', `failed to compute code for '${e.name}': ${(err as Error).message}`);
        return null;
      }
    }),
  );
  for (const r of results) if (r) next.set(r[0], r[1]);
  cachedCodes = next;
}

/**
 * Wall-clock ms of the next window-flip across every TOTP entry —
 * the soonest moment any cached code becomes stale. Returns Infinity
 * when the vault holds zero TOTP entries.
 */
function nextFlipMs(nowMs: number = Date.now()): number {
  const entries = totpEntries(getVault());
  if (entries.length === 0) return Infinity;
  let nextFlip = Infinity;
  const seconds = Math.floor(nowMs / 1000);
  for (const e of entries) {
    const flipSeconds = seconds + (e.period - (seconds % e.period));
    const flipMs = flipSeconds * 1000;
    if (flipMs < nextFlip) nextFlip = flipMs;
  }
  return nextFlip;
}

async function clearAlarm(): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.alarms) return;
  await chrome.alarms.clear(ALARM_NAME).catch(() => false);
}

async function scheduleNextFlip(): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.alarms) return;
  await clearAlarm();
  const nowMs = Date.now();
  const flip = nextFlipMs(nowMs);
  if (flip === Infinity) {
    _scheduled = false;
    return;
  }
  // Schedule at the next window-flip + a small guardband so the
  // alarm fires just AFTER the new window starts (not before, which
  // would re-compute the previous-window code).
  //
  // `when:` is absolute wall-clock ms. Chrome's per-extension minimum
  // alarm cadence (~30s on Web Store production builds, effectively
  // 0 on unpacked/dev) applies as a clamp — when it kicks in we accept
  // up to that much staleness; webNavigation-driven recompiles
  // (see `kickRecompileIfStale`) cover the gap. Using `when:` instead
  // of `delayInMinutes` lets dev/unpacked builds fire at the precise
  // window-flip moment without our own code adding artificial floor.
  const fireAt = flip + FLIP_GUARDBAND_MS;
  chrome.alarms.create(ALARM_NAME, { when: fireAt });
  _scheduled = true;
}

/**
 * Recognize the TOTP scheduler's alarm so background.ts can route the
 * fire to {@link handleTotpAlarm} without leaking the alarm name.
 */
export function isTotpAlarm(alarm: chrome.alarms.Alarm): boolean {
  return alarm?.name === ALARM_NAME;
}

/**
 * Recompute codes + signal a DNR recompile. Background.ts calls this
 * from its `chrome.alarms.onAlarm` listener when the alarm name
 * matches {@link isTotpAlarm}. Schedules the next flip after the
 * recompile signal lands.
 */
export async function handleTotpAlarm(): Promise<void> {
  await rebuildCodes();
  onTickRef?.();
  await scheduleNextFlip();
}

/**
 * Refresh the cache from the current vault. The DNR compile path
 * (`rebuildAll` in dnr-manager) awaits this BEFORE resolving rules so
 * the resolver always reads current codes — same architectural slot
 * as `kickSyncWarmRefreshes` for live-variable sync-warm.
 *
 * Exported so the compile path can call it directly; bootstrap + the
 * alarm tick share the same internal `rebuildCodes`.
 */
export async function refreshCachedTotpCodes(): Promise<void> {
  await rebuildCodes();
}

/**
 * Bootstrap from `background.ts`. Call once at SW boot AFTER
 * `hydrateEnvironmentsFromStorage` has populated the vault snapshot.
 *
 * `onTick` is invoked after a successful alarm-driven refresh — pass
 * `() => scheduleUpdate('totp', { immediate: true })` so the rule
 * engine recompiles DNR. (Vault-edit-driven recompiles already happen
 * via `background.ts`'s `onEnvironmentStoreChange` listener calling
 * `scheduleUpdate('vars')`; the compile-path's `refreshCachedTotpCodes`
 * await ensures the cache is fresh by the time the resolver reads it.)
 */
export async function bootstrapTotpScheduler(onTick: () => void): Promise<void> {
  onTickRef = onTick;
  await rebuildCodes();
  await scheduleNextFlip();
  // Reschedule the next flip whenever the vault changes — adding,
  // removing, or rotating a TOTP entry can change the soonest
  // window-flip across all entries. We do NOT need to call onTick()
  // here: background.ts's existing `onEnvironmentStoreChange` listener
  // already fires `scheduleUpdate('vars')`, and the compile-path's
  // `refreshCachedTotpCodes()` await guarantees a fresh cache by the
  // time `rebuildAll` reaches the resolver.
  onEnvironmentStoreChange(() => {
    void scheduleNextFlip();
  });
}

// ── Test helpers ───────────────────────────────────────────────────

/** Test-only: reset module state so each test starts clean. */
export function __resetForTests(): void {
  cachedCodes = EMPTY_TOTP_REGISTRY;
  onTickRef = null;
  _scheduled = false;
}
