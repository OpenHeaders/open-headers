/**
 * Rule types for the git-based workspace format.
 *
 * Rules define how the browser extension modifies HTTP traffic.
 * On disk, each rule is a folder containing rule.yaml + optional scripts.js,
 * organized in the same collection/folder/item hierarchy as requests.
 *
 * A rule = conditions (when to match) + action (what to do).
 * Conditions are AND-evaluated: all must match for the rule to fire.
 * Actions are type-specific: header, redirect, request-body, inject, block,
 * delay, response, query-param, ws, sse.
 *
 * Persisted shapes (RuleBase, RuleCondition, every per-type action + rule,
 * the `Rule` discriminated union) are derived from the valibot schemas so
 * drift between runtime validator and type is impossible by construction.
 * Narrowing helpers (`ExtensionRuleType`, `DnrRuleType`, `ScriptRuleType`)
 * stay hand-written because they encode capability subsets, not persisted
 * shapes.
 */

import type * as v from 'valibot';
import type {
  ApiResourceTypeSchema,
  AuthActionSchema,
  AuthRuleSchema,
  BlockActionSchema,
  BlockRuleSchema,
  ConditionTypeSchema,
  DelayActionSchema,
  DelayRuleSchema,
  HeaderActionSchema,
  HeaderModificationSchema,
  HeaderOperationSchema,
  HeaderRuleSchema,
  InjectActionSchema,
  InjectRuleSchema,
  InjectSourceSchema,
  InjectTriggerSchema,
  InjectTypeSchema,
  MessageFilterSchema,
  MessageOperationSchema,
  QueryParamActionSchema,
  QueryParamEntrySchema,
  QueryParamOperationSchema,
  QueryParamRuleSchema,
  RedirectActionSchema,
  RedirectRuleSchema,
  RequestBodyActionSchema,
  RequestBodyRuleSchema,
  RequestBodyTypeSchema,
  ResponseActionSchema,
  ResponseBodyTypeSchema,
  ResponseRuleSchema,
  ResponseSourceSchema,
  RuleBaseSchema,
  RuleConditionSchema,
  RuleSchema,
  RuleTypeSchema,
  SseActionSchema,
  SseRuleSchema,
  WsActionSchema,
  WsDirectionSchema,
  WsRuleSchema,
} from '../schemas/rule';

// ── Rule types ─────────────────────────────────────────────────────

export type RuleType = v.InferOutput<typeof RuleTypeSchema>;

/**
 * Rule types supported by the browser extension.
 * DNR-based: header, block, redirect, query-param (declarativeNetRequest API).
 * Script-based: inject, delay, request-body, response, ws, sse (chrome.scripting
 * API — monkey-patches fetch/XHR/WebSocket/EventSource).
 */
export type ExtensionRuleType =
  | 'header'
  | 'block'
  | 'redirect'
  | 'query-param'
  | 'inject'
  | 'delay'
  | 'request-body'
  | 'response'
  | 'ws'
  | 'sse'
  | 'auth';

/** DNR rule types — use declarativeNetRequest API. */
export type DnrRuleType = 'header' | 'block' | 'redirect' | 'query-param';

/** Script-based rule types — use chrome.scripting API to monkey-patch fetch/XHR/WebSocket/EventSource. */
export type ScriptRuleType = 'inject' | 'delay' | 'request-body' | 'response' | 'ws' | 'sse';

/**
 * Rule types with a CDP `Fetch` realization — the only types that can be
 * *debug-tier* (CDP Control Plane, Phase D). `request-body`/`response`
 * synthesize or rewrite over `Fetch.fulfillRequest`/`continueRequest`; `auth`
 * answers a challenge over `Fetch.continueWithAuth`. Whether a
 * `request-body`/`response` rule actually IS debug-tier depends on its reach
 * (see `isDebugTierRule`); `auth` is unconditionally debug-tier (no DNR /
 * injection equivalent). Like `DnrRuleType`/`ScriptRuleType`, this is a
 * capability subset, not a persisted shape — tier is never stored on the rule.
 */
export type FetchCapableRuleType = 'request-body' | 'response' | 'auth';

// ── Conditions ────────────────────────────────────────────────────

export type ConditionType = v.InferOutput<typeof ConditionTypeSchema>;
export type RuleCondition = v.InferOutput<typeof RuleConditionSchema>;

