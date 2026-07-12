/**
 * Request/response RPCs over the web tab's single wire — the client
 * half of the daemon's peer RPC planes. Owned bridge calls are
 * forwarded as plain frames up the existing WS wire; the server
 * answers on the standard `<type>:response` channel with `payload`
 * (success) or `__error` (thrown / gated — the daemon's in-band denies
 * ride here).
 *
 * Two planes share this correlation engine: the `oh.daemon.*` admin
 * channels (claimed by prefix) and the workbench request channels
 * `wire-requests-rpc.ts` registers explicitly. Sync/awareness RPC
 * responses are NOT claimed — they have their own consumers.
 *
 * The wire has no request ids, so correlation is BY CHANNEL and calls
 * on the same channel are serialized through a per-channel promise
 * chain — one in-flight request per channel, responses always match
 * the head. Cross-channel calls stay concurrent. A response that
 * never arrives (daemon died mid-call, socket dropped) rejects on a
 * timeout — per-call overridable, since a forwarded Send may honor a
 * long user-set request timeout — so the caller surfaces an error
 * instead of hanging.
 */

import { hostLogger as logger } from '@openheaders/core/logger';

const SCOPE = 'WireRpc';

const DEFAULT_RESPONSE_TIMEOUT_MS = 10_000;
const RESPONSE_SUFFIX = ':response';
const ADMIN_CHANNEL_PREFIX = 'oh.daemon.';

type WireSender = (frame: Record<string, unknown>) => boolean;

let sender: WireSender | null = null;

/** Wired once by `daemon-wire.ts` alongside the outbound sender. */
export function setWireRpcSender(next: WireSender): void {
  sender = next;
}

/** Channels registered beyond the admin prefix — see the module doc. */
const registeredChannels = new Set<string>();

/** Claim `<channel>:response` frames for these channels too. */
export function registerWireRpcChannels(channels: Iterable<string>): void {
  for (const channel of channels) registeredChannels.add(channel);
}

function ownsChannel(channel: string): boolean {
  return channel.startsWith(ADMIN_CHANNEL_PREFIX) || registeredChannels.has(channel);
}

interface PendingRequest {
  resolve(payload: unknown): void;
  reject(err: Error): void;
  timer: ReturnType<typeof setTimeout>;
}

/** One in-flight request per channel — see the serialization note above. */
const pendingByChannel = new Map<string, PendingRequest>();

/** Tail of each channel's serialization chain. */
const chainByChannel = new Map<string, Promise<unknown>>();

/**
 * Claim one inbound wire frame when it is the response to an in-flight
 * wire RPC. Returns `true` when claimed (settled or stale), `false`
 * for every other frame so the caller routes it onward.
 */
export function handleWireRpcResponseFrame(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object') return false;
  const frame = raw as { type?: unknown; payload?: unknown; __error?: unknown };
  if (typeof frame.type !== 'string' || !frame.type.endsWith(RESPONSE_SUFFIX)) return false;
  const channel = frame.type.slice(0, -RESPONSE_SUFFIX.length);
  if (!ownsChannel(channel)) return false;
  const pending = pendingByChannel.get(channel);
  if (!pending) {
    // A response with no waiter — a timed-out call's late answer.
    logger.debug(SCOPE, `dropping stale response for ${channel}`);
    return true;
  }
  pendingByChannel.delete(channel);
  clearTimeout(pending.timer);
  if (frame.__error !== undefined) {
    pending.reject(new Error(String(frame.__error)));
  } else {
    pending.resolve(frame.payload);
  }
  return true;
}

function sendAndAwait(message: Record<string, unknown>, channel: string, timeoutMs: number): Promise<unknown> {
  return new Promise<unknown>((resolve, reject) => {
    const send = sender;
    if (!send) {
      reject(new Error('daemon wire is not installed'));
      return;
    }
    const timer = setTimeout(() => {
      pendingByChannel.delete(channel);
      reject(new Error(`daemon did not answer ${channel}`));
    }, timeoutMs);
    pendingByChannel.set(channel, { resolve, reject, timer });
    if (!send(message)) {
      pendingByChannel.delete(channel);
      clearTimeout(timer);
      reject(new Error('daemon wire is not connected'));
    }
  });
}

/**
 * Forward one owned bridge call up the wire and await its response.
 * Rejections carry the daemon's in-band `__error` (including its
 * gating denies), a connection refusal, or the timeout.
 */
export function callWireRpc(message: Record<string, unknown>, opts?: { timeoutMs?: number }): Promise<unknown> {
  const channel = String(message.type);
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_RESPONSE_TIMEOUT_MS;
  const tail = chainByChannel.get(channel) ?? Promise.resolve();
  // Serialize behind the channel's current tail regardless of how the
  // predecessor settled — a rejected call must not wedge the channel.
  const next = tail.then(
    () => sendAndAwait(message, channel, timeoutMs),
    () => sendAndAwait(message, channel, timeoutMs),
  );
  // The chain tail swallows settle states (it only sequences); the
  // caller's handle `next` carries the real result/rejection.
  chainByChannel.set(
    channel,
    next.catch(() => undefined),
  );
  return next;
}
