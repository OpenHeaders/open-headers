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
import { useEditorLifecycle } from '@/shared/awareness/use-editor-lifecycle';
import type { EntityFieldProps } from '@/shared/awareness/EntityField';
import {
  brandHeaderWiring,
  brandScopeWiring,
  type EditorLifecycleStatus,
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
  /** Whether the entity has all required fields filled in with valid
   *  values. Same `isXComplete()` predicate the tab prefix icon +
   *  sidebar consume. When false (and the entity is minted), the
   *  chip shows `'draft'` — the user still has work to do before
   *  the entity can be Live. */
  isComplete?: boolean;
  /** Whether the entity has unresolved `{{ref}}`s in the active scope.
   *  Mirrors `unresolvableXUids.has(uid)` — same source as the sidebar's
   *  `unresolved` badge and the tab's yellow icon. */
  isUnresolved?: boolean;
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
    isUnresolved,
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

  // Lifecycle status — Draft means "not Live yet", whether that's
  // because the entity is missing required fields OR is complete-
  // but-unpublished. Live = complete + published + resolved refs.
  //
  //   create-mode (no entity yet)              → 'scratch'
  //   !complete                                → 'draft'
  //   complete + unresolved                    → 'unresolved'
  //   complete + resolved + !published         → 'draft'
  //   complete + resolved + published (or no gate) → null (Live)
  //
  // Precedence: scratch → !complete-as-draft → unresolved → draft → null.
  // Same predicates the tab prefix icon + sidebar consume; the chip
  // never disagrees with the row icon.
  let status: EditorLifecycleStatus;
  if (entityId === null) {
    status = 'scratch';
  } else if (isComplete === false) {
    status = 'draft';
  } else if (isUnresolved === true) {
    status = 'unresolved';
  } else if (isPublished === false) {
    status = 'draft';
  } else {
    status = null;
  }

  // Lifecycle publishing — mirrors useEditorDirty. The footer renders
  // one chip for whichever editor's tab is active.
  useEditorLifecycle({ entityType, entityId }, status);

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
