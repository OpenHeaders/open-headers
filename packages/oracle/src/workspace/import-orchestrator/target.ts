/**
 * Target-workspace resolution + storage read — picks/creates the
 * import target per the selector, and flattens the target's storage
 * into the `TargetWorkspaceState` the diff consumes.
 */

import type {
  Collection,
  Environment,
  Folder,
  LiveVariable,
  LiveWorkflow,
  Request,
  Rule,
  Template,
  Vault,
  WorkspaceVariables,
} from '@openheaders/core/types';
import type { TargetWorkspaceState } from '@openheaders/core/workspace-export';
import { hostStorage, type PersistedLocalFolder, wsKeys } from '@openheaders/oracle/storage';
import {
  createWorkspace as createWorkspaceMeta,
  getActiveWorkspaceId,
  getWorkspace,
  listWorkspaces,
} from '@openheaders/oracle/workspace/extension-workspace-store';
import type { ImportWorkspaceArgs } from './types';

export async function resolveTargetWorkspace(args: ImportWorkspaceArgs): Promise<string> {
  if (args.target.mode === 'current') return getActiveWorkspaceId();
  if (args.target.mode === 'picked') {
    const ws = getWorkspace(args.target.workspaceId);
    if (!ws) throw new Error(`Picked workspace ${args.target.workspaceId} not found`);
    return ws.id;
  }
  // mode: 'new' — create a fresh workspace using export's metadata.
  // Append " (imported)" suffix on name collision (design §2.4).
  // Advanced override (design §5.5): refuseUidCollision blocks the
  // create when an existing workspace carries the export's
  // `workspace.uid`. The default behavior is silent uid regen via
  // `createWorkspace` (the new workspace gets a fresh uid regardless).
  if (args.refuseUidCollision) {
    const incomingUid = args.incoming.workspace.uid;
    const collision = listWorkspaces().find((w) => w.id === incomingUid);
    if (collision) {
      throw new Error(
        `A workspace with uid ${incomingUid} already exists ("${collision.name}"). Switch the import target to "Pick existing" to merge into it, or turn off "Refuse on workspace.uid collision" in Advanced.`,
      );
    }
  }
  // User-overridden name from the modal (mode='new') wins; otherwise
  // fall back to the export's own workspace name.
  const baseName =
    args.target.mode === 'new' && args.target.name && args.target.name.trim().length > 0
      ? args.target.name.trim()
      : args.incoming.workspace.name;
  const desiredName = collidingName(baseName);
  const meta = await createWorkspaceMeta({
    name: desiredName,
    description: args.incoming.workspace.description,
    color: args.incoming.workspace.color,
    icon: args.incoming.workspace.icon,
    kind: 'personal', // forced (design §5.5)
    // Org choice from the modal's new-target select; absent keeps the
    // store's default (home Org). A consumed Org's list row syncs up,
    // gated by `workspace.create` on the backend.
    ...(args.target.mode === 'new' && args.target.orgId ? { orgId: args.target.orgId } : {}),
  });
  return meta.id;
}

function collidingName(desired: string): string {
  const existing = new Set(listWorkspaces().map((w) => w.name));
  if (!existing.has(desired)) return desired;
  return `${desired} (imported)`;
}

// ── Read target storage → TargetWorkspaceState ─────────────────────

/**
 * Per-storage-key buckets returned alongside the flattened
 * `TargetWorkspaceState`. The orchestrator needs both — the flat
 * `targetState` drives the diff; the per-bucket `target` rebuilds
 * the three trees on write.
 */
export interface ReadTargetResult {
  target: {
    rules?: Rule[];
    collections?: Collection[];
    folders?: PersistedLocalFolder[];
    requests?: Request[];
    requestCollections?: Collection[];
    requestFolders?: PersistedLocalFolder[];
    templates?: Template[];
    templateCollections?: Collection[];
    templateFolders?: PersistedLocalFolder[];
    environments?: Environment[];
    workspaceVars?: WorkspaceVariables;
    vault?: Vault;
    liveWorkflows?: LiveWorkflow[];
    liveVariables?: LiveVariable[];
  };
  targetState: TargetWorkspaceState;
}

/** Read target workspace storage and flatten it into a `TargetWorkspaceState`.
 *  Lock-free — callers acquire the workspace-import lock when they need
 *  read-modify-write consistency. */
export async function readTargetWorkspaceState(workspaceId: string): Promise<ReadTargetResult> {
  const k = wsKeys(workspaceId);
  const target = await hostStorage.getMany({
    rules: k.rules,
    collections: k.collections,
    folders: k.folders,
    requests: k.requests,
    requestCollections: k.requestCollections,
    requestFolders: k.requestFolders,
    templates: k.templates,
    templateCollections: k.templateCollections,
    templateFolders: k.templateFolders,
    environments: k.environments,
    workspaceVars: k.workspaceVars,
    vault: k.vault,
    liveWorkflows: k.liveWorkflows,
    liveVariables: k.liveVariables,
  });
  const targetState: TargetWorkspaceState = {
    collections: [
      ...((target.collections ?? []) as Collection[]),
      ...((target.requestCollections ?? []) as Collection[]),
      ...((target.templateCollections ?? []) as Collection[]),
    ],
    folders: [
      ...((target.folders ?? []) as Folder[]),
      ...((target.requestFolders ?? []) as Folder[]),
      ...((target.templateFolders ?? []) as Folder[]),
    ],
    rules: target.rules ?? [],
    requests: target.requests ?? [],
    templates: target.templates ?? [],
    environments: target.environments ?? [],
    liveWorkflows: target.liveWorkflows ?? [],
    liveVariables: target.liveVariables ?? [],
    ...(target.workspaceVars ? { workspaceVars: target.workspaceVars } : {}),
    ...(target.vault ? { vault: target.vault } : {}),
  };
  return { target, targetState };
}
