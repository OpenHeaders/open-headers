/**
 * Shared contract for the tab-opener family hooks — the tab plumbing
 * every family closes over, the composed API surface `useTabOpeners`
 * returns, and the helpers used by more than one family.
 */

import type { Collection, Request, Rule, RuleDraft } from '@openheaders/core/types';
import type { MessageKey } from '@openheaders/i18n';
import type { Translate } from '@openheaders/ui/context/LocaleContext';
import type { WorkbenchTab, WorkflowSeedStep } from '../../types';

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

export const RULE_TYPE_NAME_KEYS: Record<string, MessageKey> = {
  header: 'workbench.shell.ruleTypeName.header',
  block: 'workbench.shell.ruleTypeName.block',
  redirect: 'workbench.shell.ruleTypeName.redirect',
  'query-param': 'workbench.shell.ruleTypeName.queryParam',
  inject: 'workbench.shell.ruleTypeName.inject',
  delay: 'workbench.shell.ruleTypeName.delay',
  'request-body': 'workbench.shell.ruleTypeName.requestBody',
  response: 'workbench.shell.ruleTypeName.response',
  ws: 'workbench.shell.ruleTypeName.ws',
  sse: 'workbench.shell.ruleTypeName.sse',
};

export function getRuleTypeLabel(type: string, t: Translate): string {
  const key = RULE_TYPE_NAME_KEYS[type];
  return key ? t(key) : t('workbench.shell.ruleTypeName.fallback');
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
  openSettingsTab: (options?: { settingKey?: string; categoryId?: string }) => void;
  /** Open the bundled release-notes tab (singleton; desktop-only —
   *  callers gate on the `getWhatsNew` capability). */
  openWhatsNew: () => void;
  openWorkspaceManager: () => void;
  /** Open the daemon administration console (singleton tab; the CTA is
   *  probe-gated, the server gates every call regardless). */
  openDaemonAdmin: () => void;
  openEnvironmentEdit: (uid: string, name: string, autoRename?: boolean) => void;
  /** Open a spec document's editor tab (Specs sidebar section). */
  openSpecEdit: (uid: string, name: string, autoRename?: boolean) => void;
  openWorkspaceVariables: () => void;
  openVault: () => void;
  openScriptPackages: () => void;
  openLiveVariables: () => void;
  openCollectionVariables: (uid: string, name: string) => void;
  openRequestCollectionVariables: (uid: string, name: string) => void;
  /** Open the ancestor-scripts editor for a request collection. */
  openRequestCollectionScripts: (uid: string, name: string) => void;
  /** Open the ancestor-scripts editor for a request folder. */
  openRequestFolderScripts: (uid: string, name: string) => void;
  /** Open the ancestor-auth editor for a request collection. */
  openRequestCollectionAuth: (uid: string, name: string) => void;
  /** Open the ancestor-auth editor for a request folder. */
  openRequestFolderAuth: (uid: string, name: string) => void;
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
  /** Open a GrpcRequest in its dedicated edit tab. */
  openGrpcRequestEditTab: (uid: string, name: string, autoRename?: boolean) => void;
  /**
   * Context-create a gRPC request. Unlike {@link openCreateRequestTab}
   * there is no draft mode — the gesture always originates from a
   * container's "+" menu with a known destination, so the entity is
   * persisted immediately and opened as `grpc-edit` (born clean).
   */
  openCreateGrpcRequestTab: (context: { collectionId?: string; folderPath?: string }) => void;
  /**
   * Open a fresh `rule-create` scratch seeded with another tab's current
   * rule content ("Duplicate Tab"). The copy is a scratch regardless of
   * whether the source was live or draft — nothing persists until the
   * user saves and picks a destination. `opts.pinnedEnvId` carries the
   * source tab's env pin onto the copy.
   */
  openDuplicateRuleScratch: (content: Omit<Rule, 'uid' | 'path'>, opts?: { pinnedEnvId?: string | null }) => void;
  /**
   * Open a fresh `request-create` scratch seeded with another tab's
   * current request content ("Duplicate Tab") or a frozen example's
   * captured request shape ("Try" — `opts.fromExampleName` carries the
   * chrome-only provenance shown in the tab tooltip + footer). Mirrors
   * {@link openDuplicateRuleScratch} for the request family.
   */
  openDuplicateRequestScratch: (
    content: Omit<Request, 'uid' | 'path' | 'schemaVersion'>,
    opts?: { pinnedEnvId?: string | null; fromExampleName?: string },
  ) => void;
  /**
   * Open a saved response example in its read-only viewer tab. Tab id
   * `resp-example-<uid>` matches the sidebar node id so selection
   * highlight follows the active tab.
   */
  openResponseExampleTab: (uid: string, name: string, requestUid: string) => void;
  /** Open an existing Live Variable in a dedicated edit tab. */
  openLiveVariableEdit: (uid: string, name: string) => void;
  /**
   * Open a Live Workflow in its dedicated edit tab. Optional `seedSteps`
   * preseeds a pending append — the editor stages (but does not persist)
   * a new step per given request, in declared order; the user reviews
   * and saves as usual. Ignored when the tab is already open (the
   * existing draft wins — reopening doesn't overwrite in-flight state).
   */
  openLiveWorkflowEdit: (uid: string, name: string, seedSteps?: WorkflowSeedStep[]) => void;
  /** Open an unsaved Live Variable binding draft — reachable from the Live Variables list page. */
  openCreateLiveVariable: () => void;
  /**
   * Open an unsaved Live Workflow draft. Mirrors `openCreateRequestTab`
   * for requests: the tab starts dirty, nothing is persisted until the
   * user clicks Save. `seedSteps` preseeds the draft's steps in declared
   * order — one from the Request editor's "Use response in workflow →
   * New workflow" action, many from the request tree's "Create
   * Workflow…" picker. `name` pre-names the draft (e.g. after the
   * source collection / folder) instead of the "New Workflow" default.
   */
  openCreateLiveWorkflow: (context?: { seedSteps?: WorkflowSeedStep[]; name?: string }) => void;
}
