/**
 * Empty-GrpcRequest seed factory. Mirrors `request-defaults.ts`:
 * one source of truth for the freshly-created gRPC request shape so
 * every "create gRPC request" gesture stays byte-identical.
 *
 * Defaults:
 *   - url: empty (user fills the authority)
 *   - tls: on (the safe default; the lock toggles it off)
 *   - method: unset (picked from the selector once a spec is linked)
 *   - message / metadata: empty
 */

import type { GrpcRequest } from '../types';

export interface BuildEmptyGrpcRequestInput {
  uid: string;
  /** Full request path: `${parentPath}/${pathSegment}`. */
  path: string;
  name: string;
}

export function buildEmptyGrpcRequest(input: BuildEmptyGrpcRequestInput): GrpcRequest {
  return {
    schemaVersion: 5,
    uid: input.uid,
    path: input.path,
    name: input.name,
    url: '',
    tls: true,
    message: '',
    metadata: [],
  };
}
