/**
 * Resolve which entity / collection the focused tab is about. Editor
 * tabs carry a concrete entity whose templates the panel walks — a
 * rule, a template, or a request of any wire kind (HTTP, gRPC,
 * WebSocket, MQTT, GraphQL; the tab mode names the kind, the uid field
 * follows it); the *-collection-vars + overview surfaces carry only a
 * collection uid. The collection lookup walks every family so the
 * resolver's collection scope works regardless of which family the
 * focused entity belongs to.
 */

import type {
  CollectionTree,
  GraphqlRequest,
  GrpcRequest,
  MqttRequest,
  Request,
  Rule,
  Template,
  TreeNode,
  WebSocketRequest,
} from '@openheaders/core/types';
import { type CollectionFamilies, findCollectionByPath } from '@openheaders/ui/shared/variables';
import type { WorkbenchTab } from '../../../types';
import type { ScopeEntity, ScopeKind } from './types';

export interface ScopeContext {
  entity: ScopeEntity | null;
  activeCollectionId: string | null;
}

export interface ScopeContextInput {
  activeTab: WorkbenchTab | null;
  scopeKind: ScopeKind;
  rules: Rule[];
  requests: Request[];
  grpcRequests: GrpcRequest[];
  websocketRequests: WebSocketRequest[];
  mqttRequests: MqttRequest[];
  graphqlRequests: GraphqlRequest[];
  templates: Template[];
  families: CollectionFamilies;
  localCollectionTrees: readonly CollectionTree[];
  requestCollectionTrees: readonly CollectionTree[];
  templateCollectionTrees: readonly CollectionTree[];
}

function byUid<T extends { uid: string }>(list: readonly T[], uid: string | undefined): T | null {
  if (!uid) return null;
  return list.find((item) => item.uid === uid) ?? null;
}

/** The entity the focused tab edits, by scope kind and — for a
 *  request — by the tab mode that names its wire kind. */
function focusedEntity(activeTab: WorkbenchTab, scopeKind: ScopeKind, input: ScopeContextInput): ScopeEntity | null {
  if (scopeKind === 'rule') {
    const entity = byUid(input.rules, activeTab.ruleUid);
    return entity ? { kind: 'rule', entity } : null;
  }
  if (scopeKind === 'template') {
    const entity = byUid(input.templates, activeTab.templateUid);
    return entity ? { kind: 'template', entity } : null;
  }
  if (scopeKind !== 'request') return null;
  switch (activeTab.mode) {
    case 'grpc-edit': {
      const entity = byUid(input.grpcRequests, activeTab.grpcRequestUid);
      return entity ? { kind: 'grpc-request', entity } : null;
    }
    case 'websocket-edit': {
      const entity = byUid(input.websocketRequests, activeTab.websocketRequestUid);
      return entity ? { kind: 'websocket-request', entity } : null;
    }
    case 'mqtt-edit': {
      const entity = byUid(input.mqttRequests, activeTab.mqttRequestUid);
      return entity ? { kind: 'mqtt-request', entity } : null;
    }
    case 'graphql-edit': {
      const entity = byUid(input.graphqlRequests, activeTab.graphqlRequestUid);
      return entity ? { kind: 'graphql-request', entity } : null;
    }
    default: {
      const entity = byUid(input.requests, activeTab.requestUid);
      return entity ? { kind: 'request', entity } : null;
    }
  }
}

export function resolveScopeContext(input: ScopeContextInput): ScopeContext {
  const { activeTab, scopeKind, families, localCollectionTrees, requestCollectionTrees, templateCollectionTrees } =
    input;

  if (!activeTab) return { entity: null, activeCollectionId: null };

  const entity = focusedEntity(activeTab, scopeKind, input);

  let collId: string | null = null;
  if ((activeTab.mode === 'collection-overview' || activeTab.mode === 'folder-overview') && activeTab.entityId) {
    // Both overview surfaces stash the entity uid in `entityId`. For
    // collection-overview the uid IS a collection uid; for folder-
    // overview it's a folder uid that we resolve through the trees.
    if (activeTab.mode === 'collection-overview') {
      collId = activeTab.entityId;
    } else {
      const folderUid = activeTab.entityId;
      const treeFamilies: ReadonlyArray<readonly CollectionTree[]> = [
        localCollectionTrees,
        requestCollectionTrees,
        templateCollectionTrees,
      ];
      outer: for (const trees of treeFamilies) {
        for (const col of trees) {
          const stack: TreeNode[] = [...col.tree];
          while (stack.length > 0) {
            const node = stack.shift();
            if (!node) break;
            if (node.type === 'folder' && node.uid === folderUid) {
              collId = col.uid;
              break outer;
            }
            if (node.type === 'folder') stack.push(...node.children);
          }
        }
      }
    }
  } else if (
    (activeTab.mode === 'collection-vars' || activeTab.mode === 'template-collection-vars') &&
    activeTab.collectionUid
  ) {
    collId = activeTab.collectionUid;
  } else if (entity) {
    collId = findCollectionByPath(entity.entity.path, families)?.uid ?? null;
  }

  return { entity, activeCollectionId: collId };
}
