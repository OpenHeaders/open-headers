/**
 * Workspace-tree runtime — snapshot assembly: the bound workspace's
 * `wsKeys` slots + workspace meta folded into the `WorkspaceTreeState`
 * the sweep/materialize planes consume, plus the shared batch
 * applicator. Pure reads against host storage; no binding state.
 */

import type { EmissionBatch } from '@openheaders/core/sync-builders/mutations/workspace-import-emission';
import type { Workspace } from '@openheaders/core/types';
import { logger } from '@openheaders/core/utils';
import type { WorkspaceTreeState } from '@openheaders/core/workspace-tree';
import { hostStorage, wsKeys } from '@openheaders/oracle/storage';
import type { WorkspaceServiceState } from '@openheaders/oracle/sync/service';
import { getWorkspace } from '@openheaders/oracle/workspace/extension-workspace-store';
import { SCOPE } from './core';

/** The workspace entity the manifest carries — meta + the synced default-env pointer. */
export async function workspaceEntity(workspaceId: string): Promise<Workspace | null> {
  const meta = getWorkspace(workspaceId);
  if (!meta) return null;
  const defaultEnvironmentId = await hostStorage.get(wsKeys(workspaceId).defaultEnvironmentId);
  return {
    schemaVersion: 5,
    uid: meta.id,
    name: meta.name,
    ...(meta.description !== undefined ? { description: meta.description } : {}),
    ...(defaultEnvironmentId ? { defaultEnvironmentId } : {}),
    orgId: meta.orgId,
  };
}

export async function buildSnapshot(workspaceId: string): Promise<WorkspaceTreeState> {
  const workspace = await workspaceEntity(workspaceId);
  if (!workspace) throw new Error(`workspace ${workspaceId} is gone`);
  const k = wsKeys(workspaceId);
  const src = await hostStorage.getMany({
    rules: k.rules,
    collections: k.collections,
    folders: k.folders,
    requests: k.requests,
    grpcRequests: k.grpcRequests,
    websocketRequests: k.websocketRequests,
    requestCollections: k.requestCollections,
    requestFolders: k.requestFolders,
    templates: k.templates,
    templateCollections: k.templateCollections,
    templateFolders: k.templateFolders,
    environments: k.environments,
    workspaceVars: k.workspaceVars,
    vault: k.vault,
    specs: k.specs,
    liveWorkflows: k.liveWorkflows,
    liveVariables: k.liveVariables,
  });
  return {
    workspace,
    rules: src.rules ?? [],
    collections: src.collections ?? [],
    folders: src.folders ?? [],
    requests: src.requests ?? [],
    grpcRequests: src.grpcRequests ?? [],
    websocketRequests: src.websocketRequests ?? [],
    requestCollections: src.requestCollections ?? [],
    requestFolders: src.requestFolders ?? [],
    templates: src.templates ?? [],
    templateCollections: src.templateCollections ?? [],
    templateFolders: src.templateFolders ?? [],
    environments: src.environments ?? [],
    workspaceVariables: src.workspaceVars ?? null,
    vault: src.vault ?? null,
    specs: src.specs ?? [],
    liveWorkflows: src.liveWorkflows ?? [],
    liveVariables: src.liveVariables ?? [],
  };
}

export async function applyAll(service: WorkspaceServiceState, batches: EmissionBatch[]): Promise<void> {
  for (const { label, batch, sideEffects } of batches) {
    const result = await service.oracle.apply(batch, sideEffects);
    if (!result.ok) {
      logger.warn(SCOPE, `tree batch ${label} rejected (${result.failure?.status ?? 'unknown'})`);
    }
  }
}
