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
 */

import type { BodyResourceType, HeaderOperation, InjectSource, InjectType, QueryParamOperation } from './rule';

/** Fields common to every rule-draft variant. */
export interface RuleDraftBase {
  /** Optional pre-fill name. When absent, the create-tab generates the default. */
  name?: string;
  /**
   * Full raw URL observed when the draft was authored. The workspace
   * derives the actual `url-filter` condition from this via the
   * user-configurable draft URL strategy (exact / path-wildcard /
   * host-only / raw). Prefer this over `urlFilter` when the caller has
   * the whole URL and wants the workspace to decide how specific the
   * generated pattern should be.
   */
  url?: string;
  /**
   * Caller-controlled pre-computed `url-filter` pattern. Takes
   * precedence over `url` when both are supplied — use this when the
   * caller has already decided on an exact pattern and doesn't want
   * the workspace's strategy applied.
   */
  urlFilter?: string;
  /** Seeds a `request-methods` condition. */
  requestMethods?: string[];
  /** Seeds a `resource-types` condition. */
  resourceTypes?: string[];
}

// ── Per-type drafts ────────────────────────────────────────────────

export interface HeaderRuleDraftHeader {
  operation: HeaderOperation;
  headerName: string;
  value?: string;
  mergeSeparator?: string;
}

export interface HeaderRuleDraft extends RuleDraftBase {
  type: 'header';
  requestHeaders?: HeaderRuleDraftHeader[];
  responseHeaders?: HeaderRuleDraftHeader[];
}

export interface RedirectRuleDraft extends RuleDraftBase {
  type: 'redirect';
  matchPattern?: string;
  redirectTo?: string;
}

export interface BodyRuleDraft extends RuleDraftBase {
  type: 'body';
  bodyType?: 'static' | 'dynamic';
  body?: string;
  resourceType?: BodyResourceType;
}

export interface MockRuleDraft extends RuleDraftBase {
  type: 'mock';
  statusCode?: number;
  responseBody?: string;
  responseHeaders?: Record<string, string>;
  contentType?: string;
  bodyType?: 'static' | 'dynamic';
  resourceType?: BodyResourceType;
}

export interface BlockRuleDraft extends RuleDraftBase {
  type: 'block';
  statusCode?: number;
  responseBody?: string;
}

export interface DelayRuleDraft extends RuleDraftBase {
  type: 'delay';
  delayMs?: number;
}

export interface QueryParamDraftEntry {
  operation: QueryParamOperation;
  param: string;
  value?: string;
}

export interface QueryParamRuleDraft extends RuleDraftBase {
  type: 'query-param';
  params?: QueryParamDraftEntry[];
}

export interface InjectRuleDraft extends RuleDraftBase {
  type: 'inject';
  injectType?: InjectType;
  source?: InjectSource;
  code?: string;
  sourceUrl?: string;
  position?: 'head' | 'body-start' | 'body-end';
  bypassCSP?: boolean;
}

export type RuleDraft =
  | HeaderRuleDraft
  | RedirectRuleDraft
  | BodyRuleDraft
  | MockRuleDraft
  | BlockRuleDraft
  | DelayRuleDraft
  | QueryParamRuleDraft
  | InjectRuleDraft;

export type RuleDraftType = RuleDraft['type'];
