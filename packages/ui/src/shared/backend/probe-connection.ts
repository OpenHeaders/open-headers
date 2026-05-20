/**
 * Probe a back-end with a one-shot WebSocket session — no shared state
 * with the live sync WebSocket.
 *
 * Two probes share one engine:
 *
 *   - {@link probeBackendConnection} — reachability + protocol
 *     handshake only. Used by the BackendPane "Test connection"
 *     button so users can verify a URL works BEFORE committing to
 *     switch back-ends.
 *   - {@link probeBackendDataPresence} — same handshake plus one
 *     follow-up `oh.sync.getDataPresence` RPC. Used by the mode-switch
 *     orchestrator's `queryPeerPresence` so the destructive-action
 *     dialog can compare data on both sides BEFORE the live WS opens.
 *     The orchestrator can't use the live SW WS for this — it might
 *     not be open yet (first-time switch from in-browser into the
 *     desktop back-end is exactly that chicken-and-egg).
 *
 * Both open a brand-new WebSocket, drive the protocol from scratch,
 * close cleanly. They never subscribe to syncBroadcast, never queue
 * pending-out, never update the status pill, never touch any mirror —
 * pure one-shot diagnostic + query channels.
 *
 * Failure modes are surfaced as discriminated unions so the UI can
 * render specific copy per cause ("protocol mismatch" vs "host
 * unreachable" vs "timeout"), instead of one opaque "could not
 * connect".
 */

import {
  type HandshakeRejectReason,
  PROTOCOL_VERSION,
  SYNC_HELLO_TYPE,
  SYNC_WELCOME_TYPE,
  type SyncHelloMessage,
  type SyncWelcomeAccept,
  SyncWelcomeMessageSchema,
} from '@openheaders/core/protocol';
import type { WorkspaceContentSnapshot } from '@openheaders/core/sync';
import type { Org } from '@openheaders/core/types';
import * as v from 'valibot';

export type ProbeFailureReason =
  | 'invalid-url'
  | 'open-failed'
  | 'protocol-mismatch'
  | 'handshake-rejected'
  | 'malformed-welcome'
  | 'malformed-response'
  | 'closed-before-welcome'
  | 'closed-before-response'
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

export type ProbeDataPresenceResult =
  | {
      ok: true;
      latencyMs: number;
      workspaces: WorkspaceContentSnapshot[];
      /**
       * The target backend's home `Org`, as carried on the WELCOME
       * (Phase U5.2). `null` when the backend's handshake omitted it.
       * The mode-switch dialog's Combine / Use-Target executors need
       * this id to re-home into / retire against the joined `Org`.
       */
      org: Org | null;
    }
  | ProbeFailure;

export interface ProbeOptions {
  /** Free-form software-version string the probe announces. Diagnostics only. */
  agent: string;
  /** Stable per-call nodeId. The probe never enters the local seen-set. */
  nodeId: string;
  /**
   * Workspace id the probe announces. For the reachability test ANY
   * id works (the server doesn't gate handshake on workspace match).
   * For the data-presence query the server returns ALL its workspaces
   * regardless of the announced id, so this is purely for diagnostics
   * on the receiver side.
   */
  workspaceId: string;
  /** Hard cap on total probe duration. Default 5_000ms. */
  timeoutMs?: number;
  /** Role to claim in HELLO. Defaults to `extension`. */
  role?: 'extension' | 'desktop' | 'cli' | 'web';
}

const DEFAULT_TIMEOUT_MS = 5_000;

/** Reachability + protocol handshake only. Used by Test connection. */
export async function probeBackendConnection(url: string, opts: ProbeOptions): Promise<ProbeConnectionResult> {
  return runProbe<ProbeConnectionResult>(url, opts, {
    onAccepted: (welcome, ctx) => ({
      ok: true,
      latencyMs: ctx.elapsedMs(),
      protocolVersion: welcome.protocolVersion,
      role: welcome.role,
      agent: welcome.agent,
    }),
  });
}

/**
 * Handshake + `oh.sync.getDataPresence` RPC. Used by the mode-switch
 * orchestrator's peer-presence query — the live SW WS is the wrong
 * transport for this question (it might not be open yet), so we open
 * a fresh one for the query and close it immediately after.
 */
export async function probeBackendDataPresence(url: string, opts: ProbeOptions): Promise<ProbeDataPresenceResult> {
  // Captured from the WELCOME so the data-presence result can carry the
  // target backend's `Org` (Phase U5.2) alongside its workspace tally —
  // the mode-switch dialog's Combine / Use-Target executors key off it.
  let welcomeOrg: Org | null = null;
  return runProbe<ProbeDataPresenceResult>(url, opts, {
    /**
     * After WELCOME accept, send the RPC frame and continue listening
     * for its `:response`. The engine wires the listener for us.
     */
    observeWelcome: (welcome) => {
      welcomeOrg = welcome.org ?? null;
    },
    nextSend: () => ({ type: 'oh.sync.getDataPresence' }),
    expectResponseType: 'oh.sync.getDataPresence:response',
    onResponse: (payload, ctx) => {
      const workspaces = (payload as { workspaces?: unknown } | null | undefined)?.workspaces;
      if (!Array.isArray(workspaces)) {
        return {
          ok: false,
          reason: 'malformed-response' as const,
          detail: 'Response missing `workspaces` array',
        };
      }
      return {
        ok: true,
        latencyMs: ctx.elapsedMs(),
        workspaces: workspaces as WorkspaceContentSnapshot[],
        org: welcomeOrg,
      };
    },
  });
}

