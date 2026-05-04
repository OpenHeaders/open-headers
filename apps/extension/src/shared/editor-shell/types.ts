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

export interface EditorShellHeaderWiring {
  readonly [SHELL_HEADER_BRAND]: never;
  isDirty: boolean;
  isPublished?: boolean;
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
