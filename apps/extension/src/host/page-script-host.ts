/**
 * Page-realm script host — the workbench page's own script runtime
 * for the sessions that execute IN this page (WebSocket today, MQTT
 * with its slice). The service worker's offscreen host serves the HTTP
 * pair alone; a session's hooks fire per frame under an open socket
 * that lives in the page, so the runtime lives beside it: the
 * manifest's `sandbox.html` (unique opaque origin, `'unsafe-eval'`
 * scoped to it — the same page the offscreen document mounts) as an
 * iframe of the workbench page, driven by core's broker over a
 * postMessage transport.
 *
 * The `oh.*` host RPCs answer off the RENDERER, the scope the editor
 * publishes at Connect ({@link setPageScriptScope} — the resolution
 * factory's twin): `variables.get` through the renderer resolver's
 * full scope walk, `variables.set` through the workspace-variables
 * write client (HLC-stamped, synced, in the Activity Feed like any
 * renderer write), `vault.get` off the renderer's vault mirror (string
 * secrets — an OAuth bundle's token resolves on the node hosts),
 * `sendRequest` through the bridge to the SW's own Send pipeline, and
 * `session.send` into the page-local active-session registry as a
 * SCRIPT-origin write (captured like any ↑ frame, never re-entering
 * Before send). `oh.require` reads the workspace's Package Library off
 * the same scope.
 *
 * Firefox ships no sandbox page (no `sandbox` manifest key) and keeps
 * the HTTP posture: {@link getPageScriptHost} answers `null` there and
 * the session runs scriptless.
 */

import { hostBridge } from '@openheaders/core/bridge';
import type {
  RequestSnapshot,
  ResponseSnapshot,
  ScriptHostRequest,
  ScriptHostResponse,
  ScriptPackageModule,
  ScriptWireMessage,
} from '@openheaders/core/scripts';
import { createScriptBroker, type SandboxTransport, type ScriptBroker } from '@openheaders/core/scripts/broker';
import type { Request, Vault, WorkspaceVariables } from '@openheaders/core/types';
import { generateUid } from '@openheaders/core/utils';
import type { SessionScriptHost } from '@openheaders/oracle/live/request-exec/script-hooks';
import { sendActiveWsSessionMessage } from '@openheaders/oracle/live/ws-exec/session-plane';
import { applyWorkspaceVarSet } from '@openheaders/ui/shared/sync/workspace-variables-write-client';
import { getBrowserAPI } from '@/types/browser';

/** Activity-feed attribution for script-initiated writes. */
const PAGE_SCRIPT_HOST_SURFACE_ID = 'page-script-host';

const SANDBOX_PAGE = 'sandbox.html';

/**
 * The renderer scope a session's hooks answer against — published by
 * the editor at Connect (the resolution factory's product), read by
 * the host at each `oh.*` call. One page, one active workspace: the
 * latest Connect's scope serves every open session.
 */
export interface PageScriptScope {
  workspaceId: string | null;
  /** The renderer resolver's read of one name — the full scope walk;
   *  `null` when nothing in scope defines it. */
  resolveVariable(name: string): string | null;
  /** The workspace variables as mirrored — `variables.set` keeps an
   *  existing row's uid and type. */
  workspaceVariables: WorkspaceVariables;
  vault: Vault;
  /** The workspace's Package Library — `oh.require`'s modules. */
  packages: ScriptPackageModule[];
}

let scope: PageScriptScope | null = null;

export function setPageScriptScope(next: PageScriptScope): void {
  scope = next;
}

/** True where the manifest declares the sandbox page — Chromium. */
export function pageScriptHostAvailable(): boolean {
  const manifest = getBrowserAPI().runtime.getManifest() as { sandbox?: { pages?: string[] } };
  return manifest.sandbox?.pages?.includes(SANDBOX_PAGE) === true;
}

// ── The iframe transport ──────────────────────────────────────────

function createPageSandboxTransport(onUp: (message: unknown) => void): SandboxTransport {
  let iframe: HTMLIFrameElement | null = null;
  let ready: Promise<void> | null = null;
  let resolveReady: (() => void) | null = null;

  const listener = (event: MessageEvent): void => {
    if (iframe === null || event.source !== iframe.contentWindow) return;
    const data = event.data as ScriptWireMessage | null;
    if (!data || typeof data !== 'object') return;
    if (data.type === 'sandbox.ready') {
      resolveReady?.();
      resolveReady = null;
      return;
    }
    onUp(data);
  };

  return {
    ensureReady() {
      if (ready !== null) return ready;
      ready = new Promise<void>((resolve) => {
        resolveReady = resolve;
        window.addEventListener('message', listener);
        const element = document.createElement('iframe');
        element.src = getBrowserAPI().runtime.getURL(SANDBOX_PAGE);
        element.hidden = true;
        element.setAttribute('aria-hidden', 'true');
        element.setAttribute('data-testid', 'oh-page-script-sandbox');
        document.body.appendChild(element);
        iframe = element;
      });
      return ready;
    },
    post(message) {
      iframe?.contentWindow?.postMessage(message, '*');
    },
    close() {
      window.removeEventListener('message', listener);
      iframe?.remove();
      iframe = null;
      ready = null;
      resolveReady = null;
    },
  };
}

