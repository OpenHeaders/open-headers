/**
 * Execute-tier MCP tools — Phase 3 of the catalog. These are the tools
 * that produce real network egress from the user's machine, so they sit
 * behind the separate `execute` opt-in (`mcp.allowExecute`).
 *
 * The tools are façades over the C1 resolve→execute core the live
 * runner uses — no parallel data path:
 *
 *   - `requests_send` runs one saved request through `runStepRequest`
 *     (full scope-chain resolution, TOTP cooldown gate, OAuth refresh
 *     via the host transport's seam) over the host transport, wrapped
 *     in the per-origin refresh rate limiter so agent sends share the
 *     same token bucket as scheduled refreshes.
 *   - `workflows_run` fires the host's chain runner — the same gated
 *     run a cadence tick performs, including the atomic cache commit
 *     and publish-on-run for exposed live variables — then reads the
 *     committed cache row back for the per-step outcomes.
 *   - `requests_authorize` acquires an OAuth 2.0 token for a saved
 *     request's oauth2 config without a browser on THIS host — the
 *     grants that need none run now (client credentials, password,
 *     JWT bearer), the device grant (RFC 8628) starts and answers the
 *     user code + verification URL while the host polls, and the
 *     authorization code grant is refused with the fix. The token
 *     itself never rides the payload — `requests_send` attaches it.
 *     `requests_authorize_status` reads the device flow's state and
 *     the stored token's facts (the CLI's poll).
 *
 * The workflow runner is injected by the host shell (the desktop
 * passes its `runDesktopWorkflowRefresh`) so the cache-commit +
 * failure-classification discipline stays owned by the one module
 * that already implements it for the scheduler.
 */

import type { OAuth2DeviceState, OAuth2TokenBundle } from '@openheaders/core/oauth';
import type { LiveWorkflow, OAuth2Auth, Request } from '@openheaders/core/types';
import { getTokenBundle } from '@openheaders/oracle/entity/oauth-token-store';
import { getWorkflowRunCache } from '@openheaders/oracle/live/live-cache-store';
import { resolveRequestAuth } from '@openheaders/oracle/live/request-exec/ancestor-chain';
import { getDeviceFlowState, startDeviceFlow } from '@openheaders/oracle/live/request-exec/oauth-device';
import { OAuth2FlowError } from '@openheaders/oracle/live/request-exec/oauth-exchange';
import {
  performClientCredentialsFlow,
  performJwtBearerFlow,
  performPasswordCredentialsFlow,
} from '@openheaders/oracle/live/request-exec/oauth-flows';
import { buildRefreshOAuthHook } from '@openheaders/oracle/live/request-exec/oauth-refresh';
import { withRefreshRateLimit } from '@openheaders/oracle/live/request-exec/rate-limiter';
import { runStepRequest } from '@openheaders/oracle/live/request-exec/run-step-request';
import type { RequestTransport } from '@openheaders/oracle/live/request-exec/transport';
import { snapshotLiveVariablePostStates, snapshotLiveWorkflowPostStates } from '@openheaders/oracle/sync/service';
import { type McpToolDefinition, McpToolInputError } from '../registry';
import {
  findRequest,
  requireStringArg,
  requireWorkspace,
  resolveEnvironmentArg,
  resolveWorkspaceIdArg,
  WORKSPACE_ID_PROPERTY,
} from './common';

/**
 * Cap on the response-body text returned to the MCP client. The
 * transport already streams + caps at its own byte ceiling; this is
 * the tighter agent-facing bound so one large body can't flood a
 * client context window. Truncation is always flagged, never silent.
 */
const MCP_BODY_CAP_CHARS = 100_000;

export const ENVIRONMENT_ID_PROPERTY = {
  environmentId: {
    type: 'string',
    description:
      'Environment to resolve variables under (see environments_list). Omit to use the active environment ' +
      'of the active workspace; background workspaces default to no environment.',
  },
} as const;

/** Arguments the injected workflow runner receives — one workflow run
 *  against one environment, exactly the chain scheduler's fire shape. */
export interface McpWorkflowRunArgs {
  workspaceId: string;
  workflow: LiveWorkflow;
  /** `null` = "No environment". */
  environmentId: string | null;
}

/** Outcome contract of the injected runner. Mirrors the desktop chain
 *  runner's result: failure is a value (already committed to the live
 *  cache by the runner), not an exception. */
export type McpWorkflowRunOutcome =
  | { ok: true; skippedStepIds: readonly string[] }
  | { ok: false; failedStepId: string; failedPhase: string; message: string };

export interface McpExecuteToolDeps {
  /** Host network capability for `requests_send`. */
  transport: RequestTransport;
  /** Host chain runner for `workflows_run` (run + cache commit + publish-on-run). */
  runWorkflow: (args: McpWorkflowRunArgs) => Promise<McpWorkflowRunOutcome>;
}

/** The request's effective oauth2 config (its own or the inherited
 *  pool entry), or the agent-readable refusal. */
