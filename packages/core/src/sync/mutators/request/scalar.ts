/**
 * Scalar `setField` intent factory for request entities.
 *
 * Single typed-path generic that constrains call sites to the actual
 * scalar paths on `Request`. This keeps grep-friendliness ("who
 * sets request.url") while collapsing nine near-identical micro-
 * factories into one — a posture the established catalogs reach for
 * when the per-path body is identical save for the path string itself.
 *
 * `auth` and `body` are listed as scalar paths even though both are
 * discriminated unions on disk — this factory is the generic single-
 * path setter, so a caller MAY hand either a whole new variant value.
 * The request write-path builder (`request-mutations` `buildUpdateBatch`)
 * does NOT take that route: it routes object-valued scalars through
 * `synthesizeFieldDiff`, emitting a per-leaf flatten-diff that mirrors
 * create's granularity. A whole-object `setField('auth', …)` would
 * collide with the create-time `auth.type` leaf and let the stale
 * discriminant clobber the edit at materialize time. Per-leaf
 * PERSISTENCE is live; per-leaf CONFLICT tracking inside the variants
 * stays deferred (SYNC_ENGINE_STATUS.md §427).
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
  | 'sslVerification'
  | 'tlsMinVersion'
  | 'tlsMaxVersion'
  | 'tlsCipherSuites'
  | 'allowHttp2'
  | 'resolveToAddress'
  | 'timeoutMs'
  | 'maxResponseBytes'
  | 'maxRedirects'
  | 'followOriginalHttpMethod'
  | 'followAuthorizationHeader'
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
