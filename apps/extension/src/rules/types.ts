/**
 * Types for the workspace.html full-page editor.
 */

export type TabMode = 'create' | 'edit' | 'collection-overview' | 'folder-overview' | 'template-edit' | 'rule-flow';

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
}

export interface PanelVisibility {
  sidebar: boolean;
  bottomPanel: boolean;
  inspector: boolean;
}

/** Snapshot of a tab when it was closed, for "recently closed" recovery. */
export interface ClosedTab {
  tab: RulesTab;
  closedAt: number;
}
