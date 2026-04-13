/**
 * Types for the workspace.html full-page editor.
 */

export type TabMode =
  | 'create'
  | 'edit'
  | 'collection-overview'
  | 'folder-overview'
  | 'template-edit'
  | 'rule-flow'
  | 'run-report';

/** Scope for the rule flow visualization. */
export type RuleFlowScope = 'this-page' | 'collection' | 'folder' | 'all-active';

export interface RulesTab {
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
 * time (IDE tool-window model).
 */
export type LeftPanelKey = 'items' | 'page-traffic' | 'test-runs';

/** Right-side panel keys — all shown in the right Allotment pane. */
export type RightPanelKey = 'docs' | 'variables';

/**
 * Which screen region the user is currently interacting with. Drives the
 * IDE-style focus accent on activity-bar icons and panels. Null means
 * no region has been focused yet this session.
 */
export type FocusRegion = 'left' | 'right' | 'bottom' | 'editor' | null;

/**
 * Authoritative layout state for workspace.html. Replaces the old
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
  tab: RulesTab;
  closedAt: number;
}