function requireOAuth2Auth(workspaceId: string, request: Request): OAuth2Auth {
  const { auth } = resolveRequestAuth(request, workspaceId);
  if (auth.type !== 'oauth2') {
    throw new McpToolInputError(
      `request '${request.name}' uses ${auth.type} auth — requests_authorize acquires OAuth 2.0 tokens only`,
    );
  }
  return auth;
}

/** The stored token's facts — never the token itself. */
function tokenFacts(bundle: OAuth2TokenBundle | null) {
  if (bundle === null) return null;
  return {
    tokenType: bundle.tokenType,
    issuedAt: bundle.issuedAt,
    expiresAt: bundle.expiresAt,
    scope: bundle.scope,
    hasRefreshToken: bundle.refreshToken !== undefined,
  };
}

const NEEDS_BROWSER =
  'the authorization code grant needs a browser on the host running the app — run Get new access token from the ' +
  'desktop app or the extension, or switch the request to the device code grant';

function findWorkflow(workspaceId: string, uid: string): LiveWorkflow {
  const match = snapshotLiveWorkflowPostStates(workspaceId).find((ps) => ps.workflow.uid === uid);
  if (!match) {
    throw new McpToolInputError(`no workflow with uid '${uid}' in workspace '${workspaceId}' — see workflows_list`);
  }
  return match.workflow;
}

