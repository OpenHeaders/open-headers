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

export type EditorShellFieldProps = Omit<EntityFieldProps, 'children'>;
import {
  brandHeaderWiring,
  brandScopeWiring,
  type EditorShellHeaderWiring,
  type EditorShellScopeWiring,
} from './types';
import { useReprime, type UseReprimeOutput } from './use-reprime';

export type EditorMode = 'edit' | 'create';

export interface EditorShellReprime<E> {
  liveEntity: E | null | undefined;
  formFingerprint: string;
  signature: (entity: E) => string;
  populate: (entity: E) => void;
  /** Caller's "ready to reconcile" gate — typically a state mirror of
   *  the editor's init-completed flag. */
  enabled: boolean;
  /** Fires after reprime AND auto-rebase. Editors use this to advance
   *  per-editor baselines (e.g. conflict tracker baseline). */
  onPrimed?: (entity: E) => void;
}

export interface UseEditorShellInput<E> {
  entityType: string;
  /** May be `null` while in `create` mode (no entity minted yet). */
  entityId: string | null;
  mode: EditorMode;
  /** Required when `mode === 'edit'`. Drives reprime + dirty derivation. */
  reprime?: EditorShellReprime<E>;
  /** Required when `mode === 'create'`. Editor-supplied dirty value. */
  isDirty?: boolean;
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
  primedFingerprint: string | null;
  headerProps: EditorShellHeaderWiring;
  scopeProps: EditorShellScopeWiring;
  /** Per-field props builder. `null` when `options.disableFieldFocus`. */
  field: ((path: string) => EditorShellFieldProps) | null;
}

const NO_REPRIME: UseReprimeOutput = { isDirty: false, primedFingerprint: null };

export function useEditorShell<E>(input: UseEditorShellInput<E>): UseEditorShellOutput {
  const {
    entityType,
    entityId,
    mode,
    reprime,
    isDirty: createDirty,
    isPublished,
    onSave,
    onDirtyChange,
    registerSaveRef,
    options,
  } = input;

  if (mode === 'edit' && !reprime) {
    throw new Error('useEditorShell: mode="edit" requires `reprime` input.');
  }
  if (mode === 'create' && createDirty === undefined) {
    throw new Error('useEditorShell: mode="create" requires `isDirty` input.');
  }

  // useReprime is hooked unconditionally to keep hook order stable.
  // In create mode we feed it a no-op reprime so it short-circuits via
  // `enabled: false`.
  const reprimeOutput = useReprime<E>({
    liveEntity: reprime?.liveEntity ?? null,
    scope: { entityType, entityId },
    enabled: mode === 'edit' && (reprime?.enabled ?? false),
    formFingerprint: reprime?.formFingerprint ?? '',
    signature: reprime?.signature ?? ((_e: E) => ''),
    populate: reprime?.populate ?? (() => undefined),
    onPrimed: reprime?.onPrimed,
  });

  const isDirty = mode === 'edit' ? reprimeOutput.isDirty : (createDirty ?? false);

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

  const headerProps = useMemo(
    () => brandHeaderWiring({ isDirty, isPublished, onSave }),
    [isDirty, isPublished, onSave],
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
    primedFingerprint: reprimeOutput.primedFingerprint,
    headerProps,
    scopeProps,
    field,
  };
}
