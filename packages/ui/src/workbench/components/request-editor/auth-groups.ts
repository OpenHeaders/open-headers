/**
 * Group vocabulary of the auth forms — one shared set of section
 * names every type's form draws from (Credentials · Token · Signing ·
 * Consumer · Attributes · Delivery · Challenge · Grant · Advanced), so
 * a reader moving between types meets the same words: Delivery is
 * always "where the auth data lands on the wire", Signing always "what
 * derives the signature". `AUTH_TYPE_GROUPS` is each type's section
 * order — the info popovers' kicker chain and the forms read it alike.
 */

import type { MessageKey } from '@openheaders/i18n';

export type AuthGroupKey =
  | 'credentials'
  | 'token'
  | 'signing'
  | 'consumer'
  | 'attributes'
  | 'delivery'
  | 'challenge'
  | 'grant'
  | 'advanced';

export const AUTH_GROUP_LABEL_KEY: Record<AuthGroupKey, MessageKey> = {
  credentials: 'workbench.editors.request.auth.group.credentials',
  token: 'workbench.editors.request.auth.group.token',
  signing: 'workbench.editors.request.auth.group.signing',
  consumer: 'workbench.editors.request.auth.group.consumer',
  attributes: 'workbench.editors.request.auth.group.attributes',
  delivery: 'workbench.editors.request.auth.group.delivery',
  challenge: 'workbench.editors.request.auth.group.challenge',
  grant: 'workbench.editors.request.auth.group.grant',
  advanced: 'workbench.editors.request.auth.group.advanced',
};

/** The types whose forms are sectioned, in their section order.
 *  Delivery closes every form that has one. */
export type GroupedAuthType =
  | 'basic'
  | 'bearer'
  | 'api-key'
  | 'aws-sigv4'
  | 'edgegrid'
  | 'asap'
  | 'digest'
  | 'oauth1'
  | 'hawk'
  | 'jwt'
  | 'oauth2';

export const AUTH_TYPE_GROUPS: Record<GroupedAuthType, readonly AuthGroupKey[]> = {
  basic: ['credentials'],
  bearer: ['token'],
  'api-key': ['credentials', 'delivery'],
  'aws-sigv4': ['credentials', 'signing', 'delivery'],
  edgegrid: ['credentials', 'signing'],
  asap: ['signing', 'token'],
  digest: ['credentials', 'challenge'],
  oauth1: ['signing', 'consumer', 'token', 'delivery'],
  hawk: ['credentials', 'signing', 'attributes'],
  jwt: ['signing', 'token', 'delivery'],
  // Signing renders only while an assertion is in play (a JWT client
  // authentication or the JWT bearer grant).
  oauth2: ['token', 'grant', 'signing', 'advanced'],
};
