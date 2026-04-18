/**
 * Valibot schema for `V5.Request`.
 *
 * Mirrors `types/v5/request.ts` field-for-field. Auth is a discriminated
 * union on `type`; body carries an optional `content` + graphql vars.
 */

import * as v from 'valibot';
import { RelativePathSchema, SchemaVersionSchema, UidSchema } from './common';

export const HttpMethodSchema = v.picklist(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);

export const BodyTypeSchema = v.picklist(['none', 'json', 'xml', 'graphql', 'form', 'multipart', 'text']);

export const CredentialsModeSchema = v.picklist(['omit', 'include']);

export const AuthConfigSchema = v.variant('type', [
  v.object({ type: v.literal('none') }),
  v.object({ type: v.literal('inherit') }),
  v.object({
    type: v.literal('basic'),
    username: v.string(),
    password: v.string(),
  }),
  v.object({
    type: v.literal('bearer'),
    token: v.string(),
  }),
  v.object({
    type: v.literal('api-key'),
    key: v.string(),
    value: v.string(),
    in: v.picklist(['header', 'query']),
  }),
]);

export const RequestHeaderSchema = v.object({
  key: v.string(),
  value: v.string(),
  enabled: v.optional(v.boolean()),
});

export const QueryParamSchema = v.object({
  key: v.string(),
  value: v.string(),
  enabled: v.optional(v.boolean()),
});

export const RequestBodySchema = v.object({
  type: BodyTypeSchema,
  content: v.optional(v.string()),
  graphqlVariables: v.optional(v.string()),
});

export const RequestSchema = v.object({
  schemaVersion: SchemaVersionSchema,
  uid: UidSchema,
  path: RelativePathSchema,
  name: v.string(),
  method: HttpMethodSchema,
  url: v.string(),
  headers: v.array(RequestHeaderSchema),
  params: v.array(QueryParamSchema),
  auth: AuthConfigSchema,
  credentialsMode: v.optional(CredentialsModeSchema),
  body: RequestBodySchema,
  preRequestScript: v.optional(v.string()),
  testScript: v.optional(v.string()),
});
