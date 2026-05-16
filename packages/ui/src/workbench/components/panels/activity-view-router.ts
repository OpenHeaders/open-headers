/**
 * Activity Feed view router — pure mapping from
 * `(entityType, entityId)` to the right workbench tab-opener.
 *
 * Phase C F6.a. The card's "View" action calls into this helper so
 * panel + card stay free of opener-specific knowledge: a single table
 * declares the entity catalogue this surface understands, and adding a
 * new entity type means adding one row.
 *
 * Returns `false` when the entity type has no editor surface
 * (singletons that ride ambient UI, files catalogue, etc.) — the card
 * uses that to hide the View affordance entirely rather than render a
 * dead-click button.
 */

import {
  COLLECTION_ENTITY_TYPE,
  ENVIRONMENT_ENTITY_TYPE,
  FOLDER_ENTITY_TYPE,
  LIVE_VARIABLE_ENTITY_TYPE,
  LIVE_WORKFLOW_ENTITY_TYPE,
  REQUEST_COLLECTION_ENTITY_TYPE,
  REQUEST_ENTITY_TYPE,
  REQUEST_FOLDER_ENTITY_TYPE,
  RULE_ENTITY_TYPE,
  TEMPLATE_COLLECTION_ENTITY_TYPE,
  TEMPLATE_ENTITY_TYPE,
  TEMPLATE_FOLDER_ENTITY_TYPE,
  VAULT_ENTITY_TYPE,
  WORKSPACE_VARIABLES_ENTITY_TYPE,
} from '@openheaders/core/sync';

/**
 * Tab-openers the router needs. Names mirror `useTabOpeners`'s
 * exported callbacks; the consumer passes its own bound versions.
 * Kept narrow on purpose — adding a route adds one method here.
 */
export interface ActivityViewRoutes {
  openEditTab: (uid: string) => void;
  openEnvironmentEdit: (uid: string, name: string) => void;
  openRequestEditTab: (uid: string, name: string) => void;
  openTemplateEditTab: (uid: string) => void;
  openLiveVariableEdit: (uid: string, name: string) => void;
  openLiveWorkflowEdit: (uid: string, name: string) => void;
  openVault: () => void;
  openWorkspaceVariables: () => void;
  openCollectionOverview: (uid: string, name: string) => void;
  openRequestCollectionOverview: (uid: string, name: string) => void;
  openTemplateCollectionOverview: (uid: string, name: string) => void;
  openFolderOverview: (uid: string, name: string) => void;
  openRequestFolderOverview: (uid: string, name: string) => void;
  openTemplateFolderOverview: (uid: string, name: string) => void;
}

/**
 * Placeholder label used when the router doesn't have access to the
 * entity store (the panel doesn't). The real label flips in once the
 * tab's data dependency hydrates — same pattern as `edit-environment`
 * intent routing.
 */
const PLACEHOLDER_LABELS: Readonly<Record<string, string>> = {
  [ENVIRONMENT_ENTITY_TYPE]: 'Environment',
  [REQUEST_ENTITY_TYPE]: 'Request',
  [LIVE_VARIABLE_ENTITY_TYPE]: 'Live Variable',
  [LIVE_WORKFLOW_ENTITY_TYPE]: 'Workflow',
  [COLLECTION_ENTITY_TYPE]: 'Collection',
  [REQUEST_COLLECTION_ENTITY_TYPE]: 'Collection',
  [TEMPLATE_COLLECTION_ENTITY_TYPE]: 'Collection',
  [FOLDER_ENTITY_TYPE]: 'Folder',
  [REQUEST_FOLDER_ENTITY_TYPE]: 'Folder',
  [TEMPLATE_FOLDER_ENTITY_TYPE]: 'Folder',
};

/**
 * Closed set of entity types this surface knows how to open. Anything
 * not here returns `false` from {@link viewActivityEntity}; the card
 * hides the View button accordingly.
 *
 * Singletons that have no first-class editor (`oauth-bundle`,
 * `pause-markers`, `layout-state`, `files`, `extensionWorkspace`) are
 * intentionally omitted — they surface in ambient UI rather than a
 * dedicated tab.
 */
const VIEWABLE_ENTITY_TYPES = new Set<string>([
  RULE_ENTITY_TYPE,
  ENVIRONMENT_ENTITY_TYPE,
  REQUEST_ENTITY_TYPE,
  TEMPLATE_ENTITY_TYPE,
  LIVE_VARIABLE_ENTITY_TYPE,
  LIVE_WORKFLOW_ENTITY_TYPE,
  VAULT_ENTITY_TYPE,
  WORKSPACE_VARIABLES_ENTITY_TYPE,
  COLLECTION_ENTITY_TYPE,
  REQUEST_COLLECTION_ENTITY_TYPE,
  TEMPLATE_COLLECTION_ENTITY_TYPE,
  FOLDER_ENTITY_TYPE,
  REQUEST_FOLDER_ENTITY_TYPE,
  TEMPLATE_FOLDER_ENTITY_TYPE,
]);

export function isViewableEntityType(entityType: string): boolean {
  return VIEWABLE_ENTITY_TYPES.has(entityType);
}

/**
 * Dispatch the right tab-opener for the given activity entry's entity.
 * Returns `true` when an opener fired, `false` when the entity type
 * has no editor surface (caller may toast or no-op).
 */
export function viewActivityEntity(
  entityType: string,
  entityId: string,
  routes: ActivityViewRoutes,
): boolean {
  const label = PLACEHOLDER_LABELS[entityType] ?? entityType;
  switch (entityType) {
    case RULE_ENTITY_TYPE:
      routes.openEditTab(entityId);
      return true;
    case ENVIRONMENT_ENTITY_TYPE:
      routes.openEnvironmentEdit(entityId, label);
      return true;
    case REQUEST_ENTITY_TYPE:
      routes.openRequestEditTab(entityId, label);
      return true;
    case TEMPLATE_ENTITY_TYPE:
      routes.openTemplateEditTab(entityId);
      return true;
    case LIVE_VARIABLE_ENTITY_TYPE:
      routes.openLiveVariableEdit(entityId, label);
      return true;
    case LIVE_WORKFLOW_ENTITY_TYPE:
      routes.openLiveWorkflowEdit(entityId, label);
      return true;
    case VAULT_ENTITY_TYPE:
      routes.openVault();
      return true;
    case WORKSPACE_VARIABLES_ENTITY_TYPE:
      routes.openWorkspaceVariables();
      return true;
    case COLLECTION_ENTITY_TYPE:
      routes.openCollectionOverview(entityId, label);
      return true;
    case REQUEST_COLLECTION_ENTITY_TYPE:
      routes.openRequestCollectionOverview(entityId, label);
      return true;
    case TEMPLATE_COLLECTION_ENTITY_TYPE:
      routes.openTemplateCollectionOverview(entityId, label);
      return true;
    case FOLDER_ENTITY_TYPE:
      routes.openFolderOverview(entityId, label);
      return true;
    case REQUEST_FOLDER_ENTITY_TYPE:
      routes.openRequestFolderOverview(entityId, label);
      return true;
    case TEMPLATE_FOLDER_ENTITY_TYPE:
      routes.openTemplateFolderOverview(entityId, label);
      return true;
    default:
      return false;
  }
}
