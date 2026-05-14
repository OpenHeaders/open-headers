/**
 * Inline diff chip for a scalar form field — entity-agnostic.
 *
 * Reads the conflicts API from `<ConflictsProvider>` context (see
 * `Field.tsx`). Editors mount the provider once at the per-type
 * rendering boundary and every per-leaf scalar field pairs with a
 * `<ScalarConflictChip>` that subscribes via context.
 *
 * Set-row leaves render their own per-row chip via `<FieldConflictChip>`
 * (`Field.tsx`); scalar fields just need form name + schema path.
 */

import { Form } from 'antd';
import type React from 'react';
import { ConflictDiffChip } from '../awareness';
import { useFieldConflicts } from './Field';

export interface ScalarConflictChipProps {
  /** antd Form.Item `name` for the scalar (e.g. "redirectTo"). */
  formName: string;
  /** Canonical schema path the conflict tracker keys baseline + theirs by. */
  schemaPath: string;
}

const ScalarConflictChip: React.FC<ScalarConflictChipProps> = ({ formName, schemaPath }) => {
  const conflicts = useFieldConflicts();
  const form = Form.useFormInstance();
  const localRaw = Form.useWatch(formName, form);
  if (!conflicts) return null;
  const local = String(localRaw ?? '');
  const conflict = conflicts.getConflict(schemaPath, local);
  if (!conflict) return null;
  return (
    <ConflictDiffChip
      theirs={conflict.theirs}
      base={conflict.base}
      local={local}
      remote={conflict.remote}
      onTakeTheirs={() => {
        form.setFieldValue(formName, conflict.theirs);
        conflicts.acceptTheirs(schemaPath, conflict.theirs);
      }}
      onKeepMine={() => conflicts.dismiss(schemaPath)}
    />
  );
};

export default ScalarConflictChip;
