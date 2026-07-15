/**
 * Conflict tracking + resolve adapters for any entity that holds a
 * uid-keyed `variables: Variable[]` set.
 *
 * Driven by the field-tree descriptor + generic walker in
 * `shared/conflicts/field-tree/`. Set-member identity is `variable.uid`
 * (post-session-66); concurrent same-uid renames surface as a leaf
 * conflict at `variables.<uid>.name`, NOT set-add + set-remove —
 * harness scenario `genVariableRenameSameUid` exercises the
 * convergent-rename guarantee.
 */

import type { Variable } from '@openheaders/core/types';
import type {
  ConflictResolveAdapter,
  ConflictTrackingAdapter,
} from '@openheaders/ui/shared/conflicts/conflict-adapters';
import { enumLeaf, leaf, obj, setByUid } from '@openheaders/ui/shared/conflicts/field-tree/descriptor';
import { makeConflictAdapter } from '@openheaders/ui/shared/conflicts/field-tree/make-conflict-adapter';

export interface VariableEntity {
  uid: string;
  variables: Variable[];
}

const VAR_LEAVES = ['name', 'value', 'type', 'enabled'] as const;
export type VariableLeafName = (typeof VAR_LEAVES)[number];

const summarize = (row: { name?: string; value?: string }): string => `${row.name ?? ''} = ${row.value ?? ''}`;

const VARIABLE_SCHEMA = obj({
  variables: setByUid({
    summary: (row) => summarize(row as Variable),
    rowLabel: (row) => {
      const v = row as Variable;
      return v.name ? `Variable ${v.name}` : 'Variable';
    },
    child: obj({
      name: leaf('string'),
      value: leaf('string'),
      type: enumLeaf(['default', 'secret']),
      enabled: leaf('boolean', { coercion: 'enabled-default-true' }),
    }),
  }),
});

const adapters = makeConflictAdapter<VariableEntity>({
  schema: VARIABLE_SCHEMA,
  signature: (e) => e.uid,
});

const LEAF_LABEL: Record<VariableLeafName, string> = { name: 'name', value: 'value', type: 'type', enabled: 'enabled' };

const VAR_PATH_RE = /^variables\.([a-z0-9]{8})\.(name|value|type|enabled)$/;

function findRowName(entity: VariableEntity, uid: string): string | null {
  return entity.variables.find((v) => v.uid === uid)?.name ?? null;
}

export const variableConflictAdapter: ConflictTrackingAdapter<VariableEntity> = adapters.tracking;

export const variableResolveAdapter: ConflictResolveAdapter<VariableEntity> = {
  ...adapters.resolve,
  prettyPath(entity, path) {
    const leafMatch = VAR_PATH_RE.exec(path);
    if (leafMatch) {
      const name = findRowName(entity, leafMatch[1]);
      const label = LEAF_LABEL[leafMatch[2] as VariableLeafName];
      return name ? `Variable ${name} (${label})` : `Variable (${label})`;
    }
    if (path.startsWith('reorder:')) return 'Variables — order changed';
    return adapters.resolve.prettyPath(entity, path);
  },
};
