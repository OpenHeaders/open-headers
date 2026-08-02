/**
 * Observe-tier MCP tools — the agent traffic epic's Phase A read
 * surface (AGENT_TRAFFIC_PLAN.md §5, slice S3), over the injected
 * {@link TrafficTap}.
 *
 * Contracts inherited structurally, never re-implemented here:
 *
 *   - **Redaction.** `tap.records()` / `tap.getRecord()` /
 *     `tap.pullBody()` answer projections redacted at the store
 *     boundary — this module has no raw record type to import and no
 *     unredacted value to leak.
 *   - **Absence.** An unarmed source has no uid; the tap answers
 *     `null` and the tools surface the agent-readable miss.
 *   - **Visibility.** Tier `observe` fires the Activity Feed seam
 *     after every successful call — which needs a workspace to land
 *     in, so every tool resolves the active workspace and refuses to
 *     run without one (STATUS finding 13).
 *   - **The host computes, the agent queries** (PLAN §10): filters and
 *     pagination run here in TypeScript; no tool ever answers "here
 *     are 500 rows, you figure it out".
 */

import type { TrafficRecordProjection } from '@openheaders/core/traffic';
import type { TrafficTap } from '../../traffic';
import { type McpToolDefinition, McpToolInputError } from '../registry';
import { requireStringArg, requireWorkspace, resolveWorkspaceIdArg, WORKSPACE_ID_PROPERTY } from './common';

const LIST_LIMIT_DEFAULT = 50;
const LIST_LIMIT_MAX = 200;

/** Shared description suffix — the marker algebra is agent-facing
 *  prompt surface: the agent must know equality still works. */
const REDACTION_NOTE =
  'Values shaped like secrets (bearer tokens, JWTs, cookies, API keys) appear as stable ' +
  '[redacted:<hash>] markers: equal markers mean equal underlying values across requests and ' +
  'positions (header, URL, body), so comparisons still work without the secret. Redaction is ' +
  'best-effort — a secret in an unusual place can slip through.';

export interface McpTrafficToolDeps {
  readonly tap: TrafficTap;
}

/** The five status buckets `traffic_list` can filter by. */
type StatusClass = '2xx' | '3xx' | '4xx' | '5xx' | 'error';

interface TrafficListFilters {
  statusClass?: StatusClass;
  method?: string;
  urlContains?: string;
  resourceType?: string;
  sinceMs?: number;
}

/** An HTTP error status or a request that never completed. */
function isFailureProjection(record: TrafficRecordProjection): boolean {
  return record.phase === 'failed' || (record.statusCode !== undefined && record.statusCode >= 400);
}

function statusClassOf(record: TrafficRecordProjection): StatusClass | null {
  if (record.phase === 'failed') return 'error';
  const status = record.statusCode;
  if (status === undefined) return null;
  if (status >= 500) return '5xx';
  if (status >= 400) return '4xx';
  if (status >= 300) return '3xx';
  if (status >= 200) return '2xx';
  return null;
}

function matchesFilters(record: TrafficRecordProjection, filters: TrafficListFilters): boolean {
  if (filters.statusClass !== undefined && statusClassOf(record) !== filters.statusClass) return false;
  if (filters.method !== undefined && record.method.toUpperCase() !== filters.method) return false;
  if (filters.urlContains !== undefined && !record.url.includes(filters.urlContains)) return false;
  if (filters.resourceType !== undefined && record.resourceType !== filters.resourceType) return false;
  if (filters.sinceMs !== undefined && record.startedAtMs < filters.sinceMs) return false;
  return true;
}

/** Lean list row (PLAN §5): identity + verdict + timing + size —
 *  never headers, never bodies. `traffic_get` has the rest. */
