/**
 * Shared contract for the tab-opener family hooks — the tab plumbing
 * every family closes over, the composed API surface `useTabOpeners`
 * returns, and the helpers used by more than one family.
 */

import type { Collection, Request, Rule, RuleDraft } from '@openheaders/core/types';
import type { RuleFlowScope, WorkbenchTab } from '../../types';

/** Tab plumbing every opener family closes over. */
export interface TabOpenerContext {
  allTabs: WorkbenchTab[];
  addTab: (tab: WorkbenchTab) => void;
  switchTab: (tabId: string) => void;
  setPendingRenameTabId: (id: string | null) => void;
}

/**
 * Resolve the parent path for a context-create gesture: explicit
 * `folderPath` wins; otherwise look up the collection's path. Returns
 * `undefined` when context is missing OR the collectionId doesn't
 * resolve. Callers add their own fallback (e.g. "first collection")
 * outside this helper to keep its semantic narrow.
 */
export function resolveContextParentPath(
  context: { collectionId?: string; folderPath?: string } | undefined,
  collections: readonly Collection[],
): string | undefined {
  if (context?.folderPath) return context.folderPath;
  if (!context?.collectionId) return undefined;
  return collections.find((c) => c.uid === context.collectionId)?.path;
}

export const RULE_TYPE_LABELS: Record<string, string> = {
  header: 'Header Rule',
  block: 'Block Rule',
  redirect: 'Redirect Rule',
  'query-param': 'Query Param Rule',
  inject: 'Inject Rule',
  delay: 'Delay Rule',
  'request-body': 'API Request Body Rule',
  response: 'API Response Rule',
  ws: 'WebSocket Rule',
  sse: 'SSE Rule',
};

export function getRuleTypeLabel(type: string): string {
  return RULE_TYPE_LABELS[type] ?? 'Rule';
}

export interface UseTabOpenersApi {
  pendingRenameTabId: string | null;
  setPendingRenameTabId: (id: string | null) => void;
  generateDraftName: (type: string) => string;

  openCreateTab: (
    type: string,
    context?: { collectionId: string; folderPath?: string },
    templateKey?: string,
    initialDraft?: RuleDraft,
  ) => void;
  openEditTab: (uid: string) => void;
  openCollectionOverview: (uid: string, name: string, autoRename?: boolean) => void;
  openFolderOverview: (uid: string, name: string, autoRename?: boolean) => void;
  /**
   * Open the request-collection overview tab. Same `mode:
   * 'collection-overview'` as the rule variant — the `entityId` uid
   * disambiguates the family at render time via the shared lookup
   * helper (uids never collide across families).
   */
  openRequestCollectionOverview: (uid: string, name: string, autoRename?: boolean) => void;
  /** Open the request-folder overview tab. Same `mode: 'folder-overview'`
   *  as the rule + template variants; the `entityId` uid disambiguates
   *  the family at render time via {@link findFolderByUid}. */
  openRequestFolderOverview: (uid: string, name: string, autoRename?: boolean) => void;
  openTemplateEditTab: (uid: string) => void;
  openTemplateCollectionOverview: (uid: string, name: string, autoRename?: boolean) => void;
  openTemplateFolderOverview: (uid: string, name: string, autoRename?: boolean) => void;
  openRunReport: (
    runId: string,
    owner?: { type: 'rule' | 'folder' | 'collection' | 'workspace'; id: string },
    ownerName?: string,
  ) => void;
  openRuleFlow: (scope: RuleFlowScope, entityId?: string, label?: string, tabUrl?: string) => void;
  openSettingsTab: (options?: { settingKey?: string; categoryId?: string }) => void;
  openWorkspaceManager: () => void;
  openEnvironmentEdit: (uid: string, name: string, autoRename?: boolean) => void;
  openWorkspaceVariables: () => void;
  openVault: () => void;
  openLiveVariables: () => void;
  openCollectionVariables: (uid: string, name: string) => void;
  openRequestCollectionVariables: (uid: string, name: string) => void;
  openTemplateCollectionVariables: (uid: string, name: string) => void;
  openRequestEditTab: (uid: string, name: string, method?: string, autoRename?: boolean) => void;
  /**
   * Open an unsaved request draft. Mirrors `openCreateTab` for rules —
   * the tab starts dirty, nothing is persisted until the user clicks
   * Save. `context` carries the destination the user picked (sidebar
   * "Add Request" inside a collection/folder); the SaveToCollectionModal
   * fills in when no context is available.
   */
  openCreateRequestTab: (context?: { collectionId?: string; folderPath?: string }) => void;
  /**
   * Open a fresh `rule-create` scratch seeded with another tab's current
   * rule content ("Duplicate Tab"). The copy is a scratch regardless of
   * whether the source was live or draft — nothing persists until the
   * user saves and picks a destination.
   */
  openDuplicateRuleScratch: (content: Omit<Rule, 'uid' | 'path'>) => void;
  /**
   * Open a fresh `request-create` scratch seeded with another tab's
   * current request content ("Duplicate Tab"). Mirrors
   * {@link openDuplicateRuleScratch} for the request family.
   */
  openDuplicateRequestScratch: (content: Omit<Request, 'uid' | 'path' | 'schemaVersion'>) => void;
  /** Open an existing Live Variable in a dedicated edit tab. */
  openLiveVariableEdit: (uid: string, name: string) => void;
  /**
   * Open a Live Workflow in its dedicated edit tab. Optional `seedStep`
   * preseeds a pending append — the editor stages (but does not persist)
   * a new step built from the given request; the user reviews and saves
   * as usual. Ignored when the tab is already open (the existing draft
   * wins — reopening doesn't overwrite in-flight state).
   */
  openLiveWorkflowEdit: (
    uid: string,
    name: string,
    seedStep?: { requestUid: string; requestName: string; method: string },
  ) => void;
  /** Open an unsaved Live Variable binding draft — reachable from the Live Variables list page. */
  openCreateLiveVariable: () => void;
  /**
   * Open an unsaved Live Workflow draft. Mirrors `openCreateRequestTab`
   * for requests: the tab starts dirty, nothing is persisted until the
   * user clicks Save. `seedStep` preseeds step 1 with a request so the
   * "Use response in workflow → New workflow" action from the
   * Request editor lands inside the draft with the source request
   * already wired in.
   */
  openCreateLiveWorkflow: (context?: {
    seedStep?: { requestUid: string; requestName: string; method: string };
  }) => void;
}
