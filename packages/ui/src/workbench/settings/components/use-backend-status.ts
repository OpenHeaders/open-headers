import { useEffect, useState } from 'react';
import type { Host } from '../../../shared/host-vocabulary';
import { getStatusSnapshot, type StatusEntry, subscribe as subscribeStatus } from '../../../shared/status';
import type { BackendMode } from '../schema/backend';
import { backendModeNeedsConnection } from '../schema/backend';

// ── Live-back-end check ────────────────────────────────────────────

/**
 * `true` when the back-end for the active mode is actually live right
 * now. Two flavors:
 *
 *   1. **Host-implicit live.** When the current host IS the back-end
 *      for the selected mode — extension on `in-browser`, desktop app
 *      on `desktop-app` — the back-end is alive by definition (the SW
 *      / desktop main is running this very code). No status check
 *      needed; we'd just be asking the host whether it's running.
 *   2. **Wire-driven live.** When the current host is a CLIENT of an
 *      external back-end (e.g. extension talking to desktop, or any
 *      host talking to a daemon / VM), liveness is whatever the `sync`
 *      Status subsystem reports — green + "Connected to back-end".
 *
 * `useSyncExternalStore` isn't used because `getStatusSnapshot()`
 * returns a fresh object every call (would trip the snapshot-stability
 * invariant and loop). A simple `useState` + manual subscription works
 * fine for a single boolean derivative.
 */
export function useBackendLive(mode: BackendMode, host: Host): boolean {
  const [live, setLive] = useState(() => computeLive(mode, host, getStatusSnapshot().sync));
  useEffect(() => {
    setLive(computeLive(mode, host, getStatusSnapshot().sync));
    return subscribeStatus(() => {
      setLive(computeLive(mode, host, getStatusSnapshot().sync));
    });
  }, [mode, host]);
  return live;
}

function isHostImplicitlyLive(mode: BackendMode, host: Host): boolean {
  if (host === 'extension' && mode === 'in-browser') return true;
  if (host === 'desktop' && mode === 'desktop-app') return true;
  return false;
}

function computeLive(mode: BackendMode, host: Host, sync: StatusEntry | undefined): boolean {
  if (isHostImplicitlyLive(mode, host)) return true;
  if (!sync) return false;
  if (sync.state !== 'green') return false;
  if (mode === 'in-browser') return sync.message === 'Running in this browser';
  return sync.message === 'Connected to back-end';
}

// ── Re-pair check (WS-A6) ──────────────────────────────────────────

/**
 * `true` when the active back-end rejected this device's saved token
 * (`auth-required`). Derived from the same `sync` Status entry
 * `useBackendLive` reads — the handshake reporter stamps the reject
 * reason into `context.reason`, so no new SW/protocol channel is needed.
 *
 * Only meaningful for client modes (the host dials an external
 * back-end). When the host IS the back-end, there's no token wire to
 * reject. Flaps with the red state during reconnect backoff, which is
 * fine: it drives a banner show/hide, not a modal.
 */
export function useBackendAuthRequired(mode: BackendMode, host: Host): boolean {
  const [authRequired, setAuthRequired] = useState(() => computeAuthRequired(mode, host, getStatusSnapshot().sync));
  useEffect(() => {
    setAuthRequired(computeAuthRequired(mode, host, getStatusSnapshot().sync));
    return subscribeStatus(() => {
      setAuthRequired(computeAuthRequired(mode, host, getStatusSnapshot().sync));
    });
  }, [mode, host]);
  return authRequired;
}

function computeAuthRequired(mode: BackendMode, host: Host, sync: StatusEntry | undefined): boolean {
  if (isHostImplicitlyLive(mode, host)) return false;
  if (!backendModeNeedsConnection(mode)) return false;
  if (!sync) return false;
  return sync.state === 'red' && sync.context?.reason === 'auth-required';
}