function projectListRow(record: TrafficRecordProjection): Record<string, unknown> {
  return {
    requestId: record.requestId,
    url: record.url,
    method: record.method,
    resourceType: record.resourceType,
    phase: record.phase,
    ...(record.statusCode !== undefined ? { statusCode: record.statusCode } : {}),
    ...(record.statusText !== undefined ? { statusText: record.statusText } : {}),
    ...(record.error !== undefined ? { error: record.error } : {}),
    ...(record.fromCache !== undefined ? { fromCache: record.fromCache } : {}),
    ...(record.initiator !== undefined ? { initiator: record.initiator } : {}),
    startedAtMs: record.startedAtMs,
    ...(record.completedAtMs !== undefined
      ? { completedAtMs: record.completedAtMs, durationMs: Math.round(record.completedAtMs - record.startedAtMs) }
      : {}),
    redirectHopCount: record.redirectHopCount,
    ...(record.bodyBytes !== undefined ? { bodyBytes: record.bodyBytes } : {}),
    ...(record.transferBytes !== undefined ? { transferBytes: record.transferBytes } : {}),
    ...(record.mimeType !== undefined ? { mimeType: record.mimeType } : {}),
    provenance: record.provenance,
  };
}

/** `traffic_failures` row: the list row + response headers (the CORS /
 *  retry-after signal) + the failure verdict + the body when captured. */
function projectFailureRow(record: TrafficRecordProjection): Record<string, unknown> {
  const kind = record.phase === 'failed' ? 'network-error' : (record.statusCode ?? 0) >= 500 ? 'http-5xx' : 'http-4xx';
  return {
    ...projectListRow(record),
    failureKind: kind,
    ...(record.responseHeaders !== undefined ? { responseHeaders: record.responseHeaders } : {}),
    ...(record.failureBody !== undefined
      ? { body: record.failureBody }
      : {
          bodyUnavailable:
            record.phase === 'failed'
              ? 'the request failed before a response body existed (network error, block, timeout, or abort)'
              : 'body not captured — the source cannot serve bodies (no CDP/proxy fidelity) or the body ' +
                'decayed (navigation, tab close, cache eviction); traffic_get can attempt a fresh pull',
        }),
  };
}

function requireSourceUid(deps: McpTrafficToolDeps, args: Record<string, unknown>): string {
  const uid = requireStringArg(args, 'uid');
  if (!deps.tap.status().some((source) => source.uid === uid)) {
    throw new McpToolInputError(
      `no armed traffic source with uid '${uid}' — see traffic_sources (an unarmed or expired source is absent, not readable)`,
    );
  }
  return uid;
}

function optionalString(args: Record<string, unknown>, name: string): string | undefined {
  const raw = args[name];
  return typeof raw === 'string' && raw.length > 0 ? raw : undefined;
}

function optionalNumber(args: Record<string, unknown>, name: string): number | undefined {
  const raw = args[name];
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : undefined;
}

