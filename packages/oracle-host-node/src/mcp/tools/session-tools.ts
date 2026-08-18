/**
 * Session MCP tools — the C7 tier of the agent traffic epic
 * (the agent-traffic plan §11.5): agent reads over the sessions ARCHIVE,
 * the durable sibling of the live `traffic_*` family. Three tools, all
 * `observe`-tier:
 *
 *   - `traffic_sessions`      — the archive index (meta facts only).
 *   - `traffic_session_list`  — one sealed session's record rows, the
 *                               live family's filter vocabulary.
 *   - `traffic_session_get`   — one exchange in full, with the body
 *                               the archive recorded (the one pull
 *                               that always succeeds).
 *
 * Contracts inherited structurally:
 *
 *   - **Redaction at the boundary** (§11.5): the injected
 *     {@link TrafficSessionQuery} projects; this module has no raw
 *     record, no event line, and no way to ask for raw — the
 *     persistent Settings grant decides, and each read reports back
 *     whether it projected raw so the visibility seam can flag it
 *     (`ctx.markRawRead`).
 *   - **Human-only operator plane** (finding 28): list/read only —
 *     no tool starts, stops, renames, refiles or deletes a session.
 *   - **Visibility** (finding 13): `observe` tier ⇒ every successful
 *     call lands in the Activity Feed; raw-projected calls carry the
 *     raw flag.
 *   - **The host computes, the agent queries** (PLAN §5): filters and
 *     pagination run here; rows are lean; bodies ride only the
 *     single-exchange read.
 */

import type { TrafficArchivedSessionProjection } from '@openheaders/core/traffic';
import type { TrafficSessionQuery, TrafficSessionRecordRead, TrafficSessionRowsRead } from '../../traffic';
import { type McpToolDefinition, McpToolInputError } from '../registry';
import { requireStringArg, requireWorkspace, resolveWorkspaceIdArg, WORKSPACE_ID_PROPERTY } from './common';
import {
  LIST_LIMIT_DEFAULT,
  LIST_LIMIT_MAX,
  matchesFilters,
  parseListFilters,
  parsePage,
  projectListRow,
  REDACTION_NOTE,
} from './traffic-tools';

export interface McpSessionToolDeps {
  readonly sessions: TrafficSessionQuery;
}

/** Shared description suffix for the two content-bearing reads — the
 *  grant is agent-facing prompt surface too: the agent must know why
 *  values look redacted and that only a human Setting changes that. */
const GRANT_NOTE =
  'Reads are redacted by default; a human can enable unredacted session reads in Open Headers → ' +
  'Settings → Traffic, in which case the result reports projection: "raw" and every such ' +
  'read is logged to the Activity Feed.';

/** One archive index row for agents — meta facts only, never content. */
function projectSessionIndexRow(session: TrafficArchivedSessionProjection): Record<string, unknown> {
  return {
    sessionId: session.id,
    name: session.name,
    ...(session.collection !== undefined ? { collection: session.collection } : {}),
    ...(session.folder !== undefined ? { folder: session.folder } : {}),
    sourceKind: session.sourceKind,
    sourceLabel: session.sourceLabel,
    state: session.state,
    startedAtMs: session.startedAtMs,
    ...(session.stoppedAtMs !== undefined ? { stoppedAtMs: session.stoppedAtMs } : {}),
    ...(session.endReason !== undefined ? { endReason: session.endReason } : {}),
    requests: session.requests,
    errors: session.errors,
    events: session.events,
    sizeBytes: session.sizeBytes,
    encrypted: session.encrypted,
    fidelity: session.fidelity,
    planes: session.planes,
    origins: session.origins,
  };
}

/** Open one sealed session's rows, translating the archive's refusals
 *  into agent-correctable tool errors. */
async function readSessionRows(deps: McpSessionToolDeps, sessionId: string): Promise<TrafficSessionRowsRead> {
  try {
    return await deps.sessions.records(sessionId);
  } catch (err) {
    throw new McpToolInputError(sessionReadRefusal(sessionId, err));
  }
}

async function readSessionRecord(
  deps: McpSessionToolDeps,
  sessionId: string,
  requestId: string,
): Promise<TrafficSessionRecordRead | null> {
  try {
    return await deps.sessions.getRecord(sessionId, requestId);
  } catch (err) {
    throw new McpToolInputError(sessionReadRefusal(sessionId, err));
  }
}

function sessionReadRefusal(sessionId: string, err: unknown): string {
  const reason = err instanceof Error ? err.message : String(err);
  return `cannot read session '${sessionId}': ${reason} — see traffic_sessions for the sessions this host can serve`;
}

const BODY_GAP_TEXT = {
  'phase-failed': 'the request failed before a response body existed (network error, block, timeout, or abort)',
  'not-recorded':
    'the session recorded no body for this exchange — heuristic-fidelity sessions cannot record response ' +
    'bodies, and a body that never crossed the wire during recording is not in the archive',
} as const;

