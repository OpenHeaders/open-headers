/**
 * The `watch` verb — the host's long-lived mode behind the extension's
 * auto-connect sentinel (AGENT_TRAFFIC_PLAN, sub-second attach). The
 * extension opens a `connectNative` port and sends one watch request;
 * this module then polls the loopback port for a listener and posts the
 * up-signal the moment the desktop app appears, so the extension dials
 * the instant the app comes up instead of waiting out its alarm floor.
 *
 * Two guards, same trust posture as bootstrap:
 *
 *   - the loopback pin — the watched address comes off the same
 *     derivation bootstrap uses, so a non-loopback URL never arms;
 *   - the listener verification seam — presence alone never signals:
 *     on the down→up transition the listener must prove it is the real
 *     desktop app (`verify-daemon.ts`) before `{up:true}` is posted. A
 *     refused listener latches quiet until presence drops and returns,
 *     so a squatter never costs more than one verification chain.
 *
 * The poll itself is a plain TCP connect (cheap, no side effects on the
 * daemon); the expensive verification runs only on transitions. A ~25s
 * heartbeat frame keeps TRAFFIC on the port — the browser's service-
 * worker lifetime rules extend on message activity, not on the port's
 * mere existence. The session ends when the port closes (stdin end
 * exits the host process); `stop()` exists for symmetry and tests.
 */

import * as net from 'node:net';
import { daemonListenAddress } from './bootstrap';

export interface WatchRequest {
  readonly url: string;
}

/** Validate the inbound NM message shape; null = not a watch request. */
export function parseWatchRequest(raw: unknown): WatchRequest | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as { kind?: unknown; url?: unknown };
  if (record.kind !== 'watch' || typeof record.url !== 'string') return null;
  return { url: record.url };
}

/** Sub-second attach is the whole point — poll well under a second. */
export const WATCH_POLL_INTERVAL_MS = 500;

/** Under the browser's ~30s service-worker idle horizon, with margin. */
export const WATCH_HEARTBEAT_INTERVAL_MS = 25_000;

const PROBE_TIMEOUT_MS = 1000;

/** One cheap listener probe: does anything accept on the loopback address? */
export function probeListening(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const socket = net.connect({ host, port });
    const settle = (listening: boolean): void => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(listening);
    };
    socket.setTimeout(PROBE_TIMEOUT_MS, () => settle(false));
    socket.once('connect', () => settle(true));
    socket.once('error', () => settle(false));
  });
}

export interface WatchDeps {
  /** Post one framed message up the NM port (stdout in the binary). */
  readonly post: (message: Record<string, unknown>) => void;
  /**
   * The listener-verification seam (`verify-daemon.ts`), wired in by
   * the binary's composition root — same contract as bootstrap's:
   * false means the process on the port is not the desktop app this
   * host shipped with, and no up-signal is posted. Absent (unit
   * seams) = not enforced.
   */
  readonly verifyListener?: (port: number) => Promise<boolean>;
  /** Probe seam — defaults to the real TCP connect. */
  readonly probe?: (host: string, port: number) => Promise<boolean>;
  /** Timer seams — swap setTimeout / clearTimeout for fake timers. */
  readonly setTimer?: (fn: () => void, ms: number) => unknown;
  readonly clearTimer?: (handle: unknown) => void;
  readonly pollIntervalMs?: number;
  readonly heartbeatIntervalMs?: number;
}

export interface WatchSession {
  stop(): void;
}

/**
 * Arm the watch loop for `request.url`. Null refuses a URL that fails
 * the loopback pin — the caller answers `bad-request` and exits.
 */
export function startWatch(request: WatchRequest, deps: WatchDeps): WatchSession | null {
  const address = daemonListenAddress(request.url);
  if (address === null) return null;
  const setTimer = deps.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = deps.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));
  const probe = deps.probe ?? probeListening;
  const pollIntervalMs = deps.pollIntervalMs ?? WATCH_POLL_INTERVAL_MS;
  const heartbeatIntervalMs = deps.heartbeatIntervalMs ?? WATCH_HEARTBEAT_INTERVAL_MS;

  let stopped = false;
  let up = false;
  // A listener that failed verification stays quiet until presence
  // drops and returns — never a verification chain per poll tick.
  let refusedListener = false;
  let pollTimer: unknown = null;
  let heartbeatTimer: unknown = null;

  const schedulePoll = (): void => {
    if (stopped) return;
    pollTimer = setTimer(() => {
      pollTimer = null;
      void tick();
    }, pollIntervalMs);
  };

  const tick = async (): Promise<void> => {
    const listening = await probe(address.host, address.port);
    if (stopped) return;
    if (!listening) {
      up = false;
      refusedListener = false;
      schedulePoll();
      return;
    }
    if (!up && !refusedListener) {
      const verified = deps.verifyListener === undefined || (await deps.verifyListener(address.port));
      if (stopped) return;
      if (verified) {
        up = true;
        deps.post({ kind: 'watch', up: true });
      } else {
        refusedListener = true;
      }
    }
    schedulePoll();
  };

  const scheduleHeartbeat = (): void => {
    if (stopped) return;
    heartbeatTimer = setTimer(() => {
      heartbeatTimer = null;
      deps.post({ kind: 'watch', heartbeat: true });
      scheduleHeartbeat();
    }, heartbeatIntervalMs);
  };

  void tick();
  scheduleHeartbeat();

  return {
    stop(): void {
      stopped = true;
      if (pollTimer !== null) clearTimer(pollTimer);
      if (heartbeatTimer !== null) clearTimer(heartbeatTimer);
      pollTimer = null;
      heartbeatTimer = null;
    },
  };
}
