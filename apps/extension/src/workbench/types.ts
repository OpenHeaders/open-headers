/**
 * Types for the workbench.html full-page editor.
 */

import type { V5 } from '@openheaders/core/types';

export type TabMode =
  | 'create'
  | 'edit'
  | 'collection-overview'
  | 'folder-overview'
  | 'template-edit'
  | 'rule-flow'
  | 'run-report'
  | 'settings'
  | 'landing'
  | 'workspace-manager'
  | 'env-edit'
  | 'workspace-vars'
  | 'vault'
  | 'live-vars'
  | 'collection-vars'
  | 'request-edit'
  | 'request-create'
  | 'live-variable-edit'
  | 'live-variable-create'
  | 'live-workflow-edit'
  | 'live-workflow-create';

/** Variant of the startup landing tab — drives which view `LandingScreen` renders. */
export type LandingView = 'home' | 'rules' | 'collections';

/** Scope for the rule flow visualization. */
export type RuleFlowScope = 'this-page' | 'collection' | 'folder' | 'all-active';

export interface WorkbenchTab {
  /** Unique tab identifier. Format: 'create-{counter}', 'edit-{uid}', 'col-{uid}', 'folder-{uid}'. */
  id: string;
  /** Display label. */
  label: string;
  /** The rule type for icon display (rules only). */
  ruleType: string;
  /** Whether the editor has unsaved changes. */
  dirty: boolean;
  /** Tab mode. */
  mode: TabMode;
  /** For create tabs: the rule type to create. */
  createType?: string;
  /** For create tabs: optional template key to pre-apply on mount. */
  templateKey?: string;
  /**
   * For create tabs: pre-filled rule draft from an external caller
   * (inspector-panel "override this header" CTA, future import/paste
   * flows). The editor populates the form from it on mount instead
   * of using type defaults. The rule stays unsaved until the user
   * explicitly confirms — we never persist behind their back.
   */
  initialDraft?: V5.RuleDraft;
  /**
   * For create tabs opened from a specific collection/folder
   * (sidebar "Add Rule", CollectionOverview, FolderOverview): the
   * destination the user picked. When set, the Save flow skips the
   * SaveToCollectionModal and persists directly to this location —
   * the user already answered the "where" question by clicking the
   * contextual Add Rule affordance.
   */
  preferredCollectionId?: string;
  preferredFolderPath?: string;
  /** For edit tabs: the rule uid being edited. */
  ruleUid?: string;
  /** Auto-generated draft name for create tabs (e.g. "New Header Rule (2)"). */
  draftName?: string;
  /** For collection/folder overview tabs: the entity uid. */
  entityId?: string;
  /** For template-edit tabs: the template uid. */
  templateUid?: string;
  /** For rule-flow tabs: the scope. */
  flowScope?: RuleFlowScope;
  /** For rule-flow tabs with "this-page" scope: the tab URL to filter against. */
  flowTabUrl?: string;
  /** For run-report tabs: the run id to load from storage. */
  testRunId?: string;
  /**
   * Test run owner — present on run-report tabs and on the entity
   * tabs that own them (collection-overview / folder-overview / edit).
   * The bottom panel reads this from the active tab to decide whether
   * to render the contextual Test Runs tab and which bucket to load.
   */
  testOwnerType?: 'rule' | 'folder' | 'collection' | 'workspace';
  testOwnerId?: string;
  /** For settings tabs: optional deep-link target key to scroll to on mount. */
  settingsInitialKey?: string;
  /** For settings tabs: optional deep-link target category to scroll to on mount. */
  settingsInitialCategory?: string;
  /** For landing tabs: which top-level view is rendered (home, rules, collections). */
  landingView?: LandingView;
  /**
   * For env-edit tabs: the environment uid being edited. For
   * collection-vars tabs: the collection uid being edited (separate
   * from `entityId` to keep the collection-overview / collection-vars
   * surfaces independent).
   */
  environmentUid?: string;
  /** For collection-vars tabs: the collection uid whose variables are being edited. */
  collectionUid?: string;
  /** For request-edit tabs: the V5.Request uid being edited. */
  requestUid?: string;
  /** For live-variable-edit tabs: the LV uid being edited. */
  liveVariableUid?: string;
  /** For live-workflow-edit tabs: the workflow uid being edited. */
  liveWorkflowUid?: string;
  /**
   * For live-workflow-create tabs opened from a Request's "Extract
   * variables to workflow → New workflow" action, and for
   * live-workflow-edit tabs opened from "Extract → Attach to <workflow>"
   * (the editor stages but does not persist a step built from this
   * request; the user reviews + Saves as usual).
   */
  liveWorkflowSeedStep?: { requestUid: string; requestName: string; method: string };
  /**
   * For request-create (draft) tabs opened from a specific collection
   * or folder in the sidebar. When set, Save persists directly there;
   * otherwise the SaveToCollectionModal prompts for a destination.
   * Reuses `preferredCollectionId` / `preferredFolderPath` from the
   * rule-create flow — the REQUEST collection uid happens to fit into
   * the same field because they share the `V5.Collection` shape.
   */
}

