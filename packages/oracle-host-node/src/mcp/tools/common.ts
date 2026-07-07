/**
 * Shared plumbing for MCP tool handlers — workspace resolution (used
 * by every workspace-scoped tool, read and write) and the write-side
 * batch mint + apply pair.
 *
 * Workspace resolution: every workspace-scoped tool takes an optional
 * `workspaceId` and defaults to the runtime-active workspace. Snapshots
 * only exist for workspaces materialized on this host — a valid-but-
 * unloaded workspace returns a distinct error (not a silent `[]`) so
 * the agent doesn't mistake "not hydrated" for "empty".
 *
 * Write plumbing: MCP mutations mint an SW context against the target
 * workspace's HLC sequencer (`surfaceId: 'mcp'` so the activity feed
 * attributes agent-driven changes distinctly) and ride the canonical
 * `applySyncRequest` path — HLC-stamped, capability-gated, persisted,
 * broadcast to every open renderer and WS peer. Same discipline as
 * `dispatchRevertActivity`, the existing non-renderer batch minter.
 */

import {
  computeInverseSpec,
  type MutationBatch,
  type MutatorContext,
  type SideEffectIntent,
} from '@openheaders/core/sync';
import type { Request } from '@openheaders/core/types';
import { getActiveEnvironmentId } from '@openheaders/oracle/entity/environment-store';
import { makeOracleInverseAccess, peekActiveWorkspaceId, rememberPriorForMutation } from '@openheaders/oracle/sync';
import {
  applySyncRequest,
  getOracleForWorkspace,
  nextSwMutatorContextForWorkspace,
  snapshotEnvironmentPostStates,
  snapshotRequestPostStates,
} from '@openheaders/oracle/sync/service';
import { listWorkspaces } from '@openheaders/oracle/workspace/extension-workspace-store';
import { MCP_SURFACE_ID, McpToolInputError } from '../registry';

export const WORKSPACE_ID_PROPERTY = {
  workspaceId: {
    type: 'string',
    description: 'Target workspace id. Omit to use the active workspace (see workspaces_list).',
  },
} as const;

export function resolveWorkspaceIdArg(args: Record<string, unknown>): string | undefined {
  const raw = args.workspaceId;
  if (typeof raw === 'string' && raw.length > 0) return raw;
  return peekActiveWorkspaceId() ?? undefined;
}

/**
 * Assert a workspace id is materialized on this host, distinguishing
 * "known but not loaded" (snapshots would silently read `[]`) from
 * "never seen".
 */
export function assertWorkspaceLoaded(id: string): void {
  if (getOracleForWorkspace(id) === null) {
    const known = listWorkspaces().some((ws) => ws.id === id);
    throw new McpToolInputError(
      known
        ? `workspace '${id}' exists but is not loaded on this host yet — activate it with workspaces_switch`
        : `unknown workspace '${id}' — valid ids come from workspaces_list`,
    );
  }
}

/**
 * Resolve + validate the workspace a tool call targets. Throws
 * agent-readable errors for the three failure shapes: no workspace
 * context at all, an id this host has never seen, and a known-but-not-
 * loaded workspace.
 */
export function requireWorkspace(args: Record<string, unknown>): string {
  const id = resolveWorkspaceIdArg(args);
  if (id === undefined) {
    throw new McpToolInputError('no active workspace on this host — pass workspaceId (see workspaces_list)');
  }
  assertWorkspaceLoaded(id);
  return id;
}

/** Required-string argument reader with an agent-readable failure. */
export function requireStringArg(args: Record<string, unknown>, name: string): string {
  const raw = args[name];
  if (typeof raw !== 'string' || raw.length === 0) {
    throw new McpToolInputError(`'${name}' is required and must be a non-empty string`);
  }
  return raw;
}

/** Uid-keyed request lookup with the agent-readable miss copy. */
export function findRequest(workspaceId: string, uid: string): Request {
  const match = snapshotRequestPostStates(workspaceId).find((ps) => ps.request.uid === uid);
  if (!match) {
    throw new McpToolInputError(`no request with uid '${uid}' in workspace '${workspaceId}' — see requests_list`);
  }
  return match.request;
}

/**
 * Resolve the environment an execution runs under. An explicit
 * `environmentId` is validated against the workspace's environments;
 * omitted, the runtime-active workspace's active environment applies
 * (background workspaces run under "No environment" — their active-env
 * pointer is not hydrated).
 */
export function resolveEnvironmentArg(workspaceId: string, args: Record<string, unknown>): string | null {
  const raw = args.environmentId;
  if (typeof raw === 'string' && raw.length > 0) {
    const known = snapshotEnvironmentPostStates(workspaceId).some((ps) => ps.environment.uid === raw);
    if (!known) {
      throw new McpToolInputError(
        `no environment with uid '${raw}' in workspace '${workspaceId}' — see environments_list`,
      );
    }
    return raw;
  }
  return workspaceId === peekActiveWorkspaceId() ? (getActiveEnvironmentId() ?? null) : null;
}

/**
 * Mint a fresh `MutatorContext` from the target workspace's HLC
 * sequencer. `requireWorkspace` has already proven the service is
 * materialized, so a null here is a lifecycle race — surfaced with the
 * same "not loaded" copy the resolution path uses.
 */
export function mintMcpContext(workspaceId: string): MutatorContext {
  const ctx = nextSwMutatorContextForWorkspace(workspaceId, { surfaceId: MCP_SURFACE_ID });
  if (!ctx) {
    throw new McpToolInputError(
      `workspace '${workspaceId}' is not loaded on this host — activate it with workspaces_switch`,
    );
  }
  return ctx;
}

export interface McpMutationPayload {
  batch: MutationBatch;
  sideEffects: SideEffectIntent[];
}

/**
 * Stash each envelope's pre-apply materialized state + inverse spec by
 * mutationId — the Activity Feed classifier's inputs. Mirrors the
 * inbound bridge's speculative capture: MCP mutations are an agent
 * surface, so hosts classify them into the feed (with working Revert)
 * exactly like peer-sourced envelopes, keyed off {@link MCP_SURFACE_ID}.
 */
function capturePriorsForActivity(batch: MutationBatch): void {
  for (const env of batch.mutations) {
    const oracle = getOracleForWorkspace(env.workspaceId);
    const prior = oracle ? oracle.materializeOne(env.body.type, env.body.id) : null;
    const access = makeOracleInverseAccess({
      oracle,
      entityType: env.body.type,
      entityId: env.body.id,
      prior,
    });
    const spec = computeInverseSpec(env.body, access);
    const inverse = spec === null ? null : { mutatorVersion: env.mutatorVersion, spec };
    rememberPriorForMutation(env.mutationId, env.workspaceId, prior, inverse);
  }
}

/**
 * Route a minted batch through the canonical write path. An apply
 * rejection is agent-correctable in every case we can produce here
 * (schema-rejected input, tombstoned target), so failures surface as
 * {@link McpToolInputError} with the oracle's failure detail.
 */
export async function applyMcpMutation(payload: McpMutationPayload): Promise<void> {
  if (payload.batch.mutations.length === 0) return;
  capturePriorsForActivity(payload.batch);
  const response = await applySyncRequest({
    type: 'oh.sync.apply',
    batch: payload.batch,
    sideEffects: payload.sideEffects,
  });
  if (!response.ok) {
    const detail = response.failure?.detail ?? response.failure?.status ?? 'apply failed';
    throw new McpToolInputError(`mutation rejected: ${detail}`);
  }
}
