/**
 * conflict-file-surface — which of the workbench's surfaces a file of a
 * conflicted pass belongs to, by the tree's own conventions
 * (`classifyTreePath`): a rule's files are the Interceptor's, a
 * request's of any protocol the API Requests', an environment, the
 * workspace's variables, the vault and a live variable the Variables',
 * a workflow the Workflows'. A collection or a folder follows the tree
 * it sits in. Null is any other file — one of the user's own, a
 * template, a spec, the workspace manifest — which wears its file type.
 */

import {
  classifyTreePath,
  ENVIRONMENTS_DIR,
  type WorkspaceTreeCollectionTree,
  type WorkspaceTreeEntityKind,
} from '@openheaders/core/workspace-tree';

export type ConflictFileSurface = 'http-rules' | 'api-requests' | 'variables' | 'workflows';

const SURFACE_OF_TREE: Readonly<Record<WorkspaceTreeCollectionTree, ConflictFileSurface | null>> = {
  rules: 'http-rules',
  requests: 'api-requests',
  templates: null,
};

const SURFACE_OF_KIND: Readonly<Partial<Record<WorkspaceTreeEntityKind, ConflictFileSurface>>> = {
  rule: 'http-rules',
  request: 'api-requests',
  grpc: 'api-requests',
  websocket: 'api-requests',
  mqtt: 'api-requests',
  graphql: 'api-requests',
  workflow: 'workflows',
  'live-variable': 'variables',
  environment: 'variables',
  'workspace-variables': 'variables',
  vault: 'variables',
};

export function conflictFileSurface(path: string): ConflictFileSurface | null {
  // An environment's secret template sits beside it and classifies as no entity.
  if (path.startsWith(`${ENVIRONMENTS_DIR}/`)) return 'variables';
  const classed = classifyTreePath(path);
  if (classed.kind === 'none') return null;
  const candidate = classed.kind === 'manifest' ? classed.candidate : classed.candidates[0];
  if (candidate === undefined) return null;
  // A sibling's entity is not known from its path — only the tree it sits in is.
  if (classed.kind === 'sibling' || candidate.kind === 'collection' || candidate.kind === 'folder') {
    return candidate.tree !== null ? SURFACE_OF_TREE[candidate.tree] : null;
  }
  return SURFACE_OF_KIND[candidate.kind] ?? null;
}
