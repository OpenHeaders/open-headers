/**
 * Rule types for the git-based workspace format.
 *
 * Rules define how the browser extension modifies HTTP traffic.
 * On disk, each rule is a folder containing rule.yaml + optional scripts.js,
 * organized in the same collection/folder/item hierarchy as requests.
 *
 * A rule = conditions (when to match) + action (what to do).
 * Conditions are AND-evaluated: all must match for the rule to fire.
 * Actions are type-specific: header, redirect, body, inject, block, delay, mock, query-param.
 */

// ── Rule types ─────────────────────────────────────────────────────

export type RuleType = 'header' | 'redirect' | 'body' | 'inject' | 'block' | 'delay' | 'mock' | 'query-param';

/** Rule types supported by the browser extension (no proxy needed). */
export type ExtensionRuleType = 'header' | 'block' | 'redirect' | 'query-param' | 'inject';

/** Rule types that require the desktop app (proxy-based). */
export type DesktopOnlyRuleType = 'body' | 'delay' | 'mock';

// ── Conditions ────────────────────────────────────────────────────

/** What part of the request to match against. */
export type ConditionType =
  | 'url' // Full URL (urlFilter / regexFilter in DNR)
  | 'host' // Request domain (requestDomains in DNR)
  | 'path' // URL path segment
  | 'method' // HTTP method (requestMethods in DNR)
  | 'resource-type' // Resource type (resourceTypes in DNR)
  | 'domain-type' // First-party vs third-party (domainType in DNR)
  | 'initiator' // Page origin that initiated the request (initiatorDomains in DNR)
  | 'request-header' // Match on request header presence/value (Chrome 128+)
  | 'response-header'; // Match on response header presence/value (Chrome 128+)

/** How to compare the condition value against the request. */
export type ConditionOperator =
  | 'equals' // Exact match
  | 'contains' // Substring match
  | 'matches' // Wildcard/glob (*, ?)
  | 'regex'; // RE2 regular expression (Chrome's regex engine)

/** A single condition entry — one row in the "If request" section. */
export interface RuleCondition {
  /** What to match against. */
  type: ConditionType;
  /** How to compare. */
  operator: ConditionOperator;
  /** Values to match. Always array — single value = ['x'], multi = ['GET','POST']. Supports {{VAR}}. */
  values: string[];
  /** Negate the match: "does NOT contain/equal/match". Maps to Chrome's excluded* fields. */
  exclude?: boolean;
  /** Header name — only for 'request-header' and 'response-header' conditions. */
  headerName?: string;
}

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

export interface RuleBase {
  /** 4-char uid from folder name suffix. */
  uid: string;
  /** Relative path within workspace. */
  path: string;
  name: string;
  type: RuleType;
  enabled: boolean;
  /** Conditions that must ALL match for this rule to fire (AND-evaluated). */
  conditions: RuleCondition[];
}

// ── Header rule ────────────────────────────────────────────────────

export type HeaderOperation = 'add' | 'override' | 'remove';

export interface HeaderAction {
  operation: HeaderOperation;
  headerName: string;
  isResponse: boolean;
  /** Header value. Supports {{VAR}} interpolation. Not needed for 'remove'. */
  value?: string;
}

export interface HeaderRule extends RuleBase {
  type: 'header';
  action: HeaderAction;
}

// ── Redirect rule ──────────────────────────────────────────────────

export interface RedirectAction {
  /** URL pattern to match. */
  matchPattern: string;
  /** URL to redirect to. Supports {{VAR}} and capture groups. */
  redirectTo: string;
}

export interface RedirectRule extends RuleBase {
  type: 'redirect';
  action: RedirectAction;
}

// ── Body rule ──────────────────────────────────────────────────────

export type MatchType = 'contains' | 'regex' | 'exact';

export type ContentType = 'any' | 'json' | 'xml' | 'text' | 'form';

export interface BodyAction {
  matchPattern: string;
  matchType: MatchType;
  replaceWith: string;
  isRequest: boolean;
  isResponse: boolean;
  contentType: ContentType;
}

export interface BodyRule extends RuleBase {
  type: 'body';
  action: BodyAction;
}

// ── Inject rule (script/CSS injection) ─────────────────────────────

export type InjectType = 'script' | 'css';

export interface InjectAction {
  injectType: InjectType;
  code: string;
  /** Where to inject: head, body-start, body-end. */
  position: 'head' | 'body-start' | 'body-end';
}

export interface InjectRule extends RuleBase {
  type: 'inject';
  action: InjectAction;
}

// ── Block rule ─────────────────────────────────────────────────────

export interface BlockAction {
  /** Status code to return (e.g. 403, 503). */
  statusCode: number;
  /** Optional response body. */
  responseBody?: string;
}

export interface BlockRule extends RuleBase {
  type: 'block';
  action: BlockAction;
}

// ── Delay rule ─────────────────────────────────────────────────────

export interface DelayAction {
  /** Milliseconds to delay the response. */
  delayMs: number;
}

export interface DelayRule extends RuleBase {
  type: 'delay';
  action: DelayAction;
}

// ── Mock rule ──────────────────────────────────────────────────────

export interface MockAction {
  statusCode: number;
  responseHeaders: Record<string, string>;
  responseBody: string;
  contentType: string;
}

export interface MockRule extends RuleBase {
  type: 'mock';
  action: MockAction;
}

// ── Query Param rule ──────────────────────────────────────────────

export type QueryParamOperation = 'add' | 'override' | 'remove';

export interface QueryParamEntry {
  /** Parameter name. Supports {{VAR}}. */
  param: string;
  /** Parameter value. Not needed for 'remove'. Supports {{VAR}}. */
  value?: string;
  operation: QueryParamOperation;
}

export interface QueryParamAction {
  params: QueryParamEntry[];
}

export interface QueryParamRule extends RuleBase {
  type: 'query-param';
  action: QueryParamAction;
}

// ── Union ──────────────────────────────────────────────────────────

export type Rule =
  | HeaderRule
  | RedirectRule
  | BodyRule
  | InjectRule
  | BlockRule
  | DelayRule
  | MockRule
  | QueryParamRule;
