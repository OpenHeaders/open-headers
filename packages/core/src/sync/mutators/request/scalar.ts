/**
 * Scalar `setField` intent factory for request entities.
 *
 * Single typed-path generic that constrains call sites to the actual
 * scalar paths on `Request`. This keeps grep-friendliness ("who
 * sets request.url") while collapsing nine near-identical micro-
 * factories into one — a posture the established catalogs reach for
 * when the per-path body is identical save for the path string itself.
 *
 * `auth` and `body` are scalars here even though both are
 * discriminated unions on disk. Per `types.ts`'s rationale: per-field
 * LWW within a variant would need branch-aware paths the catalog
 * can't know in advance, so whole-object replacement is the v1
 * contract. Concurrent two-surface body-form-part edits collapse to
 * last-writer-wins on the whole `body`. The editor surface is the
 * single producer today; sub-field LWW lands as a Phase B+ wrinkle
 * if a multi-surface request editor ships.
 */

import type { MutatorContext, MutatorIntent } from '../types';
import { mintBatch } from './envelope';
import { REQUEST_ENTITY_TYPE } from './types';

/**
 * The set of scalar paths the catalog accepts. Aligned with
 * `RequestSchema` minus the two set-modeled paths (`headers`,
 * `params`). String-literal union → editor type errors when a path
 * drifts from the schema.
 */
export type RequestScalarPath =
  | 'name'
  | 'description'
  | 'method'
  | 'url'
  | 'auth'
  | 'body'
  | 'credentialsMode'
  | 'followRedirects'
  | 'preRequestScript'
  | 'postResponseScript';

export interface SetRequestFieldArgs {
  requestUid: string;
  path: RequestScalarPath;
  /**
   * The field's new value. Typed `unknown` here because the union
   * of valid values is the union of types across every path; the
   * call site narrows via the `path` it picks. Schema validation
   * happens at the oracle boundary.
   */
  value: unknown;
}

export function setRequestField(ctx: MutatorContext, args: SetRequestFieldArgs): MutatorIntent {
  return {
    batch: mintBatch(ctx, [
      {
        kind: 'setField',
        type: REQUEST_ENTITY_TYPE,
        id: args.requestUid,
        path: args.path,
        value: args.value,
      },
    ]),
    sideEffects: [],
  };
}
