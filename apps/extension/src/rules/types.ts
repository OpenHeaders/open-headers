/**
 * Types for the rules.html full-page editor.
 */

export interface RulesTab {
  /** Unique tab identifier. Format: 'create-{counter}' or 'edit-{uid}'. */
  id: string;
  /** Display label (rule name or "New Header Rule"). */
  label: string;
  /** The rule type for icon display. */
  ruleType: string;
  /** Whether the editor has unsaved changes. */
  dirty: boolean;
  /** Mode: creating a new rule or editing an existing one. */
  mode: 'create' | 'edit';
  /** For create tabs: the rule type to create. */
  createType?: string;
  /** For edit tabs: the rule uid being edited. */
  ruleUid?: string;
  /** Auto-generated draft name for create tabs (e.g. "New Header Rule (2)"). */
  draftName?: string;
}

export interface PanelVisibility {
  sidebar: boolean;
  bottomPanel: boolean;
  inspector: boolean;
}
