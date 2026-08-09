/**
 * Traffic MCP tools — the agent traffic epic's Phase A surface
 * (AGENT_TRAFFIC_PLAN.md §5, slices S3–S6), over the injected
 * {@link TrafficTap}: the observe-tier read tools plus the ONE
 * write-tier member, `traffic_to_rule`, which mints a response-override
 * rule from an observed exchange through the same canonical rule-mint
 * path `rules_create` uses — published by default like any write-tier
 * mint (the write grant IS the consent boundary; `rules_create` can
 * publish, so a draft-only mint would be theater), EXCEPT when a minted
 * field carries a redaction marker: publishing would serve the literal
 * `[redacted:…]` text, so redacted fields force a draft.
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

import { RuleSchema } from '@openheaders/core/schemas';
import { buildAddBatch as buildAddRuleBatch } from '@openheaders/core/sync-builders/mutations/rule-mutations';
import type { TrafficRecordProjection } from '@openheaders/core/traffic';
import { generateUid, toFolderName } from '@openheaders/core/utils';
import type { TrafficTap } from '../../traffic';
import { type McpToolDefinition, McpToolInputError } from '../registry';
import {
  applyMcpMutation,
  mintMcpContext,
  parseOrThrow,
  requireStringArg,
  requireWorkspace,
  resolveWorkspaceIdArg,
  WORKSPACE_ID_PROPERTY,
} from './common';
import { computeTrafficDiff } from './traffic-diff';
import { computeTrafficGraph, isFailureProjection, trafficFailureKind } from './traffic-graph';
import { buildResponseOverrideDraft, conditionValueForUrl, type TrafficDraftBodyInput } from './traffic-to-rule';
import { resolveRuleParentPath } from './write-tools';

export const LIST_LIMIT_DEFAULT = 50;
export const LIST_LIMIT_MAX = 200;

/** `traffic_wait` timeout bounds — well under the HTTP transport's
 *  request ceiling so a wait always answers in-band. */
export const TRAFFIC_WAIT_TIMEOUT_DEFAULT_MS = 20_000;
export const TRAFFIC_WAIT_TIMEOUT_MAX_MS = 60_000;
const TRAFFIC_WAIT_TIMEOUT_MIN_MS = 500;

/** Cap on the differing pairs one diff report carries in full. */
const DIFF_PAIRS_DEFAULT = 20;
const DIFF_PAIRS_MAX = 100;

/** Cap on each of `traffic_graph`'s reported lists (chains, clusters). */
const GRAPH_ITEMS_DEFAULT = 20;
const GRAPH_ITEMS_MAX = 100;

/** Shared description suffix — the marker algebra is agent-facing
 *  prompt surface: the agent must know equality still works. Shared
 *  with the session tools (C7): archive reads speak the same algebra. */
export const REDACTION_NOTE =
  'Values shaped like secrets (bearer tokens, JWTs, cookies, API keys) appear as stable ' +
  '[redacted:<hash>] markers: equal markers mean equal underlying values across requests and ' +
  'positions (header, URL, body), so comparisons still work without the secret. Redaction is ' +
  'best-effort — a secret in an unusual place can slip through.';

export interface McpTrafficToolDeps {
  readonly tap: TrafficTap;
  /**
   * Whether the host's `observe` tier is currently enabled.
   * `traffic_to_rule` is write-tier (the tier gate checks `write`), but
   * it READS observed traffic — with observe disabled it would be a
   * side door for traffic content through the write grant, so the
   * handler refuses unless BOTH switches are on.
   */
  readonly isObserveEnabled: () => boolean;
}

/** The five status buckets `traffic_list` can filter by. */
type StatusClass = '2xx' | '3xx' | '4xx' | '5xx' | 'error';