export function createExecuteToolDefinitions(deps: McpExecuteToolDeps): McpToolDefinition[] {
  const workspaceScoped: Pick<McpToolDefinition, 'tier' | 'resolveWorkspaceId'> = {
    tier: 'execute',
    // Arg-or-active — the same resolution the handler's `requireWorkspace`
    // applies, so the gate always sees the workspace the run targets.
    resolveWorkspaceId: resolveWorkspaceIdArg,
  };

  return [
    {
      name: 'requests_send',
      title: 'Send API request',
      description:
        "Execute a saved API request from the user's machine. Every {{variable}} is resolved through the " +
        'full scope chain (vault > environment > collection > workspace, plus {{live.*}}), auth is applied, ' +
        'and the request goes out over the network. Returns status, headers, body, and timing; bodies over ' +
        '100,000 characters are truncated with bodyTruncated: true. A request with unresolvable variables ' +
        'is refused before it reaches the wire (the error names the fix).',
      inputSchema: {
        type: 'object',
        properties: {
          uid: { type: 'string', description: 'Request uid from requests_list.' },
          ...ENVIRONMENT_ID_PROPERTY,
          ...WORKSPACE_ID_PROPERTY,
        },
        required: ['uid'],
        additionalProperties: false,
      },
      ...workspaceScoped,
      handler: async (args) => {
        const workspaceId = requireWorkspace(args);
        const request = findRequest(workspaceId, requireStringArg(args, 'uid'));
        const environmentId = resolveEnvironmentArg(workspaceId, args);
        const snapshot = await withRefreshRateLimit(request.url, () =>
          runStepRequest(request, {
            workspaceId,
            environmentId,
            transport: deps.transport,
            refreshOAuth: buildRefreshOAuthHook(workspaceId, deps.transport),
          }),
        );
        const requestRow = { uid: request.uid, name: request.name, method: request.method, url: request.url };
        if (snapshot.error != null) {
          return { workspaceId, request: requestRow, environmentId, sent: false, error: snapshot.error };
        }
        const overCap = snapshot.body.length > MCP_BODY_CAP_CHARS;
        return {
          workspaceId,
          request: requestRow,
          environmentId,
          sent: true,
          response: {
            status: snapshot.status,
            statusText: snapshot.statusText,
            url: snapshot.url,
            ...(snapshot.httpVersion !== undefined ? { httpVersion: snapshot.httpVersion } : {}),
            headers: snapshot.headers,
            body: overCap ? snapshot.body.slice(0, MCP_BODY_CAP_CHARS) : snapshot.body,
            bodyTruncated: snapshot.bodyTruncated || overCap,
            bodyBytes: snapshot.bodyBytes,
            durationMs: snapshot.durationMs,
          },
        };
      },
    },
    {
      name: 'requests_authorize',
      title: 'Authorize API request (OAuth 2.0)',
      description:
        "Acquire an OAuth 2.0 token for a saved request's oauth2 auth without a browser on this host. Client " +
        'credentials, password and JWT bearer grants exchange now (outcome "granted"). The device code grant ' +
        '(RFC 8628) starts and answers outcome "pending" with the user code and verification URL the user ' +
        'approves on any device; the host keeps polling — check requests_authorize_status until it is granted. ' +
        'The authorization code grant needs a browser and is refused (outcome "refused"). The token never ' +
        'rides the payload; requests_send attaches it.',
      inputSchema: {
        type: 'object',
        properties: {
          uid: { type: 'string', description: 'Request uid from requests_list.' },
          ...WORKSPACE_ID_PROPERTY,
        },
        required: ['uid'],
        additionalProperties: false,
      },
      ...workspaceScoped,
      handler: async (args) => {
        const workspaceId = requireWorkspace(args);
        const request = findRequest(workspaceId, requireStringArg(args, 'uid'));
        const auth = requireOAuth2Auth(workspaceId, request);
        const base = {
          workspaceId,
          request: { uid: request.uid, name: request.name },
          credentialRef: auth.credentialRef,
          flow: auth.flow,
        };
        try {
          switch (auth.flow) {
            case 'device-code': {
              const state = await startDeviceFlow(auth, workspaceId, deps.transport);
              return { ...base, outcome: 'pending', state };
            }
            case 'client-credentials':
            case 'password-credentials':
            case 'jwt-bearer': {
              const bundle =
                auth.flow === 'client-credentials'
                  ? await performClientCredentialsFlow(auth, workspaceId, deps.transport)
                  : auth.flow === 'password-credentials'
                    ? await performPasswordCredentialsFlow(auth, workspaceId, deps.transport)
                    : await performJwtBearerFlow(auth, workspaceId, deps.transport);
              return { ...base, outcome: 'granted', token: tokenFacts(bundle) };
            }
            default:
              return { ...base, outcome: 'refused', error: NEEDS_BROWSER };
          }
        } catch (err) {
          if (err instanceof OAuth2FlowError)
            return { ...base, outcome: 'refused', error: `${err.step}: ${err.message}` };
          throw err;
        }
      },
    },
    {
      name: 'requests_authorize_status',
      title: 'OAuth 2.0 authorization status',
      description:
        "The state of a saved request's OAuth 2.0 credential on this host: the device authorization flow's " +
        'state when one was started (pending with the user code and verification URL, granted, denied, expired, ' +
        "failed) and the stored token's facts (type, expiry, scope, whether a refresh token is held) — never " +
        'the token itself. Poll it after requests_authorize answers "pending".',
      inputSchema: {
        type: 'object',
        properties: {
          uid: { type: 'string', description: 'Request uid from requests_list.' },
          ...WORKSPACE_ID_PROPERTY,
        },
        required: ['uid'],
        additionalProperties: false,
      },
      tier: 'read',
      resolveWorkspaceId: resolveWorkspaceIdArg,
      handler: async (args) => {
        const workspaceId = requireWorkspace(args);
        const request = findRequest(workspaceId, requireStringArg(args, 'uid'));
        const auth = requireOAuth2Auth(workspaceId, request);
        const state: OAuth2DeviceState | null = getDeviceFlowState(auth.credentialRef, workspaceId);
        return {
          workspaceId,
          request: { uid: request.uid, name: request.name },
          credentialRef: auth.credentialRef,
          flow: auth.flow,
          state,
          token: tokenFacts(await getTokenBundle(auth.credentialRef, workspaceId)),
        };
      },
    },
    {
      name: 'workflows_run',
      title: 'Run live workflow',
      description:
        'Run a live workflow once, now — the same chained execution a scheduled refresh performs: steps ' +
        'run in dependency order, captures extract from each response, and on success ALL captures commit ' +
        'atomically to the live cache, bringing exposed {{live.*}} variables live (publish-on-run). ' +
        'Returns per-step captures and the live variables they feed; on failure, the failing step and ' +
        'phase. Drafts can be run explicitly, but only published workflows resolve {{live.*}} references.',
      inputSchema: {
        type: 'object',
        properties: {
          uid: { type: 'string', description: 'Workflow uid from workflows_list.' },
          ...ENVIRONMENT_ID_PROPERTY,
          ...WORKSPACE_ID_PROPERTY,
        },
        required: ['uid'],
        additionalProperties: false,
      },
      ...workspaceScoped,
      handler: async (args) => {
        const workspaceId = requireWorkspace(args);
        const workflow = findWorkflow(workspaceId, requireStringArg(args, 'uid'));
        const environmentId = resolveEnvironmentArg(workspaceId, args);
        const outcome = await deps.runWorkflow({ workspaceId, workflow, environmentId });
        if (!outcome.ok) {
          return {
            workspaceId,
            workflowUid: workflow.uid,
            environmentId,
            ok: false,
            failedStepId: outcome.failedStepId,
            failedPhase: outcome.failedPhase,
            message: outcome.message,
          };
        }
        // The runner committed the captures atomically before returning
        // — read the cache row back as the authoritative run record.
        const cache = await getWorkflowRunCache(workflow.uid, environmentId, workspaceId);
        const liveVariables = snapshotLiveVariablePostStates(workspaceId)
          .map((ps) => ps.liveVariable)
          .filter((lv) => lv.workflowUid === workflow.uid)
          .map((lv) => ({
            name: lv.name,
            reference: `{{live.${lv.name}}}`,
            published: lv.published === true,
            value: cache?.stepCaptures[lv.stepId]?.[lv.captureName],
          }));
        return {
          workspaceId,
          workflowUid: workflow.uid,
          environmentId,
          ok: true,
          skippedStepIds: outcome.skippedStepIds,
          extractedAt: cache?.extractedAt ?? null,
          expiresAt: cache?.expiresAt ?? null,
          stepCaptures: cache?.stepCaptures ?? {},
          liveVariables,
        };
      },
    },
  ];
}
