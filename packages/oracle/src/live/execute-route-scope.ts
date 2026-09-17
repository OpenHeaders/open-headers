/**
 * The frame's scope as every execute route reads it — the HTTP send
 * (`live/request-route/`) and the three session Connects
 * (`live/session-route/`) — and the pin rules every route applies: a
 * send or session runs UNPINNED (`workspaceId: null`, the Active-bound module mirrors
 * with their environment pointer) when the caller's workspace is this
 * host's runtime-Active one or unstated, PINNED to a foreign workspace
 * (a peer-forwarded frame — its scripts run Safe unconditionally),
 * and an explicit `environmentId: null` (the caller's "No
 * environment") pins the active workspace env-free. Storage reads
 * always need a concrete workspace: the requested one, else the
 * active one.
 */

import { peekActiveWorkspaceId } from '../workspace/extension-workspace-store';
import { executionPlaceBackendIdOf } from './execution-place-target';

export interface ExecuteRouteScope {
  /** Tri-state: string pins an env, `null` runs env-free, absent defers. */
  environmentId: string | null | undefined;
  requestedWorkspaceId: string | undefined;
  /** Caller-minted — the live frames' tag and the Stop handle;
   *  required for a session (interactive), optional for a send. */
  sendId: string | undefined;
  /** The frame's place by explicit backend id; absent = this host's own socket. */
  placeBackendId: string | undefined;
}

export function executeRouteScope(message: Record<string, unknown>): ExecuteRouteScope {
  return {
    environmentId:
      typeof message.environmentId === 'string' || message.environmentId === null ? message.environmentId : undefined,
    requestedWorkspaceId: typeof message.workspaceId === 'string' ? message.workspaceId : undefined,
    sendId: typeof message.sendId === 'string' ? message.sendId : undefined,
    placeBackendId: executionPlaceBackendIdOf(message),
  };
}

/** The pinned run: the executor's `workspaceId` (null = unpinned),
 *  the workspace storage reads and the gate use, and whether the
 *  frame is a peer's (a foreign workspace). */
export interface ExecuteRunScope {
  workspaceId: string | null;
  readWorkspaceId: string;
  forwarded: boolean;
}

/** The pin rules over the host's active workspace — null when the
 *  host has none and the frame names none (a tab before adoption). */
export function pinExecuteScope(scope: ExecuteRouteScope): ExecuteRunScope | null {
  const activeWorkspaceId = peekActiveWorkspaceId();
  const { environmentId, requestedWorkspaceId } = scope;
  const readWorkspaceId = requestedWorkspaceId ?? activeWorkspaceId;
  if (readWorkspaceId === null) return null;
  const forwarded = requestedWorkspaceId !== undefined && requestedWorkspaceId !== activeWorkspaceId;
  const workspaceId = forwarded ? readWorkspaceId : environmentId === null ? readWorkspaceId : null;
  return { workspaceId, readWorkspaceId, forwarded };
}

export const NO_ACTIVE_WORKSPACE_MESSAGE = 'No active workspace';
export const NO_SEND_ID_MESSAGE = 'No sendId provided — a session needs one';
