/**
 * Script broker — the host-neutral twin of the extension's
 * `offscreen-host.ts`: owner of one script runtime behind a
 * {@link SandboxTransport}, and the host side of every `oh.*` RPC the
 * scripts it runs make. The desktop wires two of these (the hidden
 * sandboxed renderer and the full-Node `utilityProcess` worker); the
 * standalone daemon wires one over its permission-restricted fork.
 *
 * Lifecycle:
 *   • Runtime spawns on first `runScript(...)` via the injected
 *     {@link SandboxTransport} (concurrent callers share the spawn).
 *   • An idle timer closes it {@link IDLE_CLOSE_MS} after the last
 *     in-flight script settles; the next call respawns.
 *
 * Security posture:
 *   • Scripts never touch storage / engine state directly — every
 *     side-effecting `oh.*` call crosses this process as a typed host
 *     RPC, answered by the injected {@link ScriptHostRequestHandler}.
 *   • Host RPCs are scoped to the ACTIVE workspace at the moment the
 *     RPC arrives — scripts can't reach into another workspace's vault
 *     or variables.
 *   • Executions dispatched with `hostContext: 'chain'` (a workflow
 *     step with `runScripts: true`) get a READ-ONLY tier:
 *     `oh.sendRequest` and `oh.variables.set` are rejected — a
 *     scheduled background refresh must not send unmetered extra
 *     requests or write workspace state; the chain's sanctioned output
 *     path is captures → live variables.
 */

import { hostLogger as logger } from '@openheaders/core/logger';
import type {
  RequestSnapshot,
  ResponseSnapshot,
  ScriptExecutionRequest,
  ScriptExecutionResult,
  ScriptHostRequest,
  ScriptHostResponse,
  ScriptKind,
  ScriptPackageModule,
} from '@openheaders/core/scripts';
import type { ScriptPackageCache } from '@openheaders/oracle/sync/caches/script-package-cache';
import { SCRIPT_PACKAGE_REGISTRATION } from '@openheaders/oracle/sync/entity-registry';
import { getActiveCacheForRegistration } from '@openheaders/oracle/sync/service';

const SCOPE = 'script-broker';

const IDLE_CLOSE_MS = 30_000;
const SCRIPT_EXECUTE_TRANSPORT_TIMEOUT_MS = 60_000;

/** Broker ⇄ script runtime transport. Implementations must deliver
 *  `onUp` messages only from the runtime they own. */
export interface SandboxTransport {
  /** Spawn (or reuse) the runtime and resolve once it signaled ready. */
  ensureReady(): Promise<void>;
  /** Deliver one message into the runtime. */
  post(message: unknown): void;
  /** Tear the runtime down; the next `ensureReady` respawns. */
  close(reason: 'idle' | 'shutdown'): void;
}

export interface RunScriptOptions {
  kind: ScriptKind;
  source: string;
  request: RequestSnapshot;
  response?: ResponseSnapshot;
  timeoutMs?: number;
  /** Host-API tier — see the module doc. Default `'interactive'`. */
  hostContext?: 'interactive' | 'chain';
}

/** Answers one `oh.*` host request. Must resolve (never throw) — the
 *  broker forwards whatever comes back straight into the runtime. */
export type ScriptHostRequestHandler = (request: ScriptHostRequest) => Promise<ScriptHostResponse>;

/** Host ops rejected for chain-context executions. */
const CHAIN_BLOCKED_OPS = new Set<ScriptHostRequest['op']>(['sendRequest', 'variables.set']);

export interface ScriptBroker {
  runScript(opts: RunScriptOptions): Promise<ScriptExecutionResult>;
  /** Tear down the runtime and every timer. */
  dispose(): void;
}

export interface ScriptBrokerDeps {
  /** Wire the transport's `onUp` to the returned broker's inbound
   *  handler — `createScriptBroker` does this itself through the
   *  factory shape so the two halves can't be mis-wired. */
  createTransport: (onUp: (message: unknown) => void) => SandboxTransport;
  handleHostRequest: ScriptHostRequestHandler;
  /** Workspace script packages for `oh.require` (active workspace).
   *  Defaults to the live sync-cache read. */
  listScriptPackages?: () => ScriptPackageModule[];
}

export function createScriptBroker(deps: ScriptBrokerDeps): ScriptBroker {
  const pendingExecs = new Map<string, (result: ScriptExecutionResult) => void>();
  const chainExecutionIds = new Set<string>();
  let inFlight = 0;
  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  let nextExecCounter = 0;
  let disposed = false;

  const listPackages = deps.listScriptPackages ?? listActiveScriptPackages;

  const onUp = (message: unknown): void => {
    const data = message as
      | { type: 'script.result'; result: ScriptExecutionResult }
      | { type: 'script.host-request'; request: ScriptHostRequest }
      | { type: string }
      | null;
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
      return await deps.handleHostRequest(request);
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

  function scheduleIdleClose(): void {
    if (idleTimer) clearTimeout(idleTimer);
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
      if (idleTimer) {
        clearTimeout(idleTimer);
        idleTimer = null;
      }
      inFlight += 1;

      const packages = listPackages();
      const executionId = nextExecutionId();
      const request: ScriptExecutionRequest = {
        executionId,
        kind: opts.kind,
        source: opts.source,
        request: opts.request,
        response: opts.response,
        timeoutMs: opts.timeoutMs,
        packages: packages.length > 0 ? packages : undefined,
      };

      if (opts.hostContext === 'chain') chainExecutionIds.add(executionId);
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
        inFlight -= 1;
        if (inFlight <= 0) scheduleIdleClose();
      }
    },
    dispose(): void {
      disposed = true;
      if (idleTimer) {
        clearTimeout(idleTimer);
        idleTimer = null;
      }
      transport.close('shutdown');
    },
  };
}

/**
 * Snapshot the ACTIVE workspace's script packages for `oh.require` —
 * same workspace posture as the host RPCs (variables / vault). Reads
 * the in-memory sync cache; an unhydrated or missing service yields
 * no packages rather than blocking the execution.
 */
function listActiveScriptPackages(): ScriptPackageModule[] {
  const cache = getActiveCacheForRegistration<ScriptPackageCache>(SCRIPT_PACKAGE_REGISTRATION);
  if (!cache) return [];
  return cache.getScriptPackages().map((p) => ({ name: p.name, source: p.source }));
}
