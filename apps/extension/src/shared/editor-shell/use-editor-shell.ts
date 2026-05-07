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
  /** Whether the entity has all required fields with valid values.
   *  Mirrors the same `isXComplete()` predicate the sidebar + tab
   *  prefix-icon use, so the chip flips on the same threshold. */
  isComplete?: boolean;
  /** Whether the entity has unresolved `{{ref}}`s in the active scope.
   *  Mirrors `unresolvableXUids.has(uid)` — same source as the sidebar's
   *  `unresolved` badge and the tab's yellow icon. */
  isUnresolved?: boolean;
  /** Whether the user's enabled toggle is on. Only meaningful for
   *  entities that have one (rules, workflows). Drives the `'off'`
   *  status when the entity is published but toggled off. */
  isEnabled?: boolean;
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
    isEnabled,
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

  // Lifecycle status — mirrors the EXACT precedence the tab prefix
  // icon + sidebar badge use, so the editor chip never tells a
  // different story. Each editor passes the SAME predicates the
  // sidebar / tab consume: `isXComplete()`, `unresolvableXUids.has(uid)`,
  // `entity.enabled`, `entity.published`.
  //
  //   create-mode (no entity yet)         → 'scratch'
  //   !complete                           → 'incomplete'   (whether published or not)
  //   complete + unresolved               → 'unresolved'   (whether published or not)
  //   !published + complete + resolved    → 'draft'
  //   published + !enabled                → 'off'
  //   published + enabled + complete + resolved → null (Live)
  //
  // Completeness/resolution beat publication state: a published rule
  // whose required fields were cleared can't fire — same gray tab
  // icon treatment, same chip. The publication-state buckets
  // (`draft` / `off` / `null`) only kick in once the entity is
  // structurally valid.
  //
  // Undefined inputs are treated as "fine" on that axis so editors
  // don't have to opt into every one (a request editor with no
  // publication gate lands on `null` once minted).
  let status: EditorLifecycleStatus;
  if (entityId === null) {
    status = 'scratch';
  } else if (isComplete === false) {
    status = 'incomplete';
  } else if (isUnresolved === true) {
    status = 'unresolved';
  } else if (isPublished === false) {
    status = 'draft';
  } else if (isEnabled === false) {
    status = 'off';
  } else {
    status = null;
  }

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
