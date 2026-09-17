/**
 * `oh.*` host-RPC servicing for sandboxed scripts — ONE host-neutral
 * answer for every host whose scripts run against the ORACLE MIRRORS:
 * the desktop app and the standalone daemon (their node runtimes) and
 * the served web tab (its sandbox iframe). The extension's workbench
 * page is the one host that answers off a renderer scope instead
 * (its page has empty mirrors — `page-script-host.ts` there). Every
 * op resolves against the ACTIVE workspace's stores at the moment the
 * RPC arrives, exactly the extension's posture:
 *
 *   • `variables.get(name)`  — full resolver walk (vault > env >
 *     collection > workspace, `{{live.*}}`, `{{step.*}}` excluded —
 *     no step context on an ad-hoc resolve).
 *   • `variables.set(name, value)` — writes the `workspace` scope
 *     through the canonical apply path (`applySyncRequest`), so the
 *     mutation is HLC-stamped, persisted, broadcast to renderers and
 *     WS peers, and classified into the Activity Feed with a working
 *     Revert — same discipline as MCP writes.
 *   • `vault.get(ref)`       — named string secret, else an OAuth
 *     bundle's access token.
 *   • `sendRequest(request)` — an ad-hoc draft through the host's own
 *     workbench-Send pipeline (the seam's `sendRequest`), sharing its
 *     transport, dispatcher cache and cookie jars. The draft carries no
 *     scripts, so this cannot recurse.
 *   • `session.send(...)`  — a session hook's `oh.send` / `oh.emit` /
 *     `oh.sendBinary` into ITS open WebSocket session, through the
 *     active-session registry as a SCRIPT-origin write: captured and
 *     broadcast like any ↑ frame, never re-entering Before send.
 *   • `session.publish(...)` — the MQTT twin: an On message hook's
 *     `oh.publish` into its own session through the publish rider as a
 *     script-origin write, never re-entering Before publish.
 *
 * The host contributes only its seam ({@link ScriptHostSeam}): the
 * request transport the vault-ref OAuth refresh leg rides (the same
 * seam every send rides, so the host's proxy and trust planes cover
 * it) and the Send pipeline an ad-hoc request goes through. The
 * handler always resolves with a `ScriptHostResponse` — never throws
 * — so the broker forwards it back to the runtime without extra
 * handling.
 */

import { isExpired as isOAuthTokenExpired } from '@openheaders/core/oauth';
import type {
  RequestSnapshot,
  ResponseSnapshot,
  ScriptHostRequest,
  ScriptHostResponse,
} from '@openheaders/core/scripts';
import { computeInverseSpec } from '@openheaders/core/sync';
import { buildSetWorkspaceVarBatch } from '@openheaders/core/sync-builders/mutations/workspace-variables-mutations';
import type { ExecutedRequestSnapshot, Request } from '@openheaders/core/types';
import { generateUid } from '@openheaders/core/utils';
import { resolveTemplate, VariableResolver } from '@openheaders/core/variables';
import {
  getActiveEnvironmentId,
  getDefaultEnvironmentId,
  getEnvironments,
  getVault,
  getWorkspaceVariables,
} from '../../entity/environment-store';
import {
  getRefreshConfig as getOAuthRefreshConfig,
  getTokenBundle as getOAuthTokenBundle,
} from '../../entity/oauth-token-store';
import { getRequestCollections } from '../../entity/request-store';
import { getCollections as getRuleCollections } from '../../entity/rule-store';
import { makeOracleInverseAccess, rememberPriorForMutation } from '../../sync';
import { applySyncRequest, getOracleForWorkspace, nextSwMutatorContext } from '../../sync/service';
import { publishActiveMqttMessage, scriptPublishToWire } from '../mqtt-exec/session-plane';
import { buildRefreshOAuthHook } from '../request-exec/oauth-refresh';
import type { RequestTransport } from '../request-exec/transport';
import { sendActiveWsSessionMessage } from '../ws-exec/session-plane';

/** Activity-feed attribution for script-initiated writes. */
const SCRIPT_HOST_SURFACE_ID = 'script-host';

/** The workbench Send's answer, as every host's route resolves it. */
export interface ScriptHostSendResult {
  success: boolean;
  snapshot?: ExecutedRequestSnapshot;
  error?: string;
}

/** What a host contributes to the `oh.*` servicing — see the module doc. */
export interface ScriptHostSeam {
  /** Egress for the vault-ref OAuth refresh leg — the transport the
   *  host's own sends ride. */
  refreshTransport: RequestTransport;
  /** The host's workbench-Send pipeline for an ad-hoc draft. */
  sendRequest(draft: Request): Promise<ScriptHostSendResult>;
}

/** The `oh.*` handler over one host's seam — the broker's `handleHostRequest`. */
export function createScriptHostRequestHandler(
  seam: ScriptHostSeam,
): (request: ScriptHostRequest) => Promise<ScriptHostResponse> {
  return (request) => handleScriptHostRequest(request, seam);
}

