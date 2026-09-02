/**
 * Script runtime loop — the transport-agnostic message half of a script
 * runtime, beside the runner core (`./runner`). One runtime instance
 * owns the inbound side of the broker ⇄ runtime protocol
 * ({@link ScriptWireMessage}): it runs `script.execute` requests
 * through {@link executeScript}, matches `script.host-response`
 * replies to the `oh.*` calls awaiting them, and drops a session's
 * context on `script.session-end`. The outbound side is the injected
 * `post` — whatever the host's transport is:
 *
 *   • the extension's sandbox iframe posts to its parent document;
 *   • the desktop's Safe-mode page posts on its own window (the preload
 *     bridges to IPC);
 *   • the desktop's Developer worker rides `process.parentPort`;
 *   • the daemon's permission fork rides the fork IPC channel.
 *
 * Each runtime file is then a few lines: mint the loop with its `post`,
 * wire its transport's inbound messages to {@link ScriptRuntime.handleMessage},
 * and announce readiness once the listener is attached — never before,
 * so the broker's first execute cannot race the wiring.
 */

import type { ScriptHostRequest, ScriptHostResponse, ScriptWireMessage } from './index';
import { endScriptSession, executeScript, type ScriptRunnerDeps } from './runner';

export interface ScriptRuntime {
  /** Feed one inbound message. Anything that is not a down message of
   *  the protocol is ignored — a transport echoing its own posts, or
   *  unrelated traffic on a shared channel, is harmless. */
  handleMessage(data: unknown): void;
  /** Post `sandbox.ready` — call once the inbound listener is wired. */
  announceReady(): void;
}

export type ScriptRuntimePost = (message: ScriptWireMessage) => void;

export function createScriptRuntime(
  post: ScriptRuntimePost,
  deps: Omit<ScriptRunnerDeps, 'sendHostRequest'> = {},
): ScriptRuntime {
  // Each inbound `script.host-response` resolves the waiting promise.
  const pendingHostRpcs = new Map<string, (response: ScriptHostResponse) => void>();

  const sendHostRequest = (request: ScriptHostRequest): Promise<ScriptHostResponse> => {
    const reply = new Promise<ScriptHostResponse>((resolve) => {
      pendingHostRpcs.set(request.rpcId, resolve);
    });
    post({ type: 'script.host-request', request });
    return reply;
  };

  const runnerDeps: ScriptRunnerDeps = {
    sendHostRequest,
    ...(deps.scopeExtras ? { scopeExtras: deps.scopeExtras } : {}),
  };

  return {
    handleMessage(data) {
      const message = data as ScriptWireMessage | null | undefined;
      if (!message || typeof message !== 'object' || typeof message.type !== 'string') return;
      switch (message.type) {
        case 'script.execute':
          void executeScript(message.request, runnerDeps).then((result) => {
            post({ type: 'script.result', result });
          });
          return;
        case 'script.host-response': {
          const resolver = pendingHostRpcs.get(message.response.rpcId);
          if (resolver) {
            pendingHostRpcs.delete(message.response.rpcId);
            resolver(message.response);
          }
          return;
        }
        case 'script.session-end':
          endScriptSession(message.sessionId);
          return;
        default:
          return;
      }
    },
    announceReady() {
      post({ type: 'sandbox.ready' });
    },
  };
}
