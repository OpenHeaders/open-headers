/**
 * The per-kind auth offer — ONE list per wire kind naming the auth
 * types the kind can carry, read by the schema of the request's OWN
 * auth (the masked variant below) and by the inheritance mask
 * (`@openheaders/core/auth-inheritance`), so the two never drift: a
 * request may define any type its kind can carry, and an inherited
 * entry is held to the same list. The lists are `as const` tuples so
 * a kind's schema keeps an exact static type.
 *
 * WebSocket takes the handshake header types plus what rides the dial
 * URL's query (a query-placed key or token, the AWS signed URL); gRPC
 * the metadata-pair types (no query leg); MQTT the CONNECT username /
 * password alone. Placement rules the type list cannot express (a
 * query placement off a query leg, an AWS signature in header mode on
 * a WebSocket, a DPoP-bound OAuth 2.0 config) are the mask's refusal
 * predicate, not the schema's.
 */

import * as v from 'valibot';
import {
  ApiKeyAuthSchema,
  AsapAuthSchema,
  AwsSigV4AuthSchema,
  BasicAuthSchema,
  BearerAuthSchema,
  DigestAuthSchema,
  EdgeGridAuthSchema,
  HawkAuthSchema,
  HttpSignatureAuthSchema,
  InheritAuthSchema,
  JwtAuthSchema,
  NoneAuthSchema,
  OAuth1AuthSchema,
  OAuth2AuthSchema,
} from './request';

const AUTH_SCHEMA_BY_TYPE = {
  none: NoneAuthSchema,
  basic: BasicAuthSchema,
  bearer: BearerAuthSchema,
  'api-key': ApiKeyAuthSchema,
  oauth2: OAuth2AuthSchema,
  'aws-sigv4': AwsSigV4AuthSchema,
  edgegrid: EdgeGridAuthSchema,
  asap: AsapAuthSchema,
  digest: DigestAuthSchema,
  oauth1: OAuth1AuthSchema,
  hawk: HawkAuthSchema,
  jwt: JwtAuthSchema,
  'http-signature': HttpSignatureAuthSchema,
} as const;

/** Every concrete auth type's discriminant. */
export type AuthConfigType = keyof typeof AUTH_SCHEMA_BY_TYPE;

/** An HTTP send takes everything. */
export const HTTP_AUTH_TYPES = [
  'none',
  'basic',
  'bearer',
  'api-key',
  'oauth2',
  'aws-sigv4',
  'edgegrid',
  'asap',
  'digest',
  'oauth1',
  'hawk',
  'jwt',
  'http-signature',
] as const satisfies readonly AuthConfigType[];

/** A WebSocket handshake: header pairs, the dial URL's query, the
 *  AWS signed URL. */
export const WEBSOCKET_AUTH_TYPES = [
  'none',
  'bearer',
  'basic',
  'api-key',
  'oauth2',
  'jwt',
  'aws-sigv4',
] as const satisfies readonly AuthConfigType[];

/** A gRPC call: metadata pairs only. */
export const GRPC_AUTH_TYPES = [
  'none',
  'bearer',
  'basic',
  'api-key',
  'oauth2',
  'jwt',
] as const satisfies readonly AuthConfigType[];

/** An MQTT CONNECT: the username / password pair. */
export const MQTT_AUTH_TYPES = ['none', 'basic'] as const satisfies readonly AuthConfigType[];

/**
 * The schema of a request's own auth for a kind: the listed types'
 * concrete shapes plus `inherit` (the ancestor pool's default or a
 * named entry). The output type is exactly the listed variants, so a
 * kind's `Auth` type stays a checked subset of `AuthConfig`.
 */
export function requestAuthSchemaFor<const T extends AuthConfigType>(types: readonly T[]) {
  return v.variant('type', [...types.map((type) => AUTH_SCHEMA_BY_TYPE[type]), InheritAuthSchema]);
}
