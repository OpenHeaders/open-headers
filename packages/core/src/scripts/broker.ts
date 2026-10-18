/**
 * Script broker — the host-neutral owner of ONE script runtime behind a
 * {@link SandboxTransport}, and the host side of every `oh.*` RPC the
 * scripts it runs make. Every host composes one (or more) of these over
 * its own transport: the desktop's hidden sandboxed renderer and its
 * full-Node `utilityProcess` worker, the standalone daemon's
 * permission-restricted fork, the extension workbench page's sandbox
 * iframe. The runtime side of the protocol is `./runtime`.
 *
 * Lifecycle:
 *   • The runtime spawns on the first `runScript(...)` through the
 *     injected transport (concurrent callers share the spawn).
 *   • An idle timer closes it {@link IDLE_CLOSE_MS} after the last
 *     in-flight script settles AND the last open session ended; the
 *     next call respawns. A live session pins the runtime open — its
 *     `oh.session` state lives there — until the host calls
 *     `endSession` at settle.
 *
 * Security posture:
 *   • Scripts never touch storage / engine state directly — every
 *     side-effecting `oh.*` call crosses this process as a typed host
 *     RPC, answered by the injected {@link ScriptHostRequestHandler}.
 *   • `oh.variables.get` / `oh.vault.get` answer off the EXECUTION's
 *     variable scope — the resolution the send itself rode (its
 *     collection, environment, step captures, TOTP codes, live
 *     registry, files, secret-manager entries), kept host-side under
 *     the execution id and handed to the handler with each RPC; a run
 *     dispatched without one answers off the host's active-workspace
 *     mirrors. Scripts can't reach into another workspace's vault or
 *     variables either way.
 *   • Executions dispatched with `hostContext: 'chain'` (a workflow
 *     step with `runScripts: true`) get a READ-ONLY tier:
 *     `oh.sendRequest` and `oh.variables.set` are rejected — a
 *     scheduled background refresh must not send unmetered extra
 *     requests or write workspace state; the chain's sanctioned output
 *     path is captures → live variables.
 */

import { hostLogger as logger } from '../logger';
import type {
  HttpScriptKind,
  RequestSnapshot,
  ResponseSnapshot,
  ScriptExecutionRequest,
  ScriptExecutionResult,
  ScriptHostRequest,
  ScriptHostResponse,
  ScriptPackageModule,
  ScriptVariableScope,
  ScriptWireMessage,
  SessionHookInput,
  SessionScriptKind,
} from './index';

const SCOPE = 'script-broker';

const IDLE_CLOSE_MS = 30_000;
const SCRIPT_EXECUTE_TRANSPORT_TIMEOUT_MS = 60_000;

/** Broker ⇄ script runtime transport. Implementations must deliver
 *  `onUp` messages only from the runtime they own. */
export interface SandboxTransport {
  /** Spawn (or reuse) the runtime and resolve once it signaled ready. */
  ensureReady(): Promise<void>;
  /** Deliver one message into the runtime. */
  post(message: ScriptWireMessage): void;
  /** Tear the runtime down; the next `ensureReady` respawns. */
  close(reason: 'idle' | 'shutdown'): void;
}

interface RunScriptBase {
  source: string;
  timeoutMs?: number;
  /** Host-API tier — see the module doc. Default `'interactive'`. */
  hostContext?: 'interactive' | 'chain';
  /** The execution's variable scope — what `oh.variables.get` and
   *  `oh.vault.get` read; see the module doc. */
  scope?: ScriptVariableScope;
}

/** An HTTP send's one-shot script run. */
export interface RunHttpScriptOptions extends RunScriptBase {
  kind: HttpScriptKind;
  request: RequestSnapshot;
  response?: ResponseSnapshot;
}

/** One hook call of a live session — see
 *  {@link SessionScriptExecution}. The broker keeps the runtime open
 *  for the session until {@link ScriptBroker.endSession}. */
export interface RunSessionScriptOptions extends RunScriptBase {
  kind: SessionScriptKind;
  sessionId: string;
  hook: SessionHookInput;
}

export type RunScriptOptions = RunHttpScriptOptions | RunSessionScriptOptions;

/** Answers one `oh.*` host request under the execution's variable
 *  scope (`null` for a run dispatched without one). Must resolve
 *  (never throw) — the broker forwards whatever comes back straight
 *  into the runtime. */
export type ScriptHostRequestHandler = (
  request: ScriptHostRequest,
  scope: ScriptVariableScope | null,
) => Promise<ScriptHostResponse>;

/** Host ops rejected for chain-context executions. */
const CHAIN_BLOCKED_OPS = new Set<ScriptHostRequest['op']>(['sendRequest', 'variables.set']);

export interface ScriptBroker {
  runScript(opts: RunScriptOptions): Promise<ScriptExecutionResult>;
  /** The session settled: drop its runtime context and release its pin
   *  on the runtime. A session that never ran a hook is a no-op. */
  endSession(sessionId: string): void;
  /** Tear down the runtime and every timer. */
  dispose(): void;
}

export interface ScriptBrokerDeps {
  /** Wire the transport's `onUp` to the returned broker's inbound
   *  handler — `createScriptBroker` does this itself through the
   *  factory shape so the two halves can't be mis-wired. */
  createTransport: (onUp: (message: unknown) => void) => SandboxTransport;
  handleHostRequest: ScriptHostRequestHandler;
  /** Workspace script packages for `oh.require` — the host's read of
   *  the active workspace's Package Library. */
  listScriptPackages: () => ScriptPackageModule[];
}

