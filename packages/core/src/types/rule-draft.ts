/**
 * Rule drafts — partial rule pre-fills produced by tools outside the
 * create-rule editor (currently: the Open Headers DevTools panel).
 *
 * A `RuleDraft` carries just enough information to seed the create-rule
 * form for a given rule type. The workspace's create-tab reads the draft
 * on mount and hydrates form state; any field absent from the draft
 * falls back to the type's normal default.
 *
 * Drafts are deliberately disjoint from the `Rule` union — a rule is a
 * fully-formed entity with required conditions and a required action,
 * while a draft is "here's some pre-fill data, fill the rest yourself."
 * Keeping them separate means we never have to produce synthetic values
 * for required fields just to satisfy the `Rule` type.
 *
 * Every shape is derived from the valibot schemas in
 * `schemas/rule-draft.ts` so the bridge-boundary validator and the type
 * stay locked together.
 */

import type * as v from 'valibot';
import type {
  BlockRuleDraftSchema,
  DelayRuleDraftSchema,
  HeaderRuleDraftHeaderSchema,
  HeaderRuleDraftSchema,
  InjectRuleDraftSchema,
  QueryParamDraftEntrySchema,
  QueryParamRuleDraftSchema,
  RedirectRuleDraftSchema,
  RequestBodyRuleDraftSchema,
  ResponseRuleDraftSchema,
  RuleDraftBaseSchema,
  RuleDraftSchema,
  SseRuleDraftSchema,
  WsRuleDraftSchema,
} from '../schemas/rule-draft';

export type RuleDraftBase = v.InferOutput<typeof RuleDraftBaseSchema>;

export type HeaderRuleDraftHeader = v.InferOutput<typeof HeaderRuleDraftHeaderSchema>;
export type HeaderRuleDraft = v.InferOutput<typeof HeaderRuleDraftSchema>;

export type RedirectRuleDraft = v.InferOutput<typeof RedirectRuleDraftSchema>;
export type RequestBodyRuleDraft = v.InferOutput<typeof RequestBodyRuleDraftSchema>;
export type ResponseRuleDraft = v.InferOutput<typeof ResponseRuleDraftSchema>;
export type BlockRuleDraft = v.InferOutput<typeof BlockRuleDraftSchema>;
export type DelayRuleDraft = v.InferOutput<typeof DelayRuleDraftSchema>;

export type QueryParamDraftEntry = v.InferOutput<typeof QueryParamDraftEntrySchema>;
export type QueryParamRuleDraft = v.InferOutput<typeof QueryParamRuleDraftSchema>;

export type InjectRuleDraft = v.InferOutput<typeof InjectRuleDraftSchema>;

export type WsRuleDraft = v.InferOutput<typeof WsRuleDraftSchema>;
export type SseRuleDraft = v.InferOutput<typeof SseRuleDraftSchema>;

export type RuleDraft = v.InferOutput<typeof RuleDraftSchema>;

export type RuleDraftType = RuleDraft['type'];
