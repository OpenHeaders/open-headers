/**
 * `<FieldConflictChip>` + `<SetRowConflictChip>` primitives — collapse
 * the inline conflict-chip plumbing scattered across the rule-fields
 * editors into one place.
 *
 * The pattern they replace at each leaf:
 *
 *   <Form.Item noStyle shouldUpdate={...}>
 *     {({getFieldValue}) => {
 *       const local = String(getFieldValue([name, idx, 'value']) ?? '');
 *       const conflict = conflicts.getConflict(path, local);
 *       if (!conflict) return null;
 *       return <ConflictDiffChip ... onTakeTheirs={() => {form.setFieldValue(...); ...}} />;
 *     }}
 *   </Form.Item>
 *
 * Caller drops the `<Form.Item>` + `shouldUpdate` + `getFieldValue` boilerplate
 * and renders `<FieldConflictChip path={...} formName={...} />`. The
 * `useEntityConflicts` API is supplied via {@link ConflictsContext} once
 * at the editor root; the chip subscribes via context + `useWatch`.
 *
 * Pure UI composition over `<ConflictDiffChip>` + `<SetRowConflictChip>` —
 * this file does NOT define the visual chip itself, just the form-bound
 * binding that decides when to render.
 */

import { Form } from 'antd';
import { createContext, type ReactElement, useContext } from 'react';
import {
  ConflictDiffChip,
  SetRowConflictChip,
} from '@/shared/awareness';
import type { PathConflict } from './types';

export interface FieldConflictsApi {
  getConflict: (path: string, localValue: string) => PathConflict | null;
  getSetConflict?: (setPath: string, uid: string, formContainsUid: boolean) => PathConflict | null;
  acceptTheirs: (path: string, theirs: string) => void;
  dismiss: (path: string) => void;
}

const ConflictsContext = createContext<FieldConflictsApi | null>(null);

export function ConflictsProvider({
  api,
  children,
}: {
  api: FieldConflictsApi | null | undefined;
  children: ReactElement;
}): ReactElement {
  return <ConflictsContext.Provider value={api ?? null}>{children}</ConflictsContext.Provider>;
}

export function useFieldConflicts(): FieldConflictsApi | null {
  return useContext(ConflictsContext);
}

export interface FieldConflictChipProps {
  /** Canonical conflict path (e.g. `'action.requestHeaders.<uid>.value'`). */
  path: string;
  /** antd Form path of the field this chip annotates. Used both to
   *  read the local value and to write `theirs` on Use saved. */
  formName: (string | number)[];
  /** Override the default Use-saved write — by default the chip writes
   *  `theirs` into the form via `form.setFieldValue(formName, …)` and
   *  then calls `acceptTheirs`. Override when the saved value needs
   *  post-processing (e.g. structural splitting across multiple form
   *  paths) before being applied. */
  onTakeTheirs?: (theirs: string) => void;
}

/**
 * Renders a `<ConflictDiffChip>` for one leaf path when the conflicts
 * API surfaces a conflict at it. No-op when not inside a
 * `<ConflictsProvider>` or when no conflict applies.
 */
export function FieldConflictChip({ path, formName, onTakeTheirs }: FieldConflictChipProps): ReactElement | null {
  const conflicts = useFieldConflicts();
  const form = Form.useFormInstance();
  // useWatch keeps the chip subscribed to the local value without a
  // wrapping `<Form.Item shouldUpdate>` — it costs the same React
  // re-render cycle and reads cleaner at the callsite.
  const localRaw = Form.useWatch(formName, form);
  if (!conflicts) return null;
  const local = String(localRaw ?? '');
  const conflict = conflicts.getConflict(path, local);
  if (!conflict) return null;
  const handleTakeTheirs = () => {
    if (onTakeTheirs) onTakeTheirs(conflict.theirs);
    else form.setFieldValue(formName, conflict.theirs);
    conflicts.acceptTheirs(path, conflict.theirs);
  };
  return (
    <ConflictDiffChip
      theirs={conflict.theirs}
      base={conflict.base}
      local={local}
      remote={conflict.remote}
      onTakeTheirs={handleTakeTheirs}
      onKeepMine={() => conflicts.dismiss(path)}
    />
  );
}

export interface SetRowChipProps {
  /** Schema path of the set whose row is being annotated. */
  setPath: string;
  /** Row uid. */
  uid: string;
  /** True when the form's local row list still has this uid (typical
   *  for the saved-removed case the chip surfaces). */
  formContainsUid: boolean;
  /** Run when the user picks "Use saved (remove)" — typically the
   *  Form.List `remove(idx)` call. The wrapper then advances baseline
   *  via `acceptTheirs` so the chip dismisses. */
  onUseSaved: () => void;
}

/**
 * Inline saved-removed affordance for one row. Reads the same conflicts
 * API as `<FieldConflictChip>` and only renders when the row diverges.
 */
export function SetRowChip({ setPath, uid, formContainsUid, onUseSaved }: SetRowChipProps): ReactElement | null {
  const conflicts = useFieldConflicts();
  if (!conflicts?.getSetConflict) return null;
  const setRemove = conflicts.getSetConflict(setPath, uid, formContainsUid);
  if (!setRemove || setRemove.kind !== 'set-remove') return null;
  const setKey = `set:${setPath}.${uid}`;
  return (
    <SetRowConflictChip
      baseSummary={setRemove.base}
      remote={setRemove.remote}
      onUseSaved={() => {
        onUseSaved();
        conflicts.acceptTheirs(setKey, '');
      }}
      onKeepMine={() => conflicts.dismiss(setKey)}
    />
  );
}
