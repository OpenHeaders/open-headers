/**
 * Inline diff chip for a scalar form field — entity-agnostic.
 *
 * Wraps the antd `Form.Item shouldUpdate` boilerplate so each scalar
 * field pairs with one `<ScalarConflictChip>`. Set-row leaves render
 * their own chip per row (the row component already tracks the value
 * via Form.useWatch); scalar fields just need form name + schema path
 * + a `ConflictBridge`.
 *
 * Used by every editor that pairs scalar inputs with a conflict
 * tracker, regardless of entity (rule, template, request body, etc.) —
 * the chip is pure UI built on `ConflictDiffChip` from
 * `@/shared/awareness`.
 */

import { Form } from 'antd';
import type React from 'react';
import { ConflictDiffChip } from '@/shared/awareness';
import type { ConflictBridge } from './types';

export interface ScalarConflictChipProps {
  /** antd Form.Item `name` for the scalar (e.g. "redirectTo"). */
  formName: string;
  /** Canonical schema path the conflict tracker keys baseline + theirs by. */
  schemaPath: string;
  conflicts: ConflictBridge | undefined;
}

const ScalarConflictChip: React.FC<ScalarConflictChipProps> = ({ formName, schemaPath, conflicts }) => {
  const form = Form.useFormInstance();
  if (!conflicts) return null;
  return (
    <Form.Item noStyle shouldUpdate={(prev, cur) => prev[formName] !== cur[formName]}>
      {({ getFieldValue }) => {
        const localValue = String(getFieldValue(formName) ?? '');
        const conflict = conflicts.getConflict(schemaPath, localValue);
        if (!conflict) return null;
        return (
          <ConflictDiffChip
            theirs={conflict.theirs}
            base={conflict.base}
            local={localValue}
            remote={conflict.remote}
            onTakeTheirs={() => {
              form.setFieldValue(formName, conflict.theirs);
              conflicts.onAcceptTheirs(schemaPath, conflict.theirs);
            }}
            onKeepMine={() => conflicts.onDismissConflict(schemaPath)}
          />
        );
      }}
    </Form.Item>
  );
};

export default ScalarConflictChip;
