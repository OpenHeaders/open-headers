/**
 * workspace-file-entity-ref — the entity of a named file tree's row
 * (`workspace-file-tree`) as Jump to Source opens it
 * (`git-entity-opener`): the workspace already holds it, so its editor
 * opens by uid — wherever its files were when the commit was made. The
 * workspace's own file and its trusted certificates have no editor tab
 * and answer none. Pure.
 */

import type { WorkspaceTreeEntityRefWire } from '@openheaders/core/bridge';
import type {
  WorkspaceFileEntity,
  WorkspaceFileSectionId,
  WorkspaceLeafNode,
} from '@openheaders/ui/shared/workspace-files';

const LEAF_KINDS: Readonly<Record<WorkspaceLeafNode['type'], WorkspaceTreeEntityRefWire['kind']>> = {
  request: 'request',
  'graphql-request': 'graphql',
  'grpc-request': 'grpc',
  'websocket-request': 'websocket',
  'mqtt-request': 'mqtt',
  rule: 'rule',
  template: 'template',
};

/** The collection tree a section lists; null for a section that lists none. */
function treeOf(section: WorkspaceFileSectionId): WorkspaceTreeEntityRefWire['tree'] {
  return section === 'rules' || section === 'requests' || section === 'templates' ? section : null;
}

export function workspaceFileEntityRef(
  section: WorkspaceFileSectionId,
  entity: WorkspaceFileEntity,
): WorkspaceTreeEntityRefWire | undefined {
  switch (entity.kind) {
    case 'workspace':
    case 'trusted-roots':
      return undefined;
    case 'vault':
    case 'workspace-variables':
      return { kind: entity.kind, tree: null, uid: '', name: '' };
    case 'collection':
    case 'folder':
      return { kind: entity.kind, tree: treeOf(section), uid: entity.uid, name: entity.name };
    case 'node': {
      const { node } = entity;
      return {
        kind: LEAF_KINDS[node.type],
        tree: null,
        uid: node.uid,
        name: node.name,
        ...(node.type === 'request' ? { method: node.method } : {}),
      };
    }
    default:
      return { kind: entity.kind, tree: null, uid: entity.uid, name: entity.name };
  }
}