export interface TrafficListFilters {
  statusClass?: StatusClass;
  method?: string;
  urlContains?: string;
  resourceType?: string;
  sinceMs?: number;
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

export function matchesFilters(record: TrafficRecordProjection, filters: TrafficListFilters): boolean {
  if (filters.statusClass !== undefined && statusClassOf(record) !== filters.statusClass) return false;
  if (filters.method !== undefined && record.method.toUpperCase() !== filters.method) return false;
  if (filters.urlContains !== undefined && !record.url.includes(filters.urlContains)) return false;
  if (filters.resourceType !== undefined && record.resourceType !== filters.resourceType) return false;
  if (filters.sinceMs !== undefined && record.startedAtMs < filters.sinceMs) return false;
  return true;
}

/** Lean list row (PLAN §5): identity + verdict + timing + size —
 *  never headers, never bodies. `traffic_get` has the rest. */
export function projectListRow(record: TrafficRecordProjection): Record<string, unknown> {
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
  const kind = trafficFailureKind(record);
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

/** Shared filter-arg parsing — `traffic_list` filters double as the
 *  `traffic_wait` predicate and the session tools' query vocabulary,
 *  so the vocabulary is parsed in one place. */
export function parseListFilters(args: Record<string, unknown>): TrafficListFilters {
  const statusClass = optionalString(args, 'statusClass');
  if (statusClass !== undefined && !['2xx', '3xx', '4xx', '5xx', 'error'].includes(statusClass)) {
    throw new McpToolInputError("invalid statusClass — one of '2xx', '3xx', '4xx', '5xx', 'error'");
  }
  const method = optionalString(args, 'method');
  const urlContains = optionalString(args, 'urlContains');
  const resourceType = optionalString(args, 'resourceType');
  const sinceMs = optionalNumber(args, 'sinceMs');
  return {
    ...(statusClass !== undefined ? { statusClass: statusClass as StatusClass } : {}),
    ...(method !== undefined ? { method: method.toUpperCase() } : {}),
    ...(urlContains !== undefined ? { urlContains } : {}),
    ...(resourceType !== undefined ? { resourceType } : {}),
    ...(sinceMs !== undefined ? { sinceMs } : {}),
  };
}

export function parsePage(args: Record<string, unknown>): { limit: number; offset: number } {
  const limitRaw = optionalNumber(args, 'limit');
  const limit =
    limitRaw !== undefined && limitRaw > 0 ? Math.min(Math.floor(limitRaw), LIST_LIMIT_MAX) : LIST_LIMIT_DEFAULT;
  const offsetRaw = optionalNumber(args, 'offset');
  const offset = offsetRaw !== undefined && offsetRaw > 0 ? Math.floor(offsetRaw) : 0;
  return { limit, offset };
}

interface TrafficDiffWindow {
  readonly uid: string;
  readonly sinceMs?: number;
  readonly untilMs?: number;
}

/** One side of a diff: `{ uid, sinceMs?, untilMs? }`. */
function requireWindowArg(args: Record<string, unknown>, name: string): TrafficDiffWindow {
  const raw = args[name];
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new McpToolInputError(`'${name}' is required and must be an object { uid, sinceMs?, untilMs? }`);
  }
  const side = raw as Record<string, unknown>;
  const uid = side.uid;
  if (typeof uid !== 'string' || uid.length === 0) {
    throw new McpToolInputError(`'${name}.uid' is required and must be a source uid from traffic_sources`);
  }
  const sinceMs = typeof side.sinceMs === 'number' && Number.isFinite(side.sinceMs) ? side.sinceMs : undefined;
  const untilMs = typeof side.untilMs === 'number' && Number.isFinite(side.untilMs) ? side.untilMs : undefined;
  return { uid, ...(sinceMs !== undefined ? { sinceMs } : {}), ...(untilMs !== undefined ? { untilMs } : {}) };
}

function windowRows(
  deps: McpTrafficToolDeps,
  window: TrafficDiffWindow,
  urlContains: string | undefined,
): TrafficRecordProjection[] {
  const all = deps.tap.records(window.uid) ?? [];
  return all.filter(
    (record) =>
      (window.sinceMs === undefined || record.startedAtMs >= window.sinceMs) &&
      (window.untilMs === undefined || record.startedAtMs < window.untilMs) &&
      (urlContains === undefined || record.url.includes(urlContains)),
  );
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
        'a human gesture in the Open Headers Traffic panel — an unarmed source is absent from this list ' +
        'and unreadable by uid; if a tab you need is missing, ask the user to arm it. Arms expire when ' +
        'idle; reading traffic keeps them warm. Source uids feed every other traffic_* tool. A row may ' +
        'carry capturing: true while a HUMAN-started disk capture session records that source — capture ' +
        'sessions are informational here and cannot be started or stopped by any tool.',
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
            pendingWaits: source.pendingWaits,
            // The honest marker, nothing more: an agent may KNOW a
            // human is capturing this source to disk (S7); the session
            // itself — path, bounds, control — stays off this surface.
            ...(source.capture !== undefined ? { capturing: true } : {}),
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
        const filters = parseListFilters(args);
        const { limit, offset } = parsePage(args);

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
        const { limit, offset } = parsePage(args);

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
                        ? 'the exchange has no response body — it failed before one existed (network error, ' +
                          'block, timeout, abort) or the response carried no body content'
                        : 'the exchange was evicted by the retention bounds',
              }
            : { body: pull.body };
        return { workspaceId, uid, record: recordRow, ...bodyPart };
      },
    },
    {
      name: 'traffic_diff',
      title: 'Diff two sources or time windows',
      description:
        'Compare two armed sources — or two time windows of ONE source (same uid, different ' +
        'sinceMs/untilMs bounds on startedAtMs) — and return the structural delta, computed on the host: ' +
        'requests paired by method+path (nth occurrence against nth, query strings excluded), status ' +
        'divergence per pair, request/response header presence and value changes, and the requests only ' +
        'one side fired. Secret values compare through their stable markers: equal markers mean equal ' +
        'underlying values, so "these two requests sent IDENTICAL headers" is provable without seeing any ' +
        'secret — and a report of no differences is a meaningful answer (it rules out a whole class of ' +
        'hypotheses, like "the failing session sends different headers"). Only differences and counts are ' +
        'returned, never full row dumps. ' +
        REDACTION_NOTE,
      inputSchema: {
        type: 'object',
        properties: {
          a: {
            type: 'object',
            description: 'First side: a source uid, optionally bounded to a startedAtMs window.',
            properties: {
              uid: { type: 'string', description: 'Source uid from traffic_sources.' },
              sinceMs: { type: 'number', description: 'Only rows started at or after this epoch-ms instant.' },
              untilMs: { type: 'number', description: 'Only rows started before this epoch-ms instant.' },
            },
            required: ['uid'],
            additionalProperties: false,
          },
          b: {
            type: 'object',
            description: 'Second side — same shape as a; may reuse a.uid with a different window.',
            properties: {
              uid: { type: 'string', description: 'Source uid from traffic_sources.' },
              sinceMs: { type: 'number', description: 'Only rows started at or after this epoch-ms instant.' },
              untilMs: { type: 'number', description: 'Only rows started before this epoch-ms instant.' },
            },
            required: ['uid'],
            additionalProperties: false,
          },
          urlContains: { type: 'string', description: 'Scope both sides to URLs containing this substring.' },
          limit: {
            type: 'number',
            description: `Max differing pairs reported in full (default ${DIFF_PAIRS_DEFAULT}, max ${DIFF_PAIRS_MAX}); counts always cover everything.`,
          },
          ...WORKSPACE_ID_PROPERTY,
        },
        required: ['a', 'b'],
        additionalProperties: false,
      },
      ...observeScoped,
      handler: async (args) => {
        const workspaceId = requireWorkspace(args);
        const a = requireWindowArg(args, 'a');
        const b = requireWindowArg(args, 'b');
        for (const uid of a.uid === b.uid ? [a.uid] : [a.uid, b.uid]) {
          if (!deps.tap.status().some((source) => source.uid === uid)) {
            throw new McpToolInputError(
              `no armed traffic source with uid '${uid}' — see traffic_sources (an unarmed or expired source is absent, not readable)`,
            );
          }
        }
        const urlContains = optionalString(args, 'urlContains');
        const limitRaw = optionalNumber(args, 'limit');
        const limit =
          limitRaw !== undefined && limitRaw > 0 ? Math.min(Math.floor(limitRaw), DIFF_PAIRS_MAX) : DIFF_PAIRS_DEFAULT;
        const rowsA = windowRows(deps, a, urlContains);
        const rowsB = windowRows(deps, b, urlContains);
        const report = computeTrafficDiff(rowsA, rowsB);
        return {
          workspaceId,
          a: { ...a, rows: rowsA.length },
          b: { ...b, rows: rowsB.length },
          comparedPairs: report.comparedPairs,
          divergentStatusPairs: report.divergentStatusPairs,
          identicalRequestHeaderPairs: report.identicalRequestHeaderPairs,
          differingPairsTotal: report.differingPairs.length,
          differingPairs: report.differingPairs.slice(0, limit),
          identicalPairs: report.identicalPairs,
          onlyInA: report.onlyInA,
          onlyInB: report.onlyInB,
        };
      },
    },
    {
      name: 'traffic_graph',
      title: 'Graph traffic structure',
      description:
        'Compute the STRUCTURE of one armed source’s retained traffic on the host and return it as ' +
        'chains, clusters and a critical path — never an edge dump: (1) redirectChains — every ' +
        'redirected exchange with its per-hop URLs and 3xx statuses plus the final URL/status; redirect hops ' +
        'fold into ONE exchange (one requestId), so a chain is one row here and one row in traffic_list, ' +
        'never one per hop. (2) initiatorChains — who loaded what, root→leaf (page → script ' +
        '→ request), joined by matching each exchange’s initiator URL against other exchanges’ ' +
        'URLs. The join is APPROXIMATE: several exchanges can share a URL, and sources without CDP fidelity ' +
        'often record only an origin as the initiator, which joins nothing — treat chains as strong ' +
        'hints, not proof. (3) criticalPath — the initiator chain ending at the LAST exchange to ' +
        'complete in the window, with per-node timing and the window span. (4) failureClusters — failing ' +
        'exchanges grouped by endpoint (origin + path, a variable last segment folded to *) and failure kind, ' +
        'so 14 failures on one endpoint read as one problem, not 14. Optionally scope by sinceMs/untilMs ' +
        '(startedAtMs bounds) and urlContains. Lists are capped (limit, default ' +
        `${GRAPH_ITEMS_DEFAULT}, max ${GRAPH_ITEMS_MAX}) with honest totals. ` +
        REDACTION_NOTE,
      inputSchema: {
        type: 'object',
        properties: {
          uid: { type: 'string', description: 'Source uid from traffic_sources.' },
          sinceMs: { type: 'number', description: 'Only exchanges started at or after this epoch-ms instant.' },
          untilMs: { type: 'number', description: 'Only exchanges started before this epoch-ms instant.' },
          urlContains: { type: 'string', description: 'Scope to exchanges whose (redacted) URL contains this.' },
          limit: {
            type: 'number',
            description: `Max items per reported list (default ${GRAPH_ITEMS_DEFAULT}, max ${GRAPH_ITEMS_MAX}); totals always cover everything.`,
          },
          ...WORKSPACE_ID_PROPERTY,
        },
        required: ['uid'],
        additionalProperties: false,
      },
      ...observeScoped,
      handler: async (args) => {
        const workspaceId = requireWorkspace(args);
        const uid = requireSourceUid(deps, args);
        const sinceMs = optionalNumber(args, 'sinceMs');
        const untilMs = optionalNumber(args, 'untilMs');
        const urlContains = optionalString(args, 'urlContains');
        const limitRaw = optionalNumber(args, 'limit');
        const limit =
          limitRaw !== undefined && limitRaw > 0
            ? Math.min(Math.floor(limitRaw), GRAPH_ITEMS_MAX)
            : GRAPH_ITEMS_DEFAULT;
        const rows = windowRows(
          deps,
          { uid, ...(sinceMs !== undefined ? { sinceMs } : {}), ...(untilMs !== undefined ? { untilMs } : {}) },
          urlContains,
        );
        const report = computeTrafficGraph(rows);
        return {
          workspaceId,
          uid,
          totalRecords: rows.length,
          redirectChainsTotal: report.redirectChains.length,
          redirectChains: report.redirectChains.slice(0, limit),
          initiatorChainsTotal: report.initiatorChains.length,
          initiatorChains: report.initiatorChains.slice(0, limit),
          criticalPath: report.criticalPath,
          failureClustersTotal: report.failureClusters.length,
          failureClusters: report.failureClusters.slice(0, limit),
        };
      },
    },
    {
      name: 'traffic_wait',
      title: 'Wait for a matching exchange',
      description:
        'Block until the armed source retains an exchange matching the given filters (the same filter ' +
        'vocabulary as traffic_list: statusClass, method, urlContains, resourceType, sinceMs), then return ' +
        'that row — "reload and tell me what breaks" as one call: start the wait, have the user act, and ' +
        'the first matching request answers it. Already-retained exchanges match immediately; pass sinceMs ' +
        '(e.g. the current epoch ms) to wait only for NEW traffic. A wait that times out is a NORMAL ' +
        `result (matched: false, reason: "timeout"), not an error — "nothing matching appeared" is an ` +
        `answer. timeoutMs defaults to ${TRAFFIC_WAIT_TIMEOUT_DEFAULT_MS} and is capped at ` +
        `${TRAFFIC_WAIT_TIMEOUT_MAX_MS}. ` +
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
          sinceMs: { type: 'number', description: 'Only match rows started at or after this epoch-ms instant.' },
          timeoutMs: {
            type: 'number',
            description: `Wait bound in ms (default ${TRAFFIC_WAIT_TIMEOUT_DEFAULT_MS}, max ${TRAFFIC_WAIT_TIMEOUT_MAX_MS}).`,
          },
          ...WORKSPACE_ID_PROPERTY,
        },
        required: ['uid'],
        additionalProperties: false,
      },
      ...observeScoped,
      handler: async (args, ctx) => {
        const workspaceId = requireWorkspace(args);
        const uid = requireSourceUid(deps, args);
        const filters = parseListFilters(args);
        const timeoutRaw = optionalNumber(args, 'timeoutMs');
        const timeoutMs =
          timeoutRaw !== undefined
            ? Math.min(Math.max(Math.floor(timeoutRaw), TRAFFIC_WAIT_TIMEOUT_MIN_MS), TRAFFIC_WAIT_TIMEOUT_MAX_MS)
            : TRAFFIC_WAIT_TIMEOUT_DEFAULT_MS;
        const startedAt = Date.now();
        // Long waits keep the client informed when it opted into
        // progress — fire-and-forget, never load-bearing.
        const ticker = ctx.progress
          ? setInterval(() => {
              ctx.progress?.({
                progress: Date.now() - startedAt,
                total: timeoutMs,
                message: 'waiting for a matching exchange',
              });
            }, 5_000)
          : undefined;
        ticker?.unref?.();
        try {
          const result = await deps.tap.waitForRecord(uid, (record) => matchesFilters(record, filters), { timeoutMs });
          const waitedMs = Date.now() - startedAt;
          if (result === null || (!result.ok && result.reason === 'source-disarmed')) {
            // The arm lapsed or a human disarmed mid-wait — the source is
            // now ABSENT, and the wait reports that rather than a bare miss.
            return { workspaceId, uid, matched: false, reason: 'source-disarmed', waitedMs };
          }
          if (!result.ok) {
            return { workspaceId, uid, matched: false, reason: 'timeout', waitedMs, timeoutMs };
          }
          return { workspaceId, uid, matched: true, waitedMs, row: projectListRow(result.record) };
        } finally {
          if (ticker !== undefined) clearInterval(ticker);
        }
      },
    },
    {
      name: 'traffic_to_rule',
      title: 'Mint a response-override rule from an observed exchange',
      description:
        'Mint a response-override rule from one observed exchange — "make this endpoint serve X" in ' +
        'one call. The exchange URL becomes the match condition (origin + path; the query is ignored so the ' +
        'rule matches the re-fire), and the rule serves a MOCK response (the request never reaches the ' +
        'server) built from the observed status, content type and body — pass statusCode / body / ' +
        'contentType to serve a fix instead (e.g. statusCode 200 with a healthy body for an endpoint that ' +
        'is currently failing). CORS response headers are copied from the observed response; when none were ' +
        'observed and the request was cross-origin, a permissive set is synthesized and reported (a ' +
        'hand-written mock reliably forgets them). A missing or binary body mints an empty body with an ' +
        'honest note, never an error. The rule is PUBLISHED by default — live in connected browser ' +
        'extensions immediately; pass published: false to mint an unpublished draft for human review ' +
        'instead. Exception: [redacted:<hash>] markers are minted verbatim (secrets are never revealed), ' +
        'and when any minted field carries one the rule is forced to a DRAFT with the fields listed in ' +
        'redactedFields — publishing would serve the literal markers; a human fills the real values and ' +
        'publishes in Open Headers.',
      inputSchema: {
        type: 'object',
        properties: {
          uid: { type: 'string', description: 'Source uid from traffic_sources.' },
          requestId: { type: 'string', description: 'Request id from traffic_list / traffic_failures.' },
          statusCode: {
            type: 'number',
            description: 'Status the draft serves. Defaults to the observed status (200 when none exists).',
          },
          body: {
            type: 'string',
            description: 'Body the draft serves. Defaults to the observed body (retained or pulled).',
          },
          contentType: {
            type: 'string',
            description: 'Content type the draft serves. Defaults to the observed one.',
          },
          name: { type: 'string', description: 'Rule name. Defaults to "Override <METHOD> <path>".' },
          collectionUid: {
            type: 'string',
            description: 'Target rule collection. Omit to use the first collection in the workspace.',
          },
          published: {
            type: 'boolean',
            description:
              'Default true — the rule goes live in connected extensions immediately. Pass false to mint an ' +
              'unpublished draft for human review. Redacted fields always force a draft.',
          },
          ...WORKSPACE_ID_PROPERTY,
        },
        required: ['uid', 'requestId'],
        additionalProperties: false,
      },
      tier: 'write',
      resolveWorkspaceId: resolveWorkspaceIdArg,
      handler: async (args) => {
        const workspaceId = requireWorkspace(args);
        // The tier gate checks `write`, but this tool READS observed
        // traffic into the minted rule — without the observe switch it
        // would be a side door for traffic content through the write
        // grant, so both host switches must be on.
        if (!deps.isObserveEnabled()) {
          throw new McpToolInputError(
            'traffic_to_rule reads observed traffic, so it needs Traffic observation enabled in ' +
              'Open Headers → Settings → MCP in addition to Write access',
          );
        }
        const uid = requireSourceUid(deps, args);
        const requestId = requireStringArg(args, 'requestId');
        const record = deps.tap.getRecord(uid, requestId);
        if (record === null) {
          throw new McpToolInputError(
            `no exchange with requestId '${requestId}' on source '${uid}' — it may have been evicted by the ` +
              'retention bounds; see traffic_list',
          );
        }

        // Body precedence: agent argument → retained failure body →
        // on-demand pull → honestly empty (bodies decay — PLAN §3).
        let bodyInput: TrafficDraftBodyInput;
        if (typeof args.body === 'string') {
          bodyInput = { projection: { content: args.body, encoding: 'text', truncated: false }, source: 'argument' };
        } else if (record.failureBody !== undefined) {
          bodyInput = { projection: record.failureBody, source: 'retained-failure' };
        } else {
          const pull = await deps.tap.pullBody(uid, requestId);
          if (pull?.ok) {
            bodyInput = { projection: pull.body, source: 'pulled' };
          } else {
            const reason =
              pull === null || pull.reason === 'gone'
                ? 'the body decayed or the source cannot serve bodies'
                : pull.reason === 'in-flight'
                  ? 'the request has not completed yet'
                  : 'the exchange has no response body';
            bodyInput = {
              projection: null,
              source: 'empty',
              unavailableNote: `${reason} — the draft body is empty; fill responseBody before publishing`,
            };
          }
        }

        const statusOverride = optionalNumber(args, 'statusCode');
        const contentTypeOverride = optionalString(args, 'contentType');
        const draft = buildResponseOverrideDraft(record, bodyInput, {
          ...(statusOverride !== undefined ? { statusCode: Math.floor(statusOverride) } : {}),
          ...(contentTypeOverride !== undefined ? { contentType: contentTypeOverride } : {}),
        });

        // Published by default — the write grant is the consent boundary
        // (rules_create publishes through the same gate). Redacted fields
        // force a draft whatever was asked: publishing would serve the
        // literal [redacted:…] markers to live traffic.
        const publishRequested = args.published !== false;
        const published = publishRequested && draft.redactedFields.length === 0;
        const notes = [...draft.notes];
        if (publishRequested && !published) {
          notes.push(
            'redacted fields force a draft — fill the fields listed in redactedFields with real values and ' +
              'publish in Open Headers',
          );
        }

        const parentPath = await resolveRuleParentPath(workspaceId, optionalString(args, 'collectionUid'));
        const ruleUid = generateUid();
        const defaultName = `Override ${record.method.toUpperCase()} ${conditionValueForUrl(record.url)}`;
        const name = optionalString(args, 'name')?.trim() || defaultName;
        const created = parseOrThrow(
          RuleSchema,
          {
            schemaVersion: 5,
            uid: ruleUid,
            path: `${parentPath}/${toFolderName(name, ruleUid)}`,
            name,
            type: 'response',
            enabled: true,
            published,
            conditions: [{ uid: generateUid(), type: 'url-filter', values: [draft.conditionValue] }],
            action: {
              responseSource: 'mock',
              bodyType: 'static',
              responseBody: draft.responseBody,
              statusCode: draft.statusCode,
              contentType: draft.contentType,
              responseHeaders: draft.responseHeaders,
            },
          },
          'rule',
        );
        await applyMcpMutation(buildAddRuleBatch(created, mintMcpContext(workspaceId)));
        return {
          workspaceId,
          rule: created,
          published,
          observed: {
            uid,
            requestId,
            url: record.url,
            method: record.method,
            ...(record.statusCode !== undefined ? { statusCode: record.statusCode } : {}),
          },
          cors: { copied: draft.corsCopied, synthesized: draft.corsSynthesized },
          body: draft.body,
          redactedFields: draft.redactedFields,
          notes,
        };
      },
    },
  ];
}
