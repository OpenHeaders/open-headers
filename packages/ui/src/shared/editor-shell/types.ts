/**
 * Branded types produced exclusively by `useEditorShell`. The `__shell`
 * symbol field has type `never`, so the editor cannot construct one
 * even with `as` casts unless it goes through the hook (which performs
 * a single internal cast). Together with the AST lint rule (Phase A
 * deliverable A5), this closes BC6 + BC8 from the bug-class table.
 */

import type { MenuProps } from 'antd';
import type React from 'react';

declare const SHELL_HEADER_BRAND: unique symbol;
declare const SHELL_SCOPE_BRAND: unique symbol;

/**
 * Lifecycle status surfaced next to the Save button so the user gets
 * the same "where am I?" feedback the tab strip (gray dot) and the
 * sidebar already convey. The chip narrates persistence + publication
 * state; orthogonal axes (per-field validation, the Enabled toggle)
 * have their own dedicated affordances.
 *
 *   - `'scratch'`    — entity not yet minted (create-mode draft tab).
 *   - `'unresolved'` — has `{{ref}}`s that don't resolve in the active
 *     scope; won't activate until the references are defined.
 *   - `'draft'`      — saved but `published !== true`.
 *   - `null`         — published (Live), or no lifecycle gate.
 *
 * Precedence: scratch → unresolved → draft → null.
 */
export type EditorLifecycleStatus = 'scratch' | 'unresolved' | 'draft' | null;

export interface EditorShellHeaderWiring {
  readonly [SHELL_HEADER_BRAND]: never;
  isDirty: boolean;
  isPublished?: boolean;
  status: EditorLifecycleStatus;
  onSave: () => void;
}

export interface EditorShellScopeWiring {
  readonly [SHELL_SCOPE_BRAND]: never;
  entityType: string;
  entityId: string | null;
}

/**
 * Cast helpers used only inside the shell hook implementation.
 * Importing from outside `editor-shell/` is a lint failure (A5).
 */
export function brandHeaderWiring(value: {
  isDirty: boolean;
  isPublished?: boolean;
  status: EditorLifecycleStatus;
  onSave: () => void;
}): EditorShellHeaderWiring {
  return value as unknown as EditorShellHeaderWiring;
}

export function brandScopeWiring(value: {
  entityType: string;
  entityId: string | null;
}): EditorShellScopeWiring {
  return value as unknown as EditorShellScopeWiring;
}

/**
 * Content props the editor still supplies — these are NOT shell-owned.
 * The `<EditorHeader>` component composes wiring (from shell) + content
 * (from editor).
 */
export interface EditorHeaderContentProps {
  title: React.ReactNode;
  actions?: React.ReactNode;
  overflowItems?: MenuProps['items'];
}