export function createSessionToolDefinitions(deps: McpSessionToolDeps): McpToolDefinition[] {
  const observeScoped: Pick<McpToolDefinition, 'tier' | 'resolveWorkspaceId'> = {
    tier: 'observe',
    // Same posture as the live family (STATUS finding 13): the observe
    // visibility seam needs a workspace to land the read in.
    resolveWorkspaceId: resolveWorkspaceIdArg,
  };

  return [
    {
      name: 'traffic_sessions',
      title: 'List archived traffic sessions',
      description:
        'List the traffic sessions a human has RECORDED into the archive on this computer: sessionId, ' +
        'name, collection/folder, source, state (recording/sealing/sealed), time range, request/error/event counts, ' +
        'size, fidelity (cdp/heuristic/proxy), and origins. Sessions are durable recordings of observed ' +
        'traffic — recording, organizing and deleting them are human gestures; no tool can do any of ' +
        'that. Only SEALED sessions are readable; pass a sessionId to traffic_session_list or ' +
        'traffic_session_get to read one. Rows are index facts only — never headers, bodies, or records.',
      inputSchema: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: `Max rows (default ${LIST_LIMIT_DEFAULT}, max ${LIST_LIMIT_MAX}).`,
          },
          offset: { type: 'number', description: 'Rows to skip (default 0) — pagination cursor.' },
          ...WORKSPACE_ID_PROPERTY,
        },
        additionalProperties: false,
      },
      ...observeScoped,
      handler: async (args) => {
        const workspaceId = requireWorkspace(args);
        const { limit, offset } = parsePage(args);
        const sessions = await deps.sessions.list();
        const page = sessions.slice(offset, offset + limit);
        return {
          workspaceId,
          total: sessions.length,
          offset,
          limit,
          hasMore: offset + page.length < sessions.length,
          sessions: page.map(projectSessionIndexRow),
        };
      },
    },
    {
      name: 'traffic_session_list',
      title: 'List one archived session’s traffic',
      description:
        'List the recorded exchanges of one SEALED archived session (sessionId from traffic_sessions) as ' +
        'lean projected rows — method, status, URL, timing, sizes, initiator, normalized resourceType; ' +
        'never headers or bodies (traffic_session_get has those). Same filter vocabulary as traffic_list, ' +
        'run on the host: statusClass (2xx/3xx/4xx/5xx/error), method, urlContains, resourceType, ' +
        'sinceMs; rows are ordered oldest-first with honest total/matched counts. The archive outlives ' +
        'the wire: these reads work with the browser tab long closed. ' +
        GRANT_NOTE +
        ' ' +
        REDACTION_NOTE,
      inputSchema: {
        type: 'object',
        properties: {
          sessionId: { type: 'string', description: 'Session id from traffic_sessions.' },
          statusClass: {
            type: 'string',
            enum: ['2xx', '3xx', '4xx', '5xx', 'error'],
            description: "Status bucket; 'error' = requests that failed without an HTTP status.",
          },
          method: { type: 'string', description: 'HTTP method filter (case-insensitive).' },
          urlContains: { type: 'string', description: 'Substring match on the (projected) URL.' },
          resourceType: { type: 'string', description: 'Normalized resource type, e.g. fetch, xhr, document.' },
          sinceMs: { type: 'number', description: 'Only rows started at or after this epoch-ms instant.' },
          limit: { type: 'number', description: `Max rows (default ${LIST_LIMIT_DEFAULT}, max ${LIST_LIMIT_MAX}).` },
          offset: { type: 'number', description: 'Rows to skip (default 0) — pagination cursor.' },
          ...WORKSPACE_ID_PROPERTY,
        },
        required: ['sessionId'],
        additionalProperties: false,
      },
      ...observeScoped,
      handler: async (args, ctx) => {
        const workspaceId = requireWorkspace(args);
        const sessionId = requireStringArg(args, 'sessionId');
        const filters = parseListFilters(args);
        const { limit, offset } = parsePage(args);
        const read = await readSessionRows(deps, sessionId);
        if (read.raw) ctx.markRawRead?.();
        const matched = read.rows.filter((record) => matchesFilters(record, filters));
        const page = matched.slice(offset, offset + limit);
        return {
          workspaceId,
          sessionId,
          fidelity: read.fidelity,
          projection: read.raw ? 'raw' : 'redacted',
          total: read.rows.length,
          matched: matched.length,
          offset,
          limit,
          hasMore: offset + page.length < matched.length,
          ...(read.truncatedOldest > 0 ? { truncatedOldest: read.truncatedOldest } : {}),
          rows: page.map(projectListRow),
        };
      },
    },
    {
      name: 'traffic_session_get',
      title: 'Get one archived exchange in full',
      description:
        'Fetch one exchange of a SEALED archived session by requestId (from traffic_session_list): the ' +
        'full projection including request and response headers, plus the response body the session ' +
        'recorded — served from the archive, so it succeeds with the browser tab long gone. A session ' +
        'without a recorded body for the exchange reports the gap honestly in bodyUnavailable, never an ' +
        'error. Bodies are capped at 100,000 chars (truncated flagged); binary bodies arrive base64. ' +
        GRANT_NOTE +
        ' ' +
        REDACTION_NOTE,
      inputSchema: {
        type: 'object',
        properties: {
          sessionId: { type: 'string', description: 'Session id from traffic_sessions.' },
          requestId: { type: 'string', description: 'Request id from traffic_session_list.' },
          ...WORKSPACE_ID_PROPERTY,
        },
        required: ['sessionId', 'requestId'],
        additionalProperties: false,
      },
      ...observeScoped,
      handler: async (args, ctx) => {
        const workspaceId = requireWorkspace(args);
        const sessionId = requireStringArg(args, 'sessionId');
        const requestId = requireStringArg(args, 'requestId');
        const read = await readSessionRecord(deps, sessionId, requestId);
        if (read === null) {
          throw new McpToolInputError(
            `no exchange with requestId '${requestId}' in session '${sessionId}' — see traffic_session_list`,
          );
        }
        if (read.raw) ctx.markRawRead?.();
        return {
          workspaceId,
          sessionId,
          fidelity: read.fidelity,
          projection: read.raw ? 'raw' : 'redacted',
          record: read.record,
          ...(read.body !== undefined
            ? { body: read.body }
            : { bodyUnavailable: BODY_GAP_TEXT[read.bodyGap ?? 'not-recorded'] }),
        };
      },
    },
  ];
}
