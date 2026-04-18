/**
 * Valibot schema for `V5.Rule` — the discriminated union over 8 rule
 * types. Mirrors `types/v5/rule.ts` so hand-written types + schemas
 * stay in lockstep.
 *
 * Split from `rule-draft.ts`: drafts are pre-fill handoffs used by the
 * DevTools panel → workspace bridge; this schema is the *persisted*
 * rule shape (carries uid / path / schemaVersion / conditions / action).
 */

import * as v from 'valibot';
import { RelativePathSchema, SchemaVersionSchema, UidSchema } from './common';

// ── Conditions ──────────────────────────────────────────────────────

export const ConditionTypeSchema = v.picklist([
  'url-filter',
  'url-regex',
  'request-domains',
  'exclude-request-domains',
  'initiator-domains',
  'exclude-initiator-domains',
  'request-methods',
  'exclude-request-methods',
  'resource-types',
  'exclude-resource-types',
  'domain-type',
  'request-header',
  'exclude-request-header',
  'response-header',
  'exclude-response-header',
]);

export const RuleConditionSchema = v.object({
  type: ConditionTypeSchema,
  values: v.array(v.string()),
  headerName: v.optional(v.string()),
});

// ── RuleBase shared fields ─────────────────────────────────────────

const RuleBaseFields = {
  schemaVersion: SchemaVersionSchema,
  uid: UidSchema,
  path: RelativePathSchema,
  name: v.string(),
  enabled: v.boolean(),
  conditions: v.array(RuleConditionSchema),
} as const;

// ── Header rule ────────────────────────────────────────────────────

export const HeaderOperationSchema = v.picklist(['override', 'add', 'remove', 'merge']);

export const HeaderModificationSchema = v.object({
  operation: HeaderOperationSchema,
  headerName: v.string(),
  value: v.optional(v.string()),
  mergeSeparator: v.optional(v.string()),
});

export const HeaderActionSchema = v.object({
  requestHeaders: v.array(HeaderModificationSchema),
  responseHeaders: v.array(HeaderModificationSchema),
});

export const HeaderRuleSchema = v.object({
  ...RuleBaseFields,
  type: v.literal('header'),
  action: HeaderActionSchema,
});

// ── Redirect rule ──────────────────────────────────────────────────

export const RedirectActionSchema = v.object({
  matchPattern: v.string(),
  redirectTo: v.string(),
});

export const RedirectRuleSchema = v.object({
  ...RuleBaseFields,
  type: v.literal('redirect'),
  action: RedirectActionSchema,
});

// ── Body rule ──────────────────────────────────────────────────────

export const BodyModTypeSchema = v.picklist(['static', 'dynamic']);
export const BodyResourceTypeSchema = v.picklist(['rest', 'graphql']);

export const GraphqlFilterSchema = v.object({
  key: v.string(),
  operator: v.picklist(['Equals', 'Contains']),
  value: v.string(),
});

export const BodyActionSchema = v.object({
  bodyType: BodyModTypeSchema,
  body: v.string(),
  resourceType: BodyResourceTypeSchema,
  graphqlFilter: v.optional(GraphqlFilterSchema),
});

export const BodyRuleSchema = v.object({
  ...RuleBaseFields,
  type: v.literal('body'),
  action: BodyActionSchema,
});

// ── Inject rule ────────────────────────────────────────────────────

export const InjectTypeSchema = v.picklist(['script', 'css']);
export const InjectSourceSchema = v.picklist(['code', 'url']);
export const InjectPositionSchema = v.picklist(['head', 'body-start', 'body-end']);

export const InjectActionSchema = v.object({
  injectType: InjectTypeSchema,
  code: v.string(),
  sourceUrl: v.optional(v.string()),
  source: InjectSourceSchema,
  position: InjectPositionSchema,
  bypassCSP: v.optional(v.boolean()),
});

export const InjectRuleSchema = v.object({
  ...RuleBaseFields,
  type: v.literal('inject'),
  action: InjectActionSchema,
});

// ── Block rule ─────────────────────────────────────────────────────

export const BlockActionSchema = v.object({
  statusCode: v.number(),
  responseBody: v.optional(v.string()),
});

export const BlockRuleSchema = v.object({
  ...RuleBaseFields,
  type: v.literal('block'),
  action: BlockActionSchema,
});

// ── Delay rule ─────────────────────────────────────────────────────

export const DelayActionSchema = v.object({
  delayMs: v.number(),
});

export const DelayRuleSchema = v.object({
  ...RuleBaseFields,
  type: v.literal('delay'),
  action: DelayActionSchema,
});

// ── Mock rule ──────────────────────────────────────────────────────

export const MockBodyTypeSchema = v.picklist(['static', 'dynamic']);

export const MockActionSchema = v.object({
  statusCode: v.number(),
  responseHeaders: v.record(v.string(), v.string()),
  responseBody: v.string(),
  contentType: v.string(),
  bodyType: MockBodyTypeSchema,
  resourceType: v.optional(BodyResourceTypeSchema),
  graphqlFilter: v.optional(GraphqlFilterSchema),
});

export const MockRuleSchema = v.object({
  ...RuleBaseFields,
  type: v.literal('mock'),
  action: MockActionSchema,
});

// ── Query-param rule ───────────────────────────────────────────────

export const QueryParamOperationSchema = v.picklist(['add', 'override', 'remove', 'remove-all']);

export const QueryParamEntrySchema = v.object({
  param: v.string(),
  value: v.optional(v.string()),
  operation: QueryParamOperationSchema,
});

export const QueryParamActionSchema = v.object({
  params: v.array(QueryParamEntrySchema),
});

export const QueryParamRuleSchema = v.object({
  ...RuleBaseFields,
  type: v.literal('query-param'),
  action: QueryParamActionSchema,
});

// ── Discriminated union ────────────────────────────────────────────

export const RuleSchema = v.variant('type', [
  HeaderRuleSchema,
  RedirectRuleSchema,
  BodyRuleSchema,
  InjectRuleSchema,
  BlockRuleSchema,
  DelayRuleSchema,
  MockRuleSchema,
  QueryParamRuleSchema,
]);