async function handleScriptHostRequest(request: ScriptHostRequest, seam: ScriptHostSeam): Promise<ScriptHostResponse> {
  try {
    switch (request.op) {
      case 'variables.get':
        return okReply(request, resolveVariableByName(request.name));
      case 'variables.set':
        await writeWorkspaceVariable(request.name, request.value);
        return okReply(request, null);
      case 'vault.get':
        return okReply(request, await resolveVaultRef(request.ref, seam.refreshTransport));
      case 'sendRequest':
        return okReply(request, await dispatchAdHocRequest(request.request, seam));
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
      case 'session.publish':
        return okReply(
          request,
          await publishActiveMqttMessage(request.sessionId, scriptPublishToWire(request.message), 'script'),
        );
      default: {
        const unreachable: never = request;
        return errorReply(
          (unreachable as ScriptHostRequest).executionId,
          (unreachable as ScriptHostRequest).rpcId,
          'unknown host op',
        );
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return errorReply(request.executionId, request.rpcId, message);
  }
}

function okReply(request: ScriptHostRequest, value: unknown): ScriptHostResponse {
  return {
    executionId: request.executionId,
    rpcId: request.rpcId,
    ok: true,
    value,
  };
}

function errorReply(executionId: string, rpcId: string, error: string): ScriptHostResponse {
  return { executionId, rpcId, ok: false, error };
}

function resolveVariableByName(name: string): string | null {
  const resolver = buildHostResolver();
  const { result, errors } = resolveTemplate(`{{${name}}}`, (n) => resolver.resolve(n, {}));
  if (errors.length > 0 || result === `{{${name}}}`) return null;
  return result;
}

function buildHostResolver(): VariableResolver {
  const resolver = new VariableResolver();
  resolver.setVault(getVault());
  resolver.setEnvironments(getEnvironments());
  resolver.setActiveEnvironmentId(getActiveEnvironmentId());
  resolver.setDefaultEnvironmentId(getDefaultEnvironmentId());
  resolver.setWorkspaceVariables(getWorkspaceVariables());
  for (const c of getRuleCollections()) resolver.setCollectionVariables(c.uid, c.variables ?? []);
  for (const c of getRequestCollections()) resolver.setCollectionVariables(c.uid, c.variables ?? []);
  return resolver;
}

async function writeWorkspaceVariable(name: string, value: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('oh.variables.set: empty variable name');
  const ctx = nextSwMutatorContext({ surfaceId: SCRIPT_HOST_SURFACE_ID });
  if (!ctx) {
    throw new Error('oh.variables.set: sync service not initialized');
  }
  const existing = getWorkspaceVariables().variables.find((v) => v.name === trimmed);
  const { batch, sideEffects } = buildSetWorkspaceVarBatch(
    {
      variable: {
        uid: existing?.uid ?? generateUid(),
        name: trimmed,
        value,
        type: existing?.type ?? 'default',
      },
    },
    ctx,
  );
  // Speculative prior capture, mirroring the MCP write plumbing —
  // script writes are a non-renderer surface, so the host classifies
  // them into the Activity Feed (with working Revert) itself.
  for (const env of batch.mutations) {
    const oracle = getOracleForWorkspace(env.workspaceId);
    const prior = oracle ? oracle.materializeOne(env.body.type, env.body.id) : null;
    const access = makeOracleInverseAccess({ oracle, entityType: env.body.type, entityId: env.body.id, prior });
    const spec = computeInverseSpec(env.body, access);
    const inverse = spec === null ? null : { mutatorVersion: env.mutatorVersion, spec };
    rememberPriorForMutation(env.mutationId, env.workspaceId, prior, inverse);
  }
  const response = await applySyncRequest({ type: 'oh.sync.apply', batch, sideEffects });
  if (!response.ok) {
    throw new Error(
      `oh.variables.set: apply rejected (${response.failure?.status} — ${response.failure?.detail ?? 'no detail'})`,
    );
  }
}

async function resolveVaultRef(ref: string, refreshTransport: RequestTransport): Promise<string | null> {
  // The runtime can request either a named vault secret or an OAuth
  // credentialRef. Named secrets are the common case; OAuth bundles
  // surface their access token as the value (the common need — signing
  // an outbound ad-hoc request).
  const vault = getVault();
  const named = vault.secrets?.find((s) => s.name === ref);
  // String-kind only — `oh.vault(name)` returns a literal credential.
  // TOTP-kind entries are request-time, not script-time; surface as
  // null so script authors fall back to OAuth bundle resolution.
  if (named && named.kind === 'string') return named.value;
  let bundle = await getOAuthTokenBundle(ref);
  // Same staleness discipline as the executor's attach: an expired
  // bundle refreshes at the token endpoint first, rebuilt from the
  // store's config sidecar (no request tree at hand). Lenient — a
  // failed refresh answers the stale token and the target's 401 speaks.
  if (bundle && isOAuthTokenExpired(bundle) && bundle.refreshToken) {
    const config = await getOAuthRefreshConfig(ref);
    if (config) {
      bundle = (await buildRefreshOAuthHook(undefined, refreshTransport)(config)) ?? bundle;
    }
  }
  return bundle?.accessToken ?? null;
}

async function dispatchAdHocRequest(snapshot: RequestSnapshot, seam: ScriptHostSeam): Promise<ResponseSnapshot> {
  const request: Request = {
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
  const result = await seam.sendRequest(request);
  if (!result.success || !result.snapshot) {
    throw new Error(result.error ?? 'oh.sendRequest failed');
  }
  // A wire failure comes back as an error snapshot (status 0) — passed
  // through as-is, matching the extension's ad-hoc dispatch: scripts
  // inspect `status` themselves rather than catching transport prose.
  return {
    status: result.snapshot.status,
    statusText: result.snapshot.statusText,
    url: result.snapshot.url,
    headers: result.snapshot.headers,
    body: result.snapshot.body,
    ...(result.snapshot.bodyEncoding ? { bodyEncoding: result.snapshot.bodyEncoding } : {}),
    durationMs: result.snapshot.durationMs,
  };
}
