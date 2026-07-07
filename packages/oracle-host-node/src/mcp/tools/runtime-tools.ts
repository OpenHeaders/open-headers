/**
 * Runtime MCP tools — the one non-entity tool family: workspace and
 * environment switching, plus workspace creation. These change per-host
 * RUNTIME state (which workspace's stores are hydrated, which
 * environment resolves variables), so they don't ride `applySyncRequest`
 * batches of their own. Instead they call the SAME store functions the
 * Workbench rides — no parallel switch path:
 *
 *   - `workspaces_create` / `workspaces_switch` → the workspace store's
 *     SW-internal write path, which emits the identical
 *     set/setActive `extensionWorkspace` batches the renderer's
 *     workspace switcher applies. The active-flip side-effect intent
 *     drives the coordinator's per-workspace store swap; the switch
 *     tool awaits that swap settling before reporting post-state.
 *   - `environments_switch` → the per-workspace pointer keys
 *     (`activeEnvironmentId` + `manualEnvId`) the Workbench env-picker
 *     writes; the environment store observes the write and applies the
 *     same cascade (resolver invalidate, rule recompile, live re-warm).
 *     The pointer is runtime state hydrated only for the runtime-active
 *     workspace, so switching a background workspace's environment is
 *     an agent-readable error, not a silent no-op.
 */

import { EXTENSION_WORKSPACE_GLOBAL_SCOPE } from '@openheaders/core/sync';
import {
  getActiveEnvironmentId,
  getLoadedWorkspaceId,
  onEnvironmentStoreChange,
} from '@openheaders/oracle/entity/environment-store';
import { hostStorage, wsKeys } from '@openheaders/oracle/storage';
import { peekActiveWorkspaceId } from '@openheaders/oracle/sync';
import { getOracleForWorkspace, snapshotEnvironmentPostStates } from '@openheaders/oracle/sync/service';
import {
  createWorkspace,
  getWorkspace,
  listWorkspaces,
  setActiveWorkspaceById,
} from '@openheaders/oracle/workspace/extension-workspace-store';
import { MCP_SURFACE_ID, type McpToolDefinition, McpToolInputError } from '../registry';
import { requireStringArg, requireWorkspace, WORKSPACE_ID_PROPERTY } from './common';

/** How long a switch may take to settle before we report the honest,
 *  possibly still-flipping post-state instead of blocking the client. */
const SWITCH_SETTLE_TIMEOUT_MS = 10_000;

function workspaceRow(id: string): Record<string, unknown> {
  const ws = getWorkspace(id);
  return {
    id,
    name: ws?.name,
    kind: ws?.kind,
    active: id === peekActiveWorkspaceId(),
    loaded: getOracleForWorkspace(id) !== null,
  };
}

/**
 * Resolve when the runtime switch to `workspaceId` has settled — the
 * active pointer flipped, the per-workspace store swap (observed via
 * the environment store) landed, and the workspace service is
 * materialized. The coordinator drains the swap intent asynchronously
 * after the setActive broadcast, so the mutation resolving does not
 * imply the stores are hydrated yet. The swap chain emits no single
 * completion event, so this polls the three post-conditions.
 */
async function waitForRuntimeSwitch(workspaceId: string): Promise<boolean> {
  const settled = () =>
    peekActiveWorkspaceId() === workspaceId &&
    getLoadedWorkspaceId() === workspaceId &&
    getOracleForWorkspace(workspaceId) !== null;
  const deadline = Date.now() + SWITCH_SETTLE_TIMEOUT_MS;
  while (!settled()) {
    if (Date.now() > deadline) return false;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return true;
}

async function switchRuntimeWorkspace(id: string): Promise<void> {
  await setActiveWorkspaceById(id, { surfaceId: MCP_SURFACE_ID });
  await waitForRuntimeSwitch(id);
}

/**
 * Resolve when the active-environment pointer reads `environmentId`.
 * The store applies pointer writes through its storage subscription,
 * which may deliver asynchronously after `hostStorage.set` resolves.
 */
function waitForActiveEnvironment(environmentId: string | null): Promise<boolean> {
  if (getActiveEnvironmentId() === environmentId) return Promise.resolve(true);
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      unsubscribe();
      resolve(false);
    }, SWITCH_SETTLE_TIMEOUT_MS);
    const unsubscribe = onEnvironmentStoreChange(() => {
      if (getActiveEnvironmentId() !== environmentId) return;
      clearTimeout(timer);
      unsubscribe();
      resolve(true);
    });
  });
}

