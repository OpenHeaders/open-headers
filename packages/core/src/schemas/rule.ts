/**
 * Valibot schema for `Rule` — the discriminated union over 8 rule
 * types. Mirrors `types/rule.ts` so hand-written types + schemas
 * stay in lockstep.
 *
 * Split from `rule-draft.ts`: drafts are pre-fill handoffs used by the
 * DevTools panel → workspace bridge; this schema is the *persisted*
 * rule shape (carries uid / path / schemaVersion / conditions / action).
 */

import * as v from 'valibot';
import { RelativePathSchema, SchemaVersionSchema, UidSchema } from './common';

// ── Rule-type discriminator (shared by rule + template) ────────────

export const RuleTypeSchema = v.picklist([
  'header',
  'redirect',
  'body',
  'inject',
  'block',
  'delay',
  'mock',
  'query-param',
]);

// ── Conditions ──────────────────────────────────────────────────────

// Chrome MV3 DNR has no request-header matching; the request-side
// counterparts of `response-header` were never shipped. We omit them from
// the schema entirely — the schema starts clean. If Chrome ships request-header
// matching later, re-add the two types here and flip them in
// `condition-metadata.ts`.
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
  'response-header',
  'exclude-response-header',
]);

export const RuleConditionSchema = v.object({
  uid: UidSchema,
  type: ConditionTypeSchema,
  values: v.array(v.string()),
  headerName: v.optional(v.string()),
});

// ── RuleBase shared fields ─────────────────────────────────────────
//
// Exposed as a full `RuleBaseSchema` so `RuleBase` can be derived from
// it (matches the Phase 2 "derive types from schemas" discipline). The
// schema is never parsed in isolation — each rule variant carries the
// discriminator + action on top via `v.variant('type', [...])`.
//
// `type` is kept as the wide `RuleTypeSchema` picklist here so derived
// consumers (e.g. `isRuleComplete`'s switch over `base.type`) can read the
// discriminator without narrowing to a specific rule variant. Each variant
// below overrides it with `v.literal('<kind>')` — valibot's `v.variant`
// discriminates on the literal, so runtime parsing remains exact.

export const RuleBaseSchema = v.object({
  schemaVersion: SchemaVersionSchema,
  uid: UidSchema,
  path: RelativePathSchema,
  name: v.string(),
  type: RuleTypeSchema,
  enabled: v.boolean(),
  /**
   * Publication gate (sync engine §19.1 + product safety requirement).
   *
   * `enabled` is the user toggle ("turn this rule on/off"); `published`
   * is "I've committed this draft to live state." Both must be true,
   * the rule must be `isRuleComplete`, no parent path nor the engine
   * may be paused — all five are AND-ed in `isRuleEffective`.
   *
   * Why a separate axis from `enabled`: a rule the user explicitly
   * disabled and a rule the user is mid-drafting must look different
   * in the UI and route differently in the side-effect runners. New
   * rules from `+ New Rule` start `published: false` so per-keystroke
   * mutations stream into a real entity without exposing half-typed
   * values to live network traffic. The Save button flips this to
   * true; editing a published rule auto-flips it back to false in the
   * same batch as the first edit, re-flipping on next Save.
   *
   * Optional at the schema level so fixtures and YAML records that
   * predate the field type-check without churn. Read sites treat
   * `published !== true` (i.e. `false` or `undefined`) as "draft" —
   * `isRuleEffective` AND-s on `=== true`, runners filter the same
   * way. The single negation centralizes the contract.
   */
  published: v.optional(v.boolean()),
  conditions: v.array(RuleConditionSchema),
});
// `version: number` was the Phase 10 stale-draft counter — the sync
// engine (`docs/SYNC_ENGINE_DESIGN.md` §24 kill list) replaces it with
// HLC-stamped per-field LWW. Other entities keep their `version` until
// Phase B; rule is the first to drop it.

const RuleBaseFields = RuleBaseSchema.entries;

// ── Header rule ────────────────────────────────────────────────────

export const HeaderOperationSchema = v.picklist(['override', 'add', 'remove', 'merge']);

export const HeaderModificationSchema = v.object({
  uid: UidSchema,
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

// Redirect actions only carry the target. URL matching is fully expressed
// by the rule's `conditions` (url-filter / url-regex / request-domains);
// a separate `matchPattern` field would be redundant — the compiler ignores
// it and there's no editor surface for it.
export const RedirectActionSchema = v.object({
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
// Inject position semantics:
//   - 'head'     — runs as soon as possible (uses chrome.scripting's
//                  `injectImmediately: true`, before page parser starts).
//   - 'body-end' — runs after the page has parsed (the default scripting
//                  injection behavior, equivalent to a `<script>` tag at
//                  the end of body).
// Only meaningful for `injectType: 'script'`. CSS rules use `insertCSS`
// which doesn't honor position — it always applies as soon as the tab
// allows it. The field is persisted on CSS rules but ignored on the wire.
export const InjectPositionSchema = v.picklist(['head', 'body-end']);

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
//
// Block actions have no fields. Chrome DNR's `block` returns
// `ERR_BLOCKED_BY_CLIENT` at the network layer — there's no synthetic
// status code and no response body. For "block with a custom response",
// use a `mock` rule with the desired status code and body.

export const BlockActionSchema = v.object({});

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

// Query-param operations:
//   - 'add'        — add or replace (Chrome `addOrReplaceParams` without
//                    `replaceOnly`). Adds when missing, overwrites when present.
//   - 'override'   — replace only (Chrome `addOrReplaceParams` with
//                    `replaceOnly: true`). Updates when present, leaves the URL
//                    untouched when missing — useful for canonicalizing values
//                    on URLs that already carry the param.
//   - 'remove'     — remove a specific named param.
//   - 'remove-all' — strip the entire query string.
export const QueryParamOperationSchema = v.picklist(['add', 'override', 'remove', 'remove-all']);

export const QueryParamEntrySchema = v.object({
  uid: UidSchema,
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
