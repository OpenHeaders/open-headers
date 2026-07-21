/**
 * Wire-request snippet input — the concrete, resolved shape the
 * formatters consume. Produced host-side by the `resolveRequestWire`
 * bridge handler: every `{{ref}}` already substituted, auth folded into
 * headers/query, structured params folded into `url`. The formatters
 * are pure text builders over it and never see scope internals.
 *
 * SigV4 / digest credentials ride separately because neither folds into
 * headers at resolve time (both sign/answer at the wire) — the cURL
 * formatter maps them onto curl's native flags instead.
 */

import type { AwsSigV4Credentials, DigestCredentials } from '../auth-signing';
import type { RequestBody } from '../types';

export interface WireHeader {
  key: string;
  value: string;
}

export interface WireSnippetRequest {
  method: string;
  /** Final URL — query params (user + auth-injected) already folded. */
  url: string;
  headers: WireHeader[];
  /** Resolved domain body union (templates substituted). */
  body: RequestBody;
  /** Present when the effective auth is an enabled `aws-sigv4` config. */
  awsSigV4?: AwsSigV4Credentials;
  /** Present when the effective auth is an enabled `digest` config. */
  digest?: DigestCredentials;
}
