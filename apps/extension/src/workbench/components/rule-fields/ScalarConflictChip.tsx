/**
 * Inline diff chip for a scalar rule field (Phase A A4 — scalar widening).
 *
 * Header-mod rows render their own chip inline (per-row Form.Item already
 * tracks the value). Scalar fields are simpler: one form name, one
 * schema path, one bridge. This wraps the shouldUpdate boilerplate so
 * each scalar Form.Item pairs with one `<ScalarConflictChip>`.
 *
 * Lives next to use-rule-conflicts.ts so the rule-fields/ folder owns
 * both the tracker and the renderer; the awareness layer's
 * `ConflictDiffChip` stays pure UI / rule-shape-agnostic.
 */

import { Form } from 'antd';
import type React from 'react';
import { ConflictDiffChip } from '@/shared/awareness';
import type { ConflictBridge } from './use-rule-conflicts';

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
