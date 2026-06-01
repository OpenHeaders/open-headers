/**
 * Probe a back-end with a one-shot WebSocket session — no shared state
 * with the live sync WebSocket.
 *
 * {@link probeBackendConnection} drives the protocol handshake from
 * scratch (HELLO → WELCOME) and closes cleanly. It never subscribes to
 * syncBroadcast, never queues pending-out, never updates the status
 * pill, never touches any mirror — a pure one-shot reachability + auth
 * check. Used by the BackendPane "Test connection" button and the
 * back-end Switch gate so both verify a URL works (and this device is
 * authenticated) BEFORE committing `backend.mode`.
 *
 * Failure modes are surfaced as a discriminated union so the UI can
 * render specific copy per cause ("protocol mismatch" vs "host
 * unreachable" vs "timeout"), instead of one opaque "could not connect".
 */

import {
  type HandshakeRejectReason,
  PROTOCOL_VERSION,
  SYNC_HELLO_TYPE,
  SYNC_WELCOME_TYPE,
  type SyncHelloMessage,
  SyncWelcomeMessageSchema,
} from '@openheaders/core/protocol';
import * as v from 'valibot';

export type ProbeFailureReason =
  | 'invalid-url'
  | 'open-failed'
  | 'protocol-mismatch'
  | 'handshake-rejected'
  | 'malformed-welcome'
  | 'closed-before-welcome'
  | 'timeout';

export interface ProbeFailure {
  ok: false;
  reason: ProbeFailureReason;
  detail?: string;
  rejectReason?: HandshakeRejectReason;
}

export type ProbeConnectionResult =
  | { ok: true; latencyMs: number; protocolVersion: number; role: string; agent: string }
  | ProbeFailure;

export interface ProbeOptions {
  /** Free-form software-version string the probe announces. Diagnostics only. */
  agent: string;
  /** Stable per-call nodeId. The probe never enters the local seen-set. */
  nodeId: string;
  /**
   * Workspace id the probe announces. ANY id works for the reachability
   * test (the server doesn't gate the handshake on a workspace match),
   * so callers mint a per-probe synthetic id rather than leaking the
   * local active workspace.
   */
  workspaceId: string;
  /** Hard cap on total probe duration. Default 5_000ms. */
  timeoutMs?: number;
  /** Role to claim in HELLO. Defaults to `extension`. */
  role?: 'extension' | 'desktop' | 'cli' | 'web';
  /**
   * Long-lived daemon access token to present on the HELLO. The daemon
   * gates every HELLO on a paired token (loopback included), so a probe
   * without it is rejected `auth-required` even after the user paired —
   * the reachability test has to authenticate like the real client does.
   */
  authToken?: string;
}

const DEFAULT_TIMEOUT_MS = 5_000;

/** Reachability + protocol handshake. Used by Test connection and the Switch gate. */
export async function probeBackendConnection(url: string, opts: ProbeOptions): Promise<ProbeConnectionResult> {
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
        // Omitted from the wire when absent (JSON drops undefined) — an
        // empty/loopback-trust back-end still accepts; an authed one needs it.
        authToken: opts.authToken || undefined,
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
        // Pre-handshake pings or other noise — wait for the real frame.
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
      const welcome = validated.output;
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
      settle({
        ok: false,
        reason: 'open-failed',
        detail: 'WebSocket error before handshake completed',
      });
    });

    socket.addEventListener('close', (event) => {
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