export function createRuntimeToolDefinitions(): McpToolDefinition[] {
  return [
    {
      name: 'workspaces_create',
      title: 'Create workspace',
      description:
        'Create a new, empty workspace on this host. The workspace starts as a background workspace — pass ' +
        'activate: true (or call workspaces_switch) to make it the active one before creating rules, ' +
        'requests, or environments in it.',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Workspace name.' },
          description: { type: 'string' },
          activate: {
            type: 'boolean',
            description: 'Switch to the new workspace immediately (same as a follow-up workspaces_switch).',
          },
        },
        required: ['name'],
        additionalProperties: false,
      },
      tier: 'write',
      // Workspace creation is a global-scope mutation — gate against the
      // same scope the renderer's create batch resolves to.
      resolveWorkspaceId: () => EXTENSION_WORKSPACE_GLOBAL_SCOPE,
      handler: async (args) => {
        const name = requireStringArg(args, 'name');
        const description = typeof args.description === 'string' ? args.description : undefined;
        const created = await createWorkspace({ name, description }, { surfaceId: MCP_SURFACE_ID });
        if (args.activate === true) {
          await switchRuntimeWorkspace(created.id);
        }
        return {
          activeWorkspaceId: peekActiveWorkspaceId(),
          workspace: workspaceRow(created.id),
        };
      },
    },
    {
      name: 'workspaces_switch',
      title: 'Switch active workspace',
      description:
        'Make a workspace the active one on this host — the same switch the workspace picker performs: its ' +
        'stores hydrate, rules recompile on connected browsers, and workspace-scoped tools default to it. ' +
        'Returns the post-switch workspace list state.',
      inputSchema: {
        type: 'object',
        properties: {
          workspaceId: { type: 'string', description: 'Target workspace id from workspaces_list.' },
        },
        required: ['workspaceId'],
        additionalProperties: false,
      },
      tier: 'write',
      resolveWorkspaceId: (args) => {
        const raw = args.workspaceId;
        return typeof raw === 'string' && raw.length > 0 ? raw : undefined;
      },
      handler: async (args) => {
        const id = requireStringArg(args, 'workspaceId');
        if (!listWorkspaces().some((ws) => ws.id === id)) {
          throw new McpToolInputError(`unknown workspace '${id}' — valid ids come from workspaces_list`);
        }
        const previous = peekActiveWorkspaceId();
        if (previous !== id) {
          await switchRuntimeWorkspace(id);
        }
        return {
          activeWorkspaceId: peekActiveWorkspaceId(),
          previousWorkspaceId: previous,
          workspace: workspaceRow(id),
        };
      },
    },
    {
      name: 'environments_switch',
      title: 'Switch active environment',
      description:
        'Switch the active environment of the ACTIVE workspace — the same pick the environment selector ' +
        'performs: variables resolve under it immediately and rules recompile on connected browsers. Pass an ' +
        'environment uid from environments_list, or null for "No environment". Background workspaces keep no ' +
        'active-environment pointer — call workspaces_switch first to act on one.',
      inputSchema: {
        type: 'object',
        properties: {
          environmentId: {
            type: ['string', 'null'],
            description: 'Environment uid from environments_list, or null for "No environment".',
          },
          ...WORKSPACE_ID_PROPERTY,
        },
        required: ['environmentId'],
        additionalProperties: false,
      },
      tier: 'write',
      resolveWorkspaceId: (args) => {
        const raw = args.workspaceId;
        return typeof raw === 'string' && raw.length > 0 ? raw : undefined;
      },
      handler: async (args) => {
        const workspaceId = requireWorkspace(args);
        if (workspaceId !== peekActiveWorkspaceId()) {
          throw new McpToolInputError(
            `workspace '${workspaceId}' is not the active workspace — its active-environment pointer is ` +
              'runtime state of the active workspace only. Call workspaces_switch first.',
          );
        }
        const raw = args.environmentId;
        if (raw !== null && (typeof raw !== 'string' || raw.length === 0)) {
          throw new McpToolInputError('\'environmentId\' must be an environment uid or null for "No environment"');
        }
        const environment =
          raw === null
            ? null
            : (snapshotEnvironmentPostStates(workspaceId).find((ps) => ps.environment.uid === raw)?.environment ??
              null);
        if (raw !== null && environment === null) {
          throw new McpToolInputError(
            `no environment with uid '${raw}' in workspace '${workspaceId}' — see environments_list`,
          );
        }
        // Same two writes as a manual pick in the env selector: the
        // manual base first (so auto-switch respects the pick), then
        // the active pointer the store's subscription cascades on.
        const keys = wsKeys(workspaceId);
        await hostStorage.set(keys.manualEnvId, raw);
        await hostStorage.set(keys.activeEnvironmentId, raw);
        await waitForActiveEnvironment(raw);
        return {
          workspaceId,
          activeEnvironmentId: getActiveEnvironmentId(),
          environment: environment === null ? null : { uid: environment.uid, name: environment.name },
        };
      },
    },
  ];
}
