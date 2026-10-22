/**
 * Pure collector for every templatable string in a gRPC request,
 * grouped by the entity field it belongs to.
 *
 * Keep in lock-step with the gRPC executor (`grpc-exec/execute.ts`):
 * every string it feeds through the session's `resolve` at Invoke —
 * the target, the `:authority` override, the enabled metadata rows,
 * the credential, the message text and the SNI override — is a
 * candidate for `{{VAR}}` resolution and must be visible here. The
 * method reference is an identifier, never templated.
 *
 * The input is the entity's FIELD LIST, so the persisted entity and
 * the editor's save projection satisfy it alike.
 */

import type { GrpcRequest } from '../types';
import { collectAuthTemplateStrings, collectPairTemplateStrings } from './auth-scan';

export type GrpcTemplateSource = Pick<
  GrpcRequest,
  'url' | 'authority' | 'metadata' | 'auth' | 'message' | 'sniServerName'
>;

/** The templates by the entity field they ride, in wire order. */
export interface GrpcTemplateGroups {
  /** The target and the `:authority` override. */
  url: string[];
  metadata: string[];
  auth: string[];
  message: string[];
  /** The channel knobs — the SNI override. */
  settings: string[];
}

export function collectGrpcTemplateGroups(request: GrpcTemplateSource): GrpcTemplateGroups {
  const url: string[] = [];
  if (request.url) url.push(request.url);
  if (request.authority) url.push(request.authority);

  const metadata: string[] = [];
  collectPairTemplateStrings(request.metadata, metadata);

  const auth: string[] = [];
  if (request.auth) collectAuthTemplateStrings(request.auth, auth);

  const message: string[] = [];
  if (request.message) message.push(request.message);

  const settings: string[] = [];
  if (request.sniServerName) settings.push(request.sniServerName);

  return { url, metadata, auth, message, settings };
}

/** Flat, order-preserving list of every templatable string in `request`. */
export function collectGrpcRequestTemplateStrings(request: GrpcTemplateSource): string[] {
  const g = collectGrpcTemplateGroups(request);
  return [...g.url, ...g.metadata, ...g.auth, ...g.message, ...g.settings];
}
