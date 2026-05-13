/**
 * Scalar `setField` intent factory for template entities.
 *
 * Single typed-path generic that constrains call sites to the actual
 * scalar paths on `Template`. Same posture as `request/scalar.ts` —
 * collapses near-identical micro-factories into one and catches schema
 * drift at the call site via the string-literal union.
 *
 * `formValues` and `includes` are scalars here even though both are
 * structured. Per `types.ts`'s rationale: per-field LWW within a
 * variant would need branch-aware paths the catalog can't know in
 * advance, so whole-object replacement is the v1 contract. Concurrent
 * two-surface edits collapse to last-writer-wins on the whole field.
 *
 * `updatedAt` is included so the editor's save gesture can bundle the
 * timestamp bump into the same batch as the rest of its scalar setFields,
 * keeping the template's display "modified at …" in lockstep with its
 * actual mutation HLC under per-batch all-or-nothing.
 */

import type { MutatorContext, MutatorIntent } from '../types';
import { mintBatch } from './envelope';
import { TEMPLATE_ENTITY_TYPE } from './types';

/**
 * The set of scalar paths the catalog accepts. Aligned with
 * `TemplateSchema` minus the one set-modeled path (`conditions`).
 * String-literal union → editor type errors when a path drifts from
 * the schema.
 */
export type TemplateScalarPath =
  | 'name'
  | 'description'
  | 'icon'
  | 'ruleType'
  | 'path'
  | 'formValues'
  | 'includes'
  | 'createdAt'
  | 'updatedAt';

export interface SetTemplateFieldArgs {
  templateUid: string;
  path: TemplateScalarPath;
  /**
   * The field's new value. Typed `unknown` here because the union of
   * valid values is the union of types across every path; the call
   * site narrows via the `path` it picks. Schema validation happens
   * at the oracle boundary.
   */
  value: unknown;
}

export function setTemplateField(ctx: MutatorContext, args: SetTemplateFieldArgs): MutatorIntent {
  return {
    batch: mintBatch(ctx, [
      {
        kind: 'setField',
        type: TEMPLATE_ENTITY_TYPE,
        id: args.templateUid,
        path: args.path,
        value: args.value,
      },
    ]),
    sideEffects: [],
  };
}
