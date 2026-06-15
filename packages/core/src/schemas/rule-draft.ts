/**
 * Valibot schema for RuleDraft — validates the pre-fill payload handed
 * from the DevTools panel to the workspace create-rule editor via the
 * background draft store. Parsed in the bridge handler before the draft
 * is stashed, and again before it's handed to the workspace, so neither
 * side has to trust the other's shape at runtime.
 */

import * as v from 'valibot';
import {
  BodyModTypeSchema,
  BodyResourceTypeSchema,
  HeaderOperationSchema,
  InjectSourceSchema,
  InjectTypeSchema,
  QueryParamOperationSchema,
  ResponseBodyTypeSchema,
  ResponseSourceSchema,
} from './rule';

// Shared draft base fields — carried by every rule-draft variant.
export const RuleDraftBaseSchema = v.object({
  name: v.optional(v.string()),
  url: v.optional(v.string()),
  urlFilter: v.optional(v.string()),
  requestMethods: v.optional(v.array(v.string())),
  resourceTypes: v.optional(v.array(v.string())),
});

const RuleDraftBaseFields = RuleDraftBaseSchema.entries;

export const HeaderRuleDraftHeaderSchema = v.object({
  operation: HeaderOperationSchema,
  headerName: v.string(),
  value: v.optional(v.string()),
  mergeSeparator: v.optional(v.string()),
});

export const HeaderRuleDraftSchema = v.object({
  type: v.literal('header'),
  ...RuleDraftBaseFields,
  requestHeaders: v.optional(v.array(HeaderRuleDraftHeaderSchema)),
  responseHeaders: v.optional(v.array(HeaderRuleDraftHeaderSchema)),
});

export const RedirectRuleDraftSchema = v.object({
  type: v.literal('redirect'),
  ...RuleDraftBaseFields,
  redirectTo: v.optional(v.string()),
});

export const BodyRuleDraftSchema = v.object({
  type: v.literal('body'),
  ...RuleDraftBaseFields,
  bodyType: v.optional(BodyModTypeSchema),
  body: v.optional(v.string()),
  resourceType: v.optional(BodyResourceTypeSchema),
});

export const ResponseRuleDraftSchema = v.object({
  type: v.literal('response'),
  ...RuleDraftBaseFields,
  responseSource: v.optional(ResponseSourceSchema),
  statusCode: v.optional(v.number()),
  responseBody: v.optional(v.string()),
  responseHeaders: v.optional(v.record(v.string(), v.string())),
  contentType: v.optional(v.string()),
  bodyType: v.optional(ResponseBodyTypeSchema),
  resourceType: v.optional(BodyResourceTypeSchema),
});

export const BlockRuleDraftSchema = v.object({
  type: v.literal('block'),
  ...RuleDraftBaseFields,
});

export const DelayRuleDraftSchema = v.object({
  type: v.literal('delay'),
  ...RuleDraftBaseFields,
  delayMs: v.optional(v.number()),
});

export const QueryParamDraftEntrySchema = v.object({
  operation: QueryParamOperationSchema,
  param: v.string(),
  value: v.optional(v.string()),
});

export const QueryParamRuleDraftSchema = v.object({
  type: v.literal('query-param'),
  ...RuleDraftBaseFields,
  params: v.optional(v.array(QueryParamDraftEntrySchema)),
});

const InjectPositionSchema = v.picklist(['head', 'body-end']);

export const InjectRuleDraftSchema = v.object({
  type: v.literal('inject'),
  ...RuleDraftBaseFields,
  injectType: v.optional(InjectTypeSchema),
  source: v.optional(InjectSourceSchema),
  code: v.optional(v.string()),
  sourceUrl: v.optional(v.string()),
  position: v.optional(InjectPositionSchema),
  bypassCSP: v.optional(v.boolean()),
});

export const RuleDraftSchema = v.variant('type', [
  HeaderRuleDraftSchema,
  RedirectRuleDraftSchema,
  BodyRuleDraftSchema,
  ResponseRuleDraftSchema,
  BlockRuleDraftSchema,
  DelayRuleDraftSchema,
  QueryParamRuleDraftSchema,
  InjectRuleDraftSchema,
]);