/**
 * Chrome DNR resource-type values used inside `resource-types` condition entries.
 * Kept hand-written because the schema stores values as free-form strings
 * (the DNR API validates at the browser boundary).
 */
export type ResourceType =
  | 'page'
  | 'xhr'
  | 'script'
  | 'stylesheet'
  | 'image'
  | 'font'
  | 'media'
  | 'websocket'
  | 'other';

// ── Base rule ──────────────────────────────────────────────────────

export type RuleBase = v.InferOutput<typeof RuleBaseSchema>;

// ── Header rule ────────────────────────────────────────────────────

export type HeaderOperation = v.InferOutput<typeof HeaderOperationSchema>;
export type HeaderModification = v.InferOutput<typeof HeaderModificationSchema>;
export type HeaderAction = v.InferOutput<typeof HeaderActionSchema>;
export type HeaderRule = v.InferOutput<typeof HeaderRuleSchema>;

// ── Redirect rule ──────────────────────────────────────────────────

export type RedirectAction = v.InferOutput<typeof RedirectActionSchema>;
export type RedirectRule = v.InferOutput<typeof RedirectRuleSchema>;

// ── Request-body rule ──────────────────────────────────────────────

export type RequestBodyType = v.InferOutput<typeof RequestBodyTypeSchema>;
/** REST vs GraphQL payload shape — shared by request-body and response rules. */
export type ApiResourceType = v.InferOutput<typeof ApiResourceTypeSchema>;
export type RequestBodyAction = v.InferOutput<typeof RequestBodyActionSchema>;
export type RequestBodyRule = v.InferOutput<typeof RequestBodyRuleSchema>;

// ── Inject rule (script/CSS injection) ─────────────────────────────

export type InjectType = v.InferOutput<typeof InjectTypeSchema>;
export type InjectSource = v.InferOutput<typeof InjectSourceSchema>;
export type InjectAction = v.InferOutput<typeof InjectActionSchema>;
export type InjectRule = v.InferOutput<typeof InjectRuleSchema>;

// ── Block rule ─────────────────────────────────────────────────────

export type BlockAction = v.InferOutput<typeof BlockActionSchema>;
export type BlockRule = v.InferOutput<typeof BlockRuleSchema>;

// ── Delay rule ─────────────────────────────────────────────────────

export type DelayAction = v.InferOutput<typeof DelayActionSchema>;
export type DelayRule = v.InferOutput<typeof DelayRuleSchema>;

// ── Response rule (Modify Response) ──────────────────────────────

export type ResponseSource = v.InferOutput<typeof ResponseSourceSchema>;
export type ResponseBodyType = v.InferOutput<typeof ResponseBodyTypeSchema>;
export type ResponseAction = v.InferOutput<typeof ResponseActionSchema>;
export type ResponseRule = v.InferOutput<typeof ResponseRuleSchema>;

// ── Query Param rule ──────────────────────────────────────────────

export type QueryParamOperation = v.InferOutput<typeof QueryParamOperationSchema>;
export type QueryParamEntry = v.InferOutput<typeof QueryParamEntrySchema>;
export type QueryParamAction = v.InferOutput<typeof QueryParamActionSchema>;
export type QueryParamRule = v.InferOutput<typeof QueryParamRuleSchema>;

// ── WS / SSE message rules ────────────────────────────────────────

export type MessageOperation = v.InferOutput<typeof MessageOperationSchema>;
export type MessageFilter = v.InferOutput<typeof MessageFilterSchema>;
export type InjectTrigger = v.InferOutput<typeof InjectTriggerSchema>;
export type WsDirection = v.InferOutput<typeof WsDirectionSchema>;
export type WsAction = v.InferOutput<typeof WsActionSchema>;
export type WsRule = v.InferOutput<typeof WsRuleSchema>;
export type SseAction = v.InferOutput<typeof SseActionSchema>;
export type SseRule = v.InferOutput<typeof SseRuleSchema>;

// ── Auth rule ──────────────────────────────────────────────────────

export type AuthAction = v.InferOutput<typeof AuthActionSchema>;
export type AuthRule = v.InferOutput<typeof AuthRuleSchema>;

// ── Union ──────────────────────────────────────────────────────────

export type Rule = v.InferOutput<typeof RuleSchema>;
