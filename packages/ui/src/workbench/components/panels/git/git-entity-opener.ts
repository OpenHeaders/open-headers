/**
 * git-entity-opener — Jump to Source's seam between the git surfaces
 * (the Git window's changed files, the Push window) and the workbench's
 * editor tabs. The tool-window host registers its tab openers once per
 * mounted instance; a jump opens an entity's editor through them — the
 * entity a named row already knows, or the one the host says a tree
 * path belongs to. Module state, like the git panel registry: the dock
 * unmounts inactive tool windows and the openers must survive that.
 */

import { hostBridge, type WorkspaceTreeEntityRefWire } from '@openheaders/core/bridge';

/** The tab openers Jump to Source needs — a structural subset of the host's. */
export interface GitEntityOpeners {
  openEditTab: (uid: string) => void;
  openRequestEditTab: (uid: string, name: string, method?: string) => void;
  openGrpcRequestEditTab: (uid: string, name: string) => void;
  openWebSocketRequestEditTab: (uid: string, name: string) => void;
  openMqttRequestEditTab: (uid: string, name: string) => void;
  openGraphqlRequestEditTab: (uid: string, name: string) => void;
  openTemplateEditTab: (uid: string) => void;
  openSpecEdit: (uid: string, name: string) => void;
  openLiveWorkflowEdit: (uid: string, name: string) => void;
  openLiveVariables: () => void;
  openEnvironmentEdit: (uid: string, name: string) => void;
  openWorkspaceVariables: () => void;
  openVault: () => void;
  openCollectionOverview: (uid: string, name: string) => void;
  openRequestCollectionOverview: (uid: string, name: string) => void;
  openTemplateCollectionOverview: (uid: string, name: string) => void;
  openFolderOverview: (uid: string, name: string) => void;
  openRequestFolderOverview: (uid: string, name: string) => void;
  openTemplateFolderOverview: (uid: string, name: string) => void;
}

const registered = new Map<symbol, () => GitEntityOpeners>();

/**
 * A tool-window host offers its openers as a getter (its closures
 * change per render; the registration does not); the returned
 * function withdraws them.
 */
export function registerGitEntityOpeners(getOpeners: () => GitEntityOpeners): () => void {
  const key = Symbol('git-entity-openers');
  registered.set(key, getOpeners);
  return () => {
    registered.delete(key);
  };
}

/** Open the entity's editor through the openers; false when no opener fits. */
export function openGitEntity(openers: GitEntityOpeners, entity: WorkspaceTreeEntityRefWire): boolean {
  switch (entity.kind) {
    case 'rule':
      openers.openEditTab(entity.uid);
      return true;
    case 'request':
      openers.openRequestEditTab(entity.uid, entity.name, entity.method);
      return true;
    case 'grpc':
      openers.openGrpcRequestEditTab(entity.uid, entity.name);
      return true;
    case 'websocket':
      openers.openWebSocketRequestEditTab(entity.uid, entity.name);
      return true;
    case 'mqtt':
      openers.openMqttRequestEditTab(entity.uid, entity.name);
      return true;
    case 'graphql':
      openers.openGraphqlRequestEditTab(entity.uid, entity.name);
      return true;
    case 'template':
      openers.openTemplateEditTab(entity.uid);
      return true;
    case 'spec':
      openers.openSpecEdit(entity.uid, entity.name);
      return true;
    case 'workflow':
      openers.openLiveWorkflowEdit(entity.uid, entity.name);
      return true;
    case 'live-variable':
      openers.openLiveVariables();
      return true;
    case 'environment':
      openers.openEnvironmentEdit(entity.uid, entity.name);
      return true;
    case 'workspace-variables':
      openers.openWorkspaceVariables();
      return true;
    case 'vault':
      openers.openVault();
      return true;
    case 'collection':
      if (entity.tree === 'rules') openers.openCollectionOverview(entity.uid, entity.name);
      else if (entity.tree === 'requests') openers.openRequestCollectionOverview(entity.uid, entity.name);
      else if (entity.tree === 'templates') openers.openTemplateCollectionOverview(entity.uid, entity.name);
      else return false;
      return true;
    case 'folder':
      if (entity.tree === 'rules') openers.openFolderOverview(entity.uid, entity.name);
      else if (entity.tree === 'requests') openers.openRequestFolderOverview(entity.uid, entity.name);
      else if (entity.tree === 'templates') openers.openTemplateFolderOverview(entity.uid, entity.name);
      else return false;
      return true;
  }
}

export type JumpToSourceOutcome = 'opened' | 'no-editor' | 'failed';

/** Open an entity the surface already knows — a named row's — through the registered openers. */
export function jumpToEntity(entity: WorkspaceTreeEntityRefWire): JumpToSourceOutcome {
  const getOpeners = registered.values().next().value;
  if (getOpeners === undefined) return 'no-editor';
  return openGitEntity(getOpeners(), entity) ? 'opened' : 'no-editor';
}

/** Resolve the path on the host and open its editor; the outcome drives the surface's notice. */
export async function jumpToSource(workspaceId: string, path: string): Promise<JumpToSourceOutcome> {
  let entity: WorkspaceTreeEntityRefWire;
  try {
    const result = await hostBridge.call('oh.workspaceTree.entityAtPath', { workspaceId, path });
    if (!result.ok) return result.reason === 'not-an-entity' ? 'no-editor' : 'failed';
    entity = result.entity;
  } catch {
    return 'failed';
  }
  return jumpToEntity(entity);
}
