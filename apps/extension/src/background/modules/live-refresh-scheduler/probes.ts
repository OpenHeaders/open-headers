/**
 * Injected host probes — backend-connection (WS-C C8), backend-eviction
 * (audit X-1), and offline-fallback priority (WS-C C14) — plus the
 * cadence-ownership defer override built on them. The bootstrap installs
 * each probe via the same inversion `__setLiveRefreshAdapter` uses, so
 * the scheduler never imports the transport/settings/identity layers.
 */

import { computeDeferredFireAt } from '@openheaders/core/live';
import type { WorkflowRunCache } from '@openheaders/oracle/live/live-cache-store';

// ── Cadence ownership: backend-connection probe (WS-C C8) ─────────
//
// A peer with a connected backend defers its own cadence for any
// (workflow, env) whose value is remote-sourced, letting the backend be
// the sole runner (coherence for the idempotent class; correctness for
// the exclusive class). The scheduler must NOT import `websocket.ts` (a
// host transport concern) — instead the bootstrap injects a probe, the
// same inversion `__setLiveRefreshAdapter` uses. Until a probe is
// installed (e.g. in-browser-only mode, or tests) `isBackendConnected`
// is false and deferral is entirely off — the scheduler behaves exactly
// as a self-sufficient Mode-1 runner.
//
// The bootstrap also re-`reconcile`s on every socket open/close so the
// arm/defer choice re-evaluates the instant connectivity flips: on close
// a deferring peer drops back to its normal (earlier) cadence; on open
// it re-defers once synced values start landing (which re-stamp
// `lastSyncedValueAt`).

let backendConnectionProbe: (() => boolean) | null = null;

/**
 * Install (or clear) the backend-connection probe. The bootstrap wires
 * this to `isWebSocketConnected`; tests install a stub. `null` disables
 * deferral (no backend → self-sufficient runner).
 */
export function setBackendConnectionProbe(probe: (() => boolean) | null): void {
  backendConnectionProbe = probe;
}

export function isBackendConnected(): boolean {
  try {
    return backendConnectionProbe?.() ?? false;
  } catch {
    return false;
  }
}

// ── Eviction probe: "the backend rejected me, it isn't down" (audit X-1) ──
//
// `isBackendConnected()` is pure transport liveness — it reads false both
// when the backend is unreachable (→ legitimately fall back) AND when the
// backend is up but rejected THIS peer's revoked/rotated token
// (`auth-required`, the A-1/A-2 kill-switch: 1008 close → reconnect →
// WELCOME-reject). The offline-fallback election must NOT treat the second
// case as "offline": the desktop is alive and still owns the exclusive
// credential, so a revoked peer that self-elects would race the live
// backend (TOTP burn / rotating-OAuth reuse-detection → session revoke).
//
// The bootstrap injects this probe (wired to the handshake's sticky reject
// state via `isBackendEvictingReason`); when it returns true the offline
// gate degrades the row to the "reconnect/re-pair the desktop" banner
// instead of electing. Until a probe is installed (Mode-1, tests) the peer
// is never considered evicted — the election behaves exactly as before.

let backendEvictedProbe: (() => boolean) | null = null;

/**
 * Install (or clear) the backend-eviction probe. The bootstrap wires this
 * to a sticky read of the handshake's most-recent reject reason (true while
 * the backend has actively rejected this peer — revoked/rotated token or
 * protocol mismatch); tests install a stub. `null` disables it — the peer
 * is never treated as evicted (pure-offline election semantics).
 */
export function setBackendEvictedProbe(probe: (() => boolean) | null): void {
  backendEvictedProbe = probe;
}

export function isBackendEvicted(): boolean {
  try {
    return backendEvictedProbe?.() ?? false;
  } catch {
    return false;
  }
}