export function createScriptBroker(deps: ScriptBrokerDeps): ScriptBroker {
  const pendingExecs = new Map<string, (result: ScriptExecutionResult) => void>();
  const chainExecutionIds = new Set<string>();
  /** The variable scope of every execution in flight that carries one. */
  const executionScopes = new Map<string, ScriptVariableScope>();
  /** Sessions that ran at least one hook — each pins the runtime open. */
  const openSessions = new Set<string>();
  let inFlight = 0;
  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  let nextExecCounter = 0;
  let disposed = false;

  const onUp = (message: unknown): void => {
    const data = message as ScriptWireMessage | { type: string } | null;
    if (!data || typeof data !== 'object' || typeof data.type !== 'string') return;

    if (data.type === 'script.result' && 'result' in data) {
      const resolver = pendingExecs.get(data.result.executionId);
      if (resolver) {
        pendingExecs.delete(data.result.executionId);
        resolver(data.result);
      }
      return;
    }

    if (data.type === 'script.host-request' && 'request' in data) {
      void answerHostRequest(data.request).then((response) => {
        transport.post({ type: 'script.host-response', response });
      });
    }
  };

  const transport = deps.createTransport(onUp);

  async function answerHostRequest(request: ScriptHostRequest): Promise<ScriptHostResponse> {
    // Chain-context gate — see the module doc.
    if (chainExecutionIds.has(request.executionId) && CHAIN_BLOCKED_OPS.has(request.op)) {
      const api = request.op === 'sendRequest' ? 'oh.sendRequest' : 'oh.variables.set';
      return {
        executionId: request.executionId,
        rpcId: request.rpcId,
        ok: false,
        error: `${api} is not available in workflow runs — step scripts are read-only (captures publish values; requests belong to steps)`,
      };
    }
    try {
      return await deps.handleHostRequest(request, executionScopes.get(request.executionId) ?? null);
    } catch (err) {
      return {
        executionId: request.executionId,
        rpcId: request.rpcId,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  function nextExecutionId(): string {
    nextExecCounter += 1;
    // Include the boot moment so two app runs can't collide via the
    // module-local counter reset.
    return `exec-${Date.now().toString(36)}-${nextExecCounter}`;
  }

  function clearIdleTimer(): void {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = null;
  }

  /** Arm the idle close when nothing runs and no session is open. */
  function settleIdle(): void {
    if (inFlight > 0 || openSessions.size > 0) return;
    clearIdleTimer();
    idleTimer = setTimeout(() => {
      idleTimer = null;
      transport.close('idle');
    }, IDLE_CLOSE_MS);
  }

  async function sendExecute(request: ScriptExecutionRequest): Promise<ScriptExecutionResult> {
    const result = new Promise<ScriptExecutionResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        pendingExecs.delete(request.executionId);
        reject(new Error(`sandbox script.execute transport timed out after ${SCRIPT_EXECUTE_TRANSPORT_TIMEOUT_MS}ms`));
      }, SCRIPT_EXECUTE_TRANSPORT_TIMEOUT_MS);
      pendingExecs.set(request.executionId, (value) => {
        clearTimeout(timer);
        resolve(value);
      });
    });
    transport.post({ type: 'script.execute', request });
    return result;
  }

  return {
    async runScript(opts: RunScriptOptions): Promise<ScriptExecutionResult> {
      if (!opts.source?.trim()) {
        // No-op source → no-op result. Saves a runtime spawn for the
        // common "no script configured" path.
        return {
          executionId: nextExecutionId(),
          succeeded: true,
          assertions: [],
          consoleLog: [],
          durationMs: 0,
        };
      }
      if (disposed) throw new Error('script broker disposed');

      await transport.ensureReady();
      clearIdleTimer();
      inFlight += 1;
      const session = 'hook' in opts;
      if (session) openSessions.add(opts.sessionId);

      const packages = deps.listScriptPackages();
      const executionId = nextExecutionId();
      const base = {
        executionId,
        source: opts.source,
        timeoutMs: opts.timeoutMs,
        packages: packages.length > 0 ? packages : undefined,
      };
      const request: ScriptExecutionRequest = session
        ? { ...base, kind: opts.kind, sessionId: opts.sessionId, hook: opts.hook }
        : { ...base, kind: opts.kind, request: opts.request, response: opts.response };

      if (opts.hostContext === 'chain') chainExecutionIds.add(executionId);
      if (opts.scope !== undefined) executionScopes.set(executionId, opts.scope);
      try {
        return await sendExecute(request);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.warn(SCOPE, `script.execute transport failed (${request.kind} ${executionId}): ${message}`);
        return {
          executionId,
          succeeded: false,
          error: { name: 'SandboxTransportError', message },
          assertions: [],
          consoleLog: [],
          durationMs: 0,
        };
      } finally {
        chainExecutionIds.delete(executionId);
        executionScopes.delete(executionId);
        inFlight -= 1;
        settleIdle();
      }
    },
    endSession(sessionId: string): void {
      if (!openSessions.delete(sessionId)) return;
      // The runtime may already be gone (a respawn since the session's
      // last hook) — the transports drop a post with no runtime, and
      // the context died with it either way.
      transport.post({ type: 'script.session-end', sessionId });
      settleIdle();
    },
    dispose(): void {
      disposed = true;
      clearIdleTimer();
      openSessions.clear();
      transport.close('shutdown');
    },
  };
}
