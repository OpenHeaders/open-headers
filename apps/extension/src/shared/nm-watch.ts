/**
 * NM watch — the wire mechanics of the long-lived watch port to the
 * desktop's native-messaging host (the auto-connect sentinel's other
 * half; the one-shot handoff wire lives in `nm-handoff.ts`). Context-
 * neutral by design, same split as the handoff: this module opens the
 * `chrome.runtime.connectNative` port, sends the watch request, and
 * surfaces the host's up-signal and the port's death — WHEN to arm,
 * what to dial, and how to react is the caller's policy, not this
 * module's.
 *
 * The host heartbeats over the port (~25s) so the message TRAFFIC —
 * not the port's mere existence — keeps the service worker alive while
 * it waits; heartbeat frames are absorbed here.
 */

import { NM_HOST_NAME } from './nm-handoff';

export function nativeWatchAvailable(): boolean {
  return typeof chrome !== 'undefined' && typeof chrome.runtime?.connectNative === 'function';
}

/** The slice of `chrome.runtime.Port` the watch wire rides — the test-fake surface. */
export interface NmWatchPort {
  postMessage(message: Record<string, unknown>): void;
  disconnect(): void;
  onMessage: { addListener(callback: (message: unknown) => void): void };
  onDisconnect: { addListener(callback: () => void): void };
}

export type ConnectNative = (host: string) => NmWatchPort;

export const defaultConnectNative: ConnectNative = (host) => chrome.runtime.connectNative(host);

export interface NmWatchHooks {
  /** The verified desktop app appeared on the watched loopback address. */
  onUp(): void;
  /**
   * The port closed on its own — host exited, crashed, or (an outdated
   * host build) answered one frame and quit. Never fired for a
   * caller-initiated `disconnect()`. `detail` carries the platform's
   * close reason ("Native host has exited.") when it names one.
   */
  onDisconnect(detail?: string): void;
}

export interface NmWatchHandle {
  disconnect(): void;
}

/**
 * Open one watch port for `url` (the loopback backend's WebSocket URL;
 * the host pins it loopback-only by construction). Null when the port
 * cannot even be constructed — no NM plane at all.
 */
export function openNmWatch(
  url: string,
  hooks: NmWatchHooks,
  connect: ConnectNative = defaultConnectNative,
): NmWatchHandle | null {
  let port: NmWatchPort;
  try {
    port = connect(NM_HOST_NAME);
  } catch {
    return null;
  }
  let closed = false;
  port.onMessage.addListener((message) => {
    if (closed) return;
    if (message && typeof message === 'object' && (message as { up?: unknown }).up === true) hooks.onUp();
  });
  port.onDisconnect.addListener(() => {
    // The error must be READ during this dispatch or Chrome logs
    // "Unchecked runtime.lastError: Native host has exited" on the
    // extension's Errors page, once per sentinel retry. Read it into
    // the hook's detail — a bare `void`-read is tree-shaken out of
    // the bundle as side-effect-free, which un-checks it again.
    const lastError = typeof chrome !== 'undefined' ? chrome.runtime?.lastError : undefined;
    if (closed) return;
    closed = true;
    hooks.onDisconnect(lastError?.message);
  });
  port.postMessage({ kind: 'watch', url });
  return {
    disconnect(): void {
      if (closed) return;
      closed = true;
      port.disconnect();
    },
  };
}