export function createTrafficToolDefinitions(deps: McpTrafficToolDeps): McpToolDefinition[] {
  const observeScoped: Pick<McpToolDefinition, 'tier' | 'resolveWorkspaceId'> = {
    tier: 'observe',
    // Arg-or-active, like every workspace-scoped tool — the observe
    // visibility seam lands the read in this workspace's Activity Feed,
    // so resolution is mandatory even though traffic itself is
    // host-scoped (STATUS finding 13).
    resolveWorkspaceId: resolveWorkspaceIdArg,
  };

  return [
    {
      name: 'traffic_sources',
      title: 'List armed traffic sources',
      description:
        'List the browser tabs and proxy partitions a human has ARMED for live-traffic observation: uid, ' +
        'kind, label, armed-at, expiry, and retention counters (records held, bytes, evictions). Arming is ' +
        'a human gesture in the Open Headers Traffic Monitor — an unarmed source is absent from this list ' +
        'and unreadable by uid; if a tab you need is missing, ask the user to arm it. Arms expire when ' +
        'idle; reading traffic keeps them warm. Source uids feed every other traffic_* tool.',
      inputSchema: {
        type: 'object',
        properties: { ...WORKSPACE_ID_PROPERTY },
        additionalProperties: false,
      },
      ...observeScoped,
      handler: async (args) => {
        const workspaceId = requireWorkspace(args);
        return {
          workspaceId,
          sources: deps.tap.status().map((source) => ({
            uid: source.uid,
            kind: source.kind,
            label: source.label,
            ...(source.nodeId !== undefined ? { nodeId: source.nodeId } : {}),
            ...(source.tabId !== undefined ? { tabId: source.tabId } : {}),
            state: source.state,
            armedAtMs: source.armedAtMs,
            expiresAtMs: source.expiresAtMs,
            stats: source.stats,
          })),
        };
      },
    },
    {
      name: 'traffic_list',
      title: 'List observed traffic',
      description:
        'List the retained exchanges of one armed source as lean projected rows: method, status, URL, ' +
        'timing, sizes, initiator, normalized resourceType — never headers or bodies (traffic_get has ' +
        'those). Filters and pagination run on the host: statusClass (2xx/3xx/4xx/5xx/error), method, ' +
        'urlContains, resourceType (document, xhr, fetch, script, image, websocket, …), sinceMs. Rows are ' +
        'ordered oldest-first; total/matched counts always report what the filters excluded. ' +
        REDACTION_NOTE,
      inputSchema: {
        type: 'object',
        properties: {
          uid: { type: 'string', description: 'Source uid from traffic_sources.' },
          statusClass: {
            type: 'string',
            enum: ['2xx', '3xx', '4xx', '5xx', 'error'],
            description: "Status bucket; 'error' = requests that failed without an HTTP status.",
          },
          method: { type: 'string', description: 'HTTP method filter (case-insensitive).' },
          urlContains: { type: 'string', description: 'Substring match on the (redacted) URL.' },
          resourceType: { type: 'string', description: 'Normalized resource type, e.g. fetch, xhr, document.' },
          sinceMs: { type: 'number', description: 'Only rows started at or after this epoch-ms instant.' },
          limit: { type: 'number', description: `Max rows (default ${LIST_LIMIT_DEFAULT}, max ${LIST_LIMIT_MAX}).` },
          offset: { type: 'number', description: 'Rows to skip (default 0) — pagination cursor.' },
          ...WORKSPACE_ID_PROPERTY,
        },
        required: ['uid'],
        additionalProperties: false,
      },
      ...observeScoped,
      handler: async (args) => {
        const workspaceId = requireWorkspace(args);
        const uid = requireSourceUid(deps, args);
        const statusClass = optionalString(args, 'statusClass');
        if (statusClass !== undefined && !['2xx', '3xx', '4xx', '5xx', 'error'].includes(statusClass)) {
          throw new McpToolInputError("invalid statusClass — one of '2xx', '3xx', '4xx', '5xx', 'error'");
        }
        const filters: TrafficListFilters = {
          ...(statusClass !== undefined ? { statusClass: statusClass as StatusClass } : {}),
          ...(optionalString(args, 'method') !== undefined
            ? { method: (optionalString(args, 'method') ?? '').toUpperCase() }
            : {}),
          ...(optionalString(args, 'urlContains') !== undefined
            ? { urlContains: optionalString(args, 'urlContains') }
            : {}),
          ...(optionalString(args, 'resourceType') !== undefined
            ? { resourceType: optionalString(args, 'resourceType') }
            : {}),
          ...(optionalNumber(args, 'sinceMs') !== undefined ? { sinceMs: optionalNumber(args, 'sinceMs') } : {}),
        };
        const limitRaw = optionalNumber(args, 'limit');
        const limit =
          limitRaw !== undefined && limitRaw > 0 ? Math.min(Math.floor(limitRaw), LIST_LIMIT_MAX) : LIST_LIMIT_DEFAULT;
        const offsetRaw = optionalNumber(args, 'offset');
        const offset = offsetRaw !== undefined && offsetRaw > 0 ? Math.floor(offsetRaw) : 0;

        const all = deps.tap.records(uid) ?? [];
        const matched = all.filter((record) => matchesFilters(record, filters));
        const page = matched.slice(offset, offset + limit);
        return {
          workspaceId,
          uid,
          total: all.length,
          matched: matched.length,
          offset,
          limit,
          hasMore: offset + page.length < matched.length,
          rows: page.map(projectListRow),
        };
      },
    },
    {
      name: 'traffic_failures',
      title: 'List failed traffic (with bodies)',
      description:
        'The fast path for "what broke": every retained exchange of one armed source that failed — HTTP ' +
        '4xx/5xx (failureKind http-4xx / http-5xx) and requests that never completed (network-error: DNS, ' +
        'connection, CORS block, timeout, abort — the error field carries the code). HTTP-failure rows ' +
        'attach the response BODY captured at failure time (a failure body is usually the answer: stack ' +
        'traces, error JSON), capped at 100,000 chars with truncated flagged; rows without a captured body ' +
        'say why in bodyUnavailable. Response headers ride along (CORS diagnosis needs them). ' +
        REDACTION_NOTE,
      inputSchema: {
        type: 'object',
        properties: {
          uid: { type: 'string', description: 'Source uid from traffic_sources.' },
          limit: { type: 'number', description: `Max rows (default ${LIST_LIMIT_DEFAULT}, max ${LIST_LIMIT_MAX}).` },
          offset: { type: 'number', description: 'Rows to skip (default 0) — pagination cursor.' },
          ...WORKSPACE_ID_PROPERTY,
        },
        required: ['uid'],
        additionalProperties: false,
      },
      ...observeScoped,
      handler: async (args) => {
        const workspaceId = requireWorkspace(args);
        const uid = requireSourceUid(deps, args);
        const limitRaw = optionalNumber(args, 'limit');
        const limit =
          limitRaw !== undefined && limitRaw > 0 ? Math.min(Math.floor(limitRaw), LIST_LIMIT_MAX) : LIST_LIMIT_DEFAULT;
        const offsetRaw = optionalNumber(args, 'offset');
        const offset = offsetRaw !== undefined && offsetRaw > 0 ? Math.floor(offsetRaw) : 0;

        const all = deps.tap.records(uid, { includeFailureBodies: true }) ?? [];
        const failures = all.filter(isFailureProjection);
        const page = failures.slice(offset, offset + limit);
        return {
          workspaceId,
          uid,
          total: all.length,
          failures: failures.length,
          offset,
          limit,
          hasMore: offset + page.length < failures.length,
          rows: page.map(projectFailureRow),
        };
      },
    },
    {
      name: 'traffic_get',
      title: 'Get one exchange in full',
      description:
        'Fetch one observed exchange by requestId (from traffic_list / traffic_failures): the full ' +
        'projection including request and response headers, plus the response body. Failure bodies were ' +
        'captured at failure time; success bodies are pulled from the browser ON DEMAND and decay — after ' +
        'navigation, tab close, or cache eviction the pull fails, and only sources with CDP or proxy ' +
        'fidelity can serve bodies at all. A missing body is reported honestly in bodyUnavailable, never ' +
        'an error. Bodies are capped at 100,000 chars (truncated flagged); binary bodies arrive base64. ' +
        REDACTION_NOTE,
      inputSchema: {
        type: 'object',
        properties: {
          uid: { type: 'string', description: 'Source uid from traffic_sources.' },
          requestId: { type: 'string', description: 'Request id from traffic_list / traffic_failures.' },
          ...WORKSPACE_ID_PROPERTY,
        },
        required: ['uid', 'requestId'],
        additionalProperties: false,
      },
      ...observeScoped,
      handler: async (args) => {
        const workspaceId = requireWorkspace(args);
        const uid = requireSourceUid(deps, args);
        const requestId = requireStringArg(args, 'requestId');
        const record = deps.tap.getRecord(uid, requestId);
        if (record === null) {
          throw new McpToolInputError(
            `no exchange with requestId '${requestId}' on source '${uid}' — it may have been evicted by the ` +
              'retention bounds; see traffic_list',
          );
        }
        // The body has ONE spot in this result: a retained failure body
        // answers the pull immediately, so the record row stays body-free.
        const { failureBody: _retained, ...recordRow } = record;
        const pull = await deps.tap.pullBody(uid, requestId);
        const bodyPart =
          pull === null || !pull.ok
            ? {
                bodyUnavailable:
                  pull === null || pull.reason === 'gone'
                    ? 'body no longer available — the source cannot serve bodies (no CDP/proxy fidelity) or ' +
                      'the body decayed (navigation, tab close, cache eviction)'
                    : pull.reason === 'in-flight'
                      ? 'the request has not completed yet — retry once it settles'
                      : pull.reason === 'no-response-body'
                        ? 'the request failed before a response body existed (network error, block, timeout, or abort)'
                        : 'the exchange was evicted by the retention bounds',
              }
            : { body: pull.body };
        return { workspaceId, uid, record: recordRow, ...bodyPart };
      },
    },
  ];
}