/**
 * Legacy three-booleans view of panel visibility. Retained because
 * StatusBar.tsx still speaks this vocabulary; App.tsx derives it from
 * the new WorkspaceLayout state machine via a small adapter. New code
 * should read `WorkspaceLayout` directly.
 */
export interface PanelVisibility {
  sidebar: boolean;
  bottomPanel: boolean;
  inspector: boolean;
}

/**
 * Left-side panel keys. Top group panels open in the left Allotment pane;
 * bottom group panels open in the bottom Allotment pane. Only one key from
 * the top group and one key from the bottom group may be "active" at a
 * time (dockable tool-window model).
 *
 * Three left-top tool windows share the same slot and stack as tabs:
 *   - `http-workbench`   — rules + templates + environment quick-reference
 *   - `api-requests` — api-request collections + environment quick-reference
 *   - `variables`    — full variable management (vault, workspace-vars, envs)
 */
export type LeftPanelKey =
  | 'http-rules'
  | 'api-requests'
  | 'variables'
  | 'workflows'
  | 'workflow-status'
  | 'page-traffic'
  | 'test-runs';

/**
 * Right-side panel keys — all shown in the right Allotment pane.
 * `var-scope` is the in-request / all-scopes variable resolution
 * inspector (historically ID'd as `variables`; renamed to avoid
 * collision with the left-pane `variables` management surface).
 */
export type RightPanelKey = 'docs' | 'var-scope';

/**
 * Which screen region the user is currently interacting with. Drives the
 * focus accent on activity-bar icons and panels. Null means
 * no region has been focused yet this session.
 */
export type FocusRegion = 'left' | 'right' | 'bottom' | 'editor' | null;

/**
 * Authoritative layout state for workbench.html. Replaces the old
 * PanelVisibility booleans. `leftPanel` and `rightPanel` are null when
 * collapsed; `bottomOpen` decouples bottom-panel visibility from which
 * left-bottom key drove it so the user can drag-collapse without losing
 * the Test Runs selection.
 */
export interface WorkspaceLayout {
  leftPanel: LeftPanelKey | null;
  rightPanel: RightPanelKey | null;
  bottomOpen: boolean;
  focusedRegion: FocusRegion;
  /**
   * When false, activity-bar icons render without their text labels (narrow
   * ~36px strip). Toggled via the right-click context menu on either bar.
   */
  activityBarLabels: boolean;
}

/** Snapshot of a tab when it was closed, for "recently closed" recovery. */
export interface ClosedTab {
  tab: WorkbenchTab;
  closedAt: number;
}

// ── Dockable tool-window model ────────────────────────────────────────
//
// Shared dock types are defined in @/shared/dock-layout and re-exported
// here for backwards compatibility. Workspace-specific types (ToolWindowId)
// stay here because they define which windows THIS surface has.

export type { DockSlot, SidebarLayoutVariant, ToolRegion } from '@/shared/dock-layout';

import type { DockState as GenericDockState, ToolLayoutState as GenericToolLayoutState } from '@/shared/dock-layout';

/** Identifiers for every tool window known to the extension shell. */
export type ToolWindowId =
  | 'http-rules'
  | 'api-requests'
  | 'variables'
  | 'workflows'
  | 'workflow-status'
  | 'docs'
  | 'var-scope'
  | 'page-traffic'
  | 'test-runs';

/** Runtime state for one dock, bound to workspace's ToolWindowId. */
export type DockState = GenericDockState<ToolWindowId>;

/** Full tool-window layout state, bound to workspace's ToolWindowId. */
export type ToolLayoutState = GenericToolLayoutState<ToolWindowId>;
