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

  // Lifecycle status — `'scratch'` when no entity exists yet (create
  // mode), `'draft'` when the entity exists but the publication gate
  // hasn't flipped (rules today; any entity that opts in later). The
  // editor surface uses this for a small chip next to Save so the
  // sidebar / tab / editor all narrate the same lifecycle.
  const status: 'scratch' | 'draft' | null =
    entityId === null ? 'scratch' : isPublished === false ? 'draft' : null;

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
