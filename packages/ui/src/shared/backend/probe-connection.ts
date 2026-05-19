/**
 * Probe a back-end's reachability with a one-shot HELLO/WELCOME
 * handshake — no shared state with the live sync WebSocket.
 *
 * Used by the BackendPane "Test connection" button so users can verify
 * a URL works BEFORE committing to switch back-ends. The probe opens a
 * brand-new WebSocket, sends a single HELLO, awaits WELCOME, then
 * closes. It does not subscribe to syncBroadcast, doesn't queue
 * pending-out, doesn't update the status pill, doesn't touch any
 * mirror — it's a pure reachability + protocol-handshake check.
 *
 * Why renderer-side and not bridged through the SW: the SW's existing
 * WebSocket is the LIVE one. Adding a "probe" RPC would either share
 * the socket (defeats the no-side-effects requirement) or open a
 * second one (same complexity as just opening here). Browser
 * extensions and the workbench tab can open WS to localhost from the
 * renderer directly.
 *
 * Failure modes are surfaced as discriminated unions so the UI can
 * render specific copy per cause ("protocol mismatch" vs "host
 * unreachable" vs "timeout"), instead of one opaque "could not
 * connect".
 */

import {
  PROTOCOL_VERSION,
  SYNC_HELLO_TYPE,
  SYNC_WELCOME_TYPE,
  SyncWelcomeMessageSchema,
  type HandshakeRejectReason,
  type SyncHelloMessage,
  type SyncWelcomeMessage,
} from '@openheaders/core/protocol';
import * as v from 'valibot';

export type ProbeConnectionResult =
  | {
      ok: true;
      latencyMs: number;
      protocolVersion: number;
      role: string;
      agent: string;
    }
  | {
      ok: false;
      reason:
        | 'invalid-url'
        | 'open-failed'
        | 'protocol-mismatch'
        | 'handshake-rejected'
        | 'malformed-welcome'
        | 'closed-before-welcome'
        | 'timeout';
      /** Human-readable detail; not load-bearing for logic. */
      detail?: string;
      /** Populated when the peer returned a structured reject. */
      rejectReason?: HandshakeRejectReason;
    };

export interface ProbeConnectionOptions {
  /** Free-form software-version string the probe announces. Diagnostics only. */
  agent: string;
  /** Stable per-call nodeId. The probe never enters the local seen-set. */
  nodeId: string;
  /** Workspace id the probe asks about — peer rejects with `workspace-unknown` if it doesn't have it. */
  workspaceId: string;
  /** Hard cap on time from `new WebSocket()` to WELCOME. Default 5_000ms. */
  timeoutMs?: number;
  /** Role to claim in HELLO. Defaults to `extension`; web bundle / cli set their own. */
  role?: 'extension' | 'desktop' | 'cli' | 'web';
}

const DEFAULT_TIMEOUT_MS = 5_000;

export async function probeBackendConnection(
  url: string,
  opts: ProbeConnectionOptions,
): Promise<ProbeConnectionResult> {
  if (!isValidWsUrl(url)) {
    return { ok: false, reason: 'invalid-url', detail: `Expected ws:// or wss:// URL, got: ${url}` };
  }

  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const role = opts.role ?? 'extension';

  let socket: WebSocket;
  try {
    socket = new WebSocket(url);
  } catch (err) {
    return {
      ok: false,
      reason: 'open-failed',
      detail: err instanceof Error ? err.message : String(err),
    };
  }

  return new Promise<ProbeConnectionResult>((resolve) => {
    const startedAt = performance.now();
    let settled = false;

    const settle = (result: ProbeConnectionResult): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        socket.close(1000, 'probe-complete');
      } catch {
        /* ignore */
      }
      resolve(result);
    };

    const timer = setTimeout(() => {
      settle({ ok: false, reason: 'timeout', detail: `No WELCOME within ${timeoutMs}ms` });
    }, timeoutMs);

    socket.addEventListener('open', () => {
      const hello: SyncHelloMessage = {
        type: SYNC_HELLO_TYPE,
        protocolVersion: PROTOCOL_VERSION,
        role,
        nodeId: opts.nodeId,
        workspaceId: opts.workspaceId,
        agent: opts.agent,
      };
      try {
        socket.send(JSON.stringify(hello));
      } catch (err) {
        settle({
          ok: false,
          reason: 'open-failed',
          detail: err instanceof Error ? err.message : String(err),
        });
      }
    });

    socket.addEventListener('message', (event) => {
      if (settled) return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(typeof event.data === 'string' ? event.data : '');
      } catch {
        // Ignore unparseable frames — peer might send a ping before
        // WELCOME on some transports; we wait for the real reply.
        return;
      }
      if (!parsed || typeof parsed !== 'object') return;
      if ((parsed as { type?: unknown }).type !== SYNC_WELCOME_TYPE) return;

      const validated = v.safeParse(SyncWelcomeMessageSchema, parsed);
      if (!validated.success) {
        settle({
          ok: false,
          reason: 'malformed-welcome',
          detail: validated.issues.map((i) => i.message).join('; '),
        });
        return;
      }
      const welcome = validated.output as SyncWelcomeMessage;
      if (!welcome.accepted) {
        settle({
          ok: false,
          reason: 'handshake-rejected',
          rejectReason: welcome.reason,
          detail: welcome.detail,
        });
        return;
      }
      settle({
        ok: true,
        latencyMs: Math.round(performance.now() - startedAt),
        protocolVersion: welcome.protocolVersion,
        role: welcome.role,
        agent: welcome.agent,
      });
    });

    socket.addEventListener('error', () => {
      if (settled) return;
      settle({
        ok: false,
        reason: 'open-failed',
        detail: 'WebSocket error before handshake completed',
      });
    });

    socket.addEventListener('close', (event) => {
      if (settled) return;
      // Closed before WELCOME — typical for "nothing listening on this
      // port" (browsers fire `error` then `close` synchronously).
      settle({
        ok: false,
        reason: 'closed-before-welcome',
        detail: event.reason || `WebSocket closed with code ${event.code}`,
      });
    });
  });
}

function isValidWsUrl(url: string): boolean {
  return /^wss?:\/\//i.test(url);
}
