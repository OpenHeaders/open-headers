/**
 * `useEditorShell` — universal editor wiring layer.
 *
 * The hook owns the concerns that recurred as bug-class sources across
 * sessions 31, 56–68:
 *
 *   - **BC1** (comparison shape): `useReprime` (called internally for
 *     edit mode) owns `formFp !== primedFp`. Editor never reads both
 *     fingerprints simultaneously.
 *   - **BC6** (forgot to mount `<EditorHeader>`): output `headerProps`
 *     is branded (`EditorShellHeaderWiring`); only this hook produces
 *     it. Combined with the AST lint rule (Phase A deliverable A5),
 *     "called the hook but didn't mount the header" becomes a TS +
 *     lint failure.
 *   - **BC7** (forgot to call `useEditorDirty`): bundled into this
 *     hook's `useEffect`. There is no separate hook to forget.
 *   - **BC8** (wrong `entityType` in `<EntityScopeProvider>`): the hook
 *     accepts `entityType` once and re-emits it via branded `scopeProps`.
 *     Editor cannot mismatch scope-type vs hook-type because there is
 *     only one input.
 *
 * Editor owns layout. Hook owns wiring. Sub-editors can call this hook
 * for their own wiring without buying any JSX wrapper.
 */

import { useEffect, useMemo } from 'react';
import { useEditorDirty } from '@/shared/awareness/use-editor-dirty';
import type { EntityFieldProps } from '@/shared/awareness/EntityField';
import {
  brandHeaderWiring,
  brandScopeWiring,
  type EditorShellHeaderWiring,
  type EditorShellScopeWiring,
} from './types';

export type EditorShellFieldProps = Omit<EntityFieldProps, 'children'>;

export interface UseEditorShellInput {
  entityType: string;
  /** May be `null` while in `create` mode (no entity minted yet). */
  entityId: string | null;
  /** Caller derives this — for `edit` mode pass `useReprime(...).isDirty`;
   *  for `create` mode pass an editor-supplied flag. The hook itself
   *  doesn't care which mode produced it. */
  isDirty: boolean;
  /** Publication state for entities with live runners. Drives the
   *  publish-gate Save semantics on `<EditorHeader>`. */
  isPublished?: boolean;
  /** Whether the entity has all required fields with valid values.
   *  Drives the `'incomplete'` vs `'draft'` distinction in the
   *  lifecycle chip — only complete-and-unpublished entities get
   *  promoted to `'draft'`. Editors that don't model completeness
   *  separately can leave this undefined (treated as complete). */
  isComplete?: boolean;
  onSave: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  registerSaveRef?: (saveFn: () => void) => void;
  options?: {
    /** Sensitive-entity carve-out (Vault). When true, `field` returns
     *  null so the editor cannot accidentally publish per-field focus
     *  for secret material. */
    disableFieldFocus?: boolean;
  };
}

export interface UseEditorShellOutput {
  isDirty: boolean;
  headerProps: EditorShellHeaderWiring;
  scopeProps: EditorShellScopeWiring;
  /** Per-field props builder. `null` when `options.disableFieldFocus`. */
  field: ((path: string) => EditorShellFieldProps) | null;
}

export function useEditorShell(input: UseEditorShellInput): UseEditorShellOutput {
  const {
    entityType,
    entityId,
    isDirty,
    isPublished,
    isComplete,
    onSave,
    onDirtyChange,
    registerSaveRef,
    options,
  } = input;

  // BC7 — dirty publishing into surface awareness, bundled.
  useEditorDirty({ entityType, entityId }, isDirty);

  // onDirtyChange transition firing.
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  // Save-ref registration — wired once per identity. The editor passes
  // a stable callback (typically wrapped in useCallback) so the
  // breadcrumb / Cmd+S plumbing collects exactly one handle.
  useEffect(() => {
    registerSaveRef?.(onSave);
  }, [registerSaveRef, onSave]);

  // Lifecycle status — drives the chip next to Save so the sidebar /
  // tab strip / editor all narrate the same vocabulary.
  //
  //   create-mode (no entity yet)        → 'scratch'
  //   unpublished + incomplete           → 'incomplete'
  //   unpublished + complete             → 'draft' (ready to publish)
  //   published OR no publication gate   → null (no chip)
  //
  // `isComplete` undefined means the editor doesn't model completeness;
  // we default to "complete enough" so it falls into 'draft' rather
  // than 'incomplete'. Rules + Live Workflows opt in by passing the
  // flag explicitly.
  const status: 'scratch' | 'incomplete' | 'draft' | null =
    entityId === null
      ? 'scratch'
      : isPublished === false
        ? isComplete === false
          ? 'incomplete'
          : 'draft'
        : null;

  const headerProps = useMemo(
    () => brandHeaderWiring({ isDirty, isPublished, status, onSave }),
    [isDirty, isPublished, status, onSave],
  );

  const scopeProps = useMemo(
    () => brandScopeWiring({ entityType, entityId }),
    [entityType, entityId],
  );

  const disableField = options?.disableFieldFocus === true;
  const field = useMemo<UseEditorShellOutput['field']>(
    () =>
      disableField
        ? null
        : (path: string) => ({ path, entityType, entityId }),
    [disableField, entityType, entityId],
  );

  return {
    isDirty,
    headerProps,
    scopeProps,
    field,
  };
}