/**
 * Run an arbitrary HELLO-gated RPC over a fresh WebSocket. Generic
 * cousin of {@link probeBackendDataPresence} — used by mode-switch
 * EXECUTORS (Coexist push, Import push) that also need to talk to the
 * peer without depending on the live SW socket. The same chicken-and-
 * egg applies: switching INTO a back-end can't rely on the live WS
 * because the live WS won't be open until the mode flips, which won't
 * happen until the executor succeeds.
 *
 * Caller supplies a typed contract (request frame + expected response
 * type + payload parser) and a long-enough timeout for the heavy
 * workspace-pushing payloads. Failures fold uniformly into
 * {@link ProbeFailure} so callers can decide whether to fallback or
 * surface to the user.
 */
export async function runBackendRpc<T>(
  url: string,
  opts: ProbeOptions,
  request: Record<string, unknown>,
  expectResponseType: string,
  parseResponse: (
    payload: unknown,
  ) => { ok: true; value: T } | { ok: false; reason: 'malformed-response'; detail?: string },
): Promise<{ ok: true; value: T } | ProbeFailure> {
  return runProbe<{ ok: true; value: T } | ProbeFailure>(url, opts, {
    nextSend: () => request,
    expectResponseType,
    onResponse: (payload) => {
      const parsed = parseResponse(payload);
      if (parsed.ok) return { ok: true, value: parsed.value };
      return { ok: false, reason: parsed.reason, detail: parsed.detail };
    },
  });
}

// ── Internal engine ───────────────────────────────────────────────────

interface ProbeContext {
  elapsedMs(): number;
}

interface AcceptOnlyContract<R> {
  onAccepted: (welcome: SyncWelcomeAccept, ctx: ProbeContext) => R;
  nextSend?: undefined;
  expectResponseType?: undefined;
  onResponse?: undefined;
}

interface FollowUpContract<R> {
  onAccepted?: undefined;
  /**
   * Optional read-only hook fired with the accepted WELCOME before the
   * follow-up RPC is sent. Lets a contract carry a handshake fact
   * (e.g. the backend's `Org`) into its `onResponse` without a second
   * round-trip. Pure observation — never settles the probe.
   */
  observeWelcome?: (welcome: SyncWelcomeAccept) => void;
  nextSend: () => Record<string, unknown>;
  expectResponseType: string;
  onResponse: (payload: unknown, ctx: ProbeContext) => R | ProbeFailure;
}

type ProbeContract<R> = AcceptOnlyContract<R> | FollowUpContract<R>;

async function runProbe<R extends { ok: boolean }>(
  url: string,
  opts: ProbeOptions,
  contract: ProbeContract<R>,
): Promise<R | ProbeFailure> {
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

  return new Promise<R | ProbeFailure>((resolve) => {
    const startedAt = performance.now();
    const ctx: ProbeContext = { elapsedMs: () => Math.round(performance.now() - startedAt) };
    let settled = false;
    let phase: 'awaiting-welcome' | 'awaiting-response' = 'awaiting-welcome';

    const settle = (result: R | ProbeFailure): void => {
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
      const detail =
        phase === 'awaiting-welcome'
          ? `No WELCOME within ${timeoutMs}ms`
          : `No ${contract.expectResponseType ?? 'response'} within ${timeoutMs}ms`;
      settle({ ok: false, reason: 'timeout', detail });
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
        // Pre-handshake pings or other noise — wait for the real frame.
        return;
      }
      if (!parsed || typeof parsed !== 'object') return;
      const type = (parsed as { type?: unknown }).type;

      if (phase === 'awaiting-welcome') {
        if (type !== SYNC_WELCOME_TYPE) return;
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
        if (contract.onAccepted) {
          settle(contract.onAccepted(welcome, ctx));
          return;
        }
        // Follow-up RPC: surface the WELCOME, then send and transition.
        contract.observeWelcome?.(welcome);
        phase = 'awaiting-response';
        try {
          socket.send(JSON.stringify(contract.nextSend()));
        } catch (err) {
          settle({
            ok: false,
            reason: 'open-failed',
            detail: err instanceof Error ? err.message : String(err),
          });
        }
        return;
      }

      // Awaiting RPC :response. Only `contract` of follow-up shape
      // lands here — guard above ensures `onResponse` is present.
      if (!contract.onResponse || !contract.expectResponseType) return;
      if (type !== contract.expectResponseType) return;
      const payload = (parsed as { payload?: unknown }).payload;
      settle(contract.onResponse(payload, ctx));
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
      const reason: ProbeFailureReason =
        phase === 'awaiting-welcome' ? 'closed-before-welcome' : 'closed-before-response';
      settle({
        ok: false,
        reason,
        detail: event.reason || `WebSocket closed with code ${event.code}`,
      });
    });
  });
}

function isValidWsUrl(url: string): boolean {
  return /^wss?:\/\//i.test(url);
}