// ── The `oh.*` host RPCs ──────────────────────────────────────────

function okReply(request: ScriptHostRequest, value: unknown): ScriptHostResponse {
  return { executionId: request.executionId, rpcId: request.rpcId, ok: true, value };
}

function errorReply(request: ScriptHostRequest, error: string): ScriptHostResponse {
  return { executionId: request.executionId, rpcId: request.rpcId, ok: false, error };
}

function requireScope(): PageScriptScope {
  if (scope === null) throw new Error('the editor scope is not published — reopen the request and connect again');
  return scope;
}

async function writeWorkspaceVariable(name: string, value: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('oh.variables.set: empty variable name');
  const current = requireScope();
  if (current.workspaceId === null) throw new Error('oh.variables.set: no workspace to write to');
  const existing = current.workspaceVariables.variables.find((v) => v.name === trimmed);
  const result = await applyWorkspaceVarSet(
    {
      variable: {
        uid: existing?.uid ?? generateUid(),
        name: trimmed,
        value,
        type: existing?.type ?? 'default',
      },
    },
    { workspaceId: current.workspaceId, surfaceId: PAGE_SCRIPT_HOST_SURFACE_ID },
  );
  if (!result.ok) {
    const detail = result.reason === 'not-found' ? 'the workspace variables are not available' : result.message;
    throw new Error(`oh.variables.set: ${detail ?? 'the write was rejected'}`);
  }
}

function resolveVaultRef(ref: string): string | null {
  const named = requireScope().vault.secrets.find((s) => s.name === ref);
  // String-kind only — TOTP entries are request-time, an OAuth
  // bundle's token resolves on the node hosts' script host.
  return named !== undefined && named.kind === 'string' ? named.value : null;
}

async function dispatchAdHocRequest(snapshot: RequestSnapshot): Promise<ResponseSnapshot> {
  const draft: Request = {
    schemaVersion: 5,
    uid: `script-${Date.now().toString(36)}`,
    path: 'scripts/ad-hoc',
    name: 'script ad-hoc',
    method: snapshot.method,
    url: snapshot.url,
    headers: snapshot.headers.map((h) => ({ uid: generateUid(), key: h.key, value: h.value, enabled: true })),
    params: snapshot.params.map((p) => ({ uid: generateUid(), key: p.key, value: p.value, enabled: true })),
    auth: { type: 'none' },
    body: snapshot.body,
  };
  const result = await hostBridge.call('executeRequest', { draft });
  if (!result.success || !result.snapshot) throw new Error(result.error ?? 'oh.sendRequest failed');
  const response = result.snapshot;
  return {
    status: response.status,
    statusText: response.statusText,
    url: response.url,
    headers: response.headers,
    body: response.body,
    ...(response.bodyEncoding ? { bodyEncoding: response.bodyEncoding } : {}),
    durationMs: response.durationMs,
  };
}

export async function handlePageScriptHostRequest(request: ScriptHostRequest): Promise<ScriptHostResponse> {
  try {
    switch (request.op) {
      case 'variables.get':
        return okReply(request, requireScope().resolveVariable(request.name));
      case 'variables.set':
        await writeWorkspaceVariable(request.name, request.value);
        return okReply(request, null);
      case 'vault.get':
        return okReply(request, resolveVaultRef(request.ref));
      case 'sendRequest':
        return okReply(request, await dispatchAdHocRequest(request.request));
      case 'session.send':
        return okReply(
          request,
          await sendActiveWsSessionMessage(
            request.sessionId,
            request.messageText,
            request.socketio,
            request.binary,
            'script',
          ),
        );
      default: {
        const unreachable: never = request;
        return errorReply(unreachable as ScriptHostRequest, 'unknown host op');
      }
    }
  } catch (err) {
    return errorReply(request, err instanceof Error ? err.message : String(err));
  }
}

// ── The host ──────────────────────────────────────────────────────

let broker: ScriptBroker | null = null;

function pageBroker(): ScriptBroker {
  if (broker === null) {
    broker = createScriptBroker({
      createTransport: createPageSandboxTransport,
      handleHostRequest: handlePageScriptHostRequest,
      listScriptPackages: () => scope?.packages ?? [],
    });
  }
  return broker;
}

/** The session script host the page's session executors inject —
 *  `null` where the page cannot mount the sandbox (Firefox). */
export function getPageScriptHost(): SessionScriptHost | null {
  if (!pageScriptHostAvailable()) return null;
  return {
    mode: 'safe',
    run: (input) =>
      pageBroker().runScript({
        kind: input.kind,
        source: input.source,
        sessionId: input.sessionId,
        hook: input.hook,
      }),
    endSession: (sessionId) => pageBroker().endSession(sessionId),
  };
}