/**
 * Cadence-ownership override (WS-C C8). Given the *normal* lead-time fire
 * the core cadence math computed, decide whether this peer should instead
 * arm the later near-expiry safety fire and defer to the backend.
 *
 * Defers only a **healthy, remote-sourced** row while **connected**: a
 * row this host is failing on (circuit non-closed / `consecutiveFailures`)
 * stays on its backoff curve, and a locally-produced row (no
 * `lastSyncedValueAt`) keeps its own cadence. The deferred fire is used
 * only when it lands *later* than the normal cadence — never pull a refresh
 * earlier — so the backend (which fires at its own larger lead) gets the
 * first shot.
 *
 * A **definitionally-stale** remote-sourced row also defers here (audit
 * C-1): the cadence math would otherwise force it fire-ASAP, but a
 * connected peer cannot produce the corrected value itself — it must wait
 * for the backend to re-mint against the new recipe and push it over §4
 * (which clears the flag in `applySyncedLiveValues`). Firing ASAP would
 * just hit the connected-peer gate and re-arm at the 30s floor forever — a
 * battery hot-loop. A non-connected peer never reaches this branch
 * (early-return below), so a Mode-1 / offline stale row still fires-ASAP
 * and self-corrects locally.
 */
export function applyDeferOverride(
  cache: WorkflowRunCache | null,
  normalFireAt: number | null,
  nowMs: number,
): number | null {
  if (normalFireAt == null) return normalFireAt; // manual / unschedulable — never defer
  if (!isBackendConnected()) return normalFireAt;
  if (!cache || cache.lastSyncedValueAt == null || cache.expiresAt == null) return normalFireAt;
  if (cache.consecutiveFailures > 0) return normalFireAt;
  if (cache.circuit && cache.circuit.state !== 'closed') return normalFireAt;
  const deferred = computeDeferredFireAt(cache.expiresAt, nowMs);
  return deferred > normalFireAt ? deferred : normalFireAt;
}

// ── Offline fallback: priority probe (WS-C C14) ───────────────────
//
// When a configured backend goes OFFLINE, an *exclusive* workflow may be
// refreshed by exactly one host across the now-partitioned browsers (a
// concurrent run burns the single-use cred). Each peer decides locally
// from its frozen, last-synced priority list + its own seed eligibility
// (`electOfflineFallbackRunner`). The per-workspace list + this host's identity come
// from the synced `live-fallback-priority` entity + the auto-seed;
// the scheduler reaches them through this injected probe — the same
// inversion `setBackendConnectionProbe` uses, so the scheduler never
// imports the backend-settings or identity layers.
//
// The probe's RETURN encodes "is a backend configured at all":
//   • `null`  → pure Mode-1 (no backend ever attached). The SW is the
//     legitimate sole runner and self-refreshes every class, exclusive
//     included (plan §8 non-goal — Mode-1 keeps its self-sufficient
//     runner). The C14 gate stays entirely off.
//   • non-null → a backend is configured (currently offline). The gate
//     engages for the exclusive class: only the elected host self-refreshes.
//     An empty `order` is the SAFE default — nobody is elected, so every
//     peer banners rather than racing (`no-list`).

export interface FallbackPrioritySnapshot {
  /** Frozen last-synced priority order — ordered `Principal.id`s. Empty when no host has enlisted yet (safe `no-list`). */
  order: readonly string[];
  /** This host's stable `Principal.id` (derived from `hostInstallId`), or null if not yet known. */
  selfPrincipalId: string | null;
}

let fallbackPriorityProbe: ((workspaceId: string) => FallbackPrioritySnapshot | null) | null = null;

/**
 * Install (or clear) the offline-fallback priority probe. The bootstrap
 * wires this to the configured backend's frozen priority list + this
 * host's identity; tests install a stub. The list is per-workspace, so
 * the probe takes the dispatching entry's `workspaceId`. `null` (or a
 * probe returning `null`) disables the gate — pure Mode-1 self-refreshes
 * every class.
 */
export function setFallbackPriorityProbe(
  probe: ((workspaceId: string) => FallbackPrioritySnapshot | null) | null,
): void {
  fallbackPriorityProbe = probe;
}

export function readFallbackPriority(workspaceId: string): FallbackPrioritySnapshot | null {
  try {
    return fallbackPriorityProbe?.(workspaceId) ?? null;
  } catch {
    return null;
  }
}
