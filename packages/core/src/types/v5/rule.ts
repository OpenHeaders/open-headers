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

/**
 * Rule types supported by the browser extension.
 * DNR-based: header, block, redirect, query-param (declarativeNetRequest API).
 * Script-based: inject, delay, body, mock (chrome.scripting API — monkey-patches fetch/XHR).
 */
export type ExtensionRuleType = 'header' | 'block' | 'redirect' | 'query-param' | 'inject' | 'delay' | 'body' | 'mock';

/** DNR rule types — use declarativeNetRequest API. */
export type DnrRuleType = 'header' | 'block' | 'redirect' | 'query-param';

/** Script-based rule types — use chrome.scripting API to monkey-patch fetch/XHR. */
export type ScriptRuleType = 'inject' | 'delay' | 'body' | 'mock';

// ── Conditions ────────────────────────────────────────────────────
//
// Each condition type maps 1:1 to a Chrome declarativeNetRequest field.
// No abstraction layer — what the user configures is exactly what Chrome executes.

/**
 * Condition types that map directly to Chrome DNR condition fields.
 *
 * ── URL Matching (pick one per rule) ──
 *   'url-filter'             → urlFilter (Chrome's pattern language: * wildcards, || domain anchors, | start/end)
 *   'url-regex'              → regexFilter (RE2 regex on full URL, mutually exclusive with url-filter)
 *
 * ── Domain Filtering ──
 *   'request-domains'        → requestDomains (subdomain matching: 'a.com' matches '*.a.com')
 *   'exclude-request-domains'→ excludedRequestDomains
 *   'initiator-domains'      → initiatorDomains (page that made the request)
 *   'exclude-initiator-domains' → excludedInitiatorDomains
 *
 * ── Request Filtering ──
 *   'request-methods'        → requestMethods (multi-select)
 *   'exclude-request-methods'→ excludedRequestMethods
 *   'resource-types'         → resourceTypes (multi-select)
 *   'exclude-resource-types' → excludedResourceTypes
 *   'domain-type'            → domainType ('firstParty' | 'thirdParty')
 *
 * ── Header Matching (Chrome 128+) ──
 *   'request-header'         → requestHeaders (header name + exact values)
 *   'exclude-request-header' → excludedRequestHeaders
 *   'response-header'        → responseHeaders
 *   'exclude-response-header'→ excludedResponseHeaders
 */
export type ConditionType =
  // URL matching
  | 'url-filter'
  | 'url-regex'
  // Domain filtering
  | 'request-domains'
  | 'exclude-request-domains'
  | 'initiator-domains'
  | 'exclude-initiator-domains'
  // Request filtering
  | 'request-methods'
  | 'exclude-request-methods'
  | 'resource-types'
  | 'exclude-resource-types'
  | 'domain-type'
  // Header matching (Chrome 128+)
  | 'request-header'
  | 'exclude-request-header'
  | 'response-header'
  | 'exclude-response-header';

/** A single condition entry — one row in the conditions panel. */
export interface RuleCondition {
  /** Maps directly to a Chrome DNR condition field. */
  type: ConditionType;
  /** Values. Array for multi-value fields (domains, methods, types). Supports {{VAR}}. */
  values: string[];
  /** Header name — only for header condition types. */
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

/** A single header modification — one row in the "Request Headers" or "Response Headers" list. */
export interface HeaderModification {
  operation: HeaderOperation;
  headerName: string;
  /** Header value. Supports {{VAR}} interpolation. Not needed for 'remove'. */
  value?: string;
}

/**
 * Header action — maps 1:1 to Chrome's modifyHeaders DNR action.
 * Supports multiple request AND response header modifications in a single rule.
 */
export interface HeaderAction {
  requestHeaders: HeaderModification[];
  responseHeaders: HeaderModification[];
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

export type BodyModType = 'static' | 'dynamic';

/** 'rest' = REST API. 'graphql' = GraphQL API (adds operation filter). */
export type BodyResourceType = 'rest' | 'graphql';

export interface BodyAction {
  /** 'static' = replace body with literal value. 'dynamic' = JS function that modifies body. */
  bodyType: BodyModType;
  /** For static: the replacement body content. For dynamic: the JS function code. */
  body: string;
  /** Resource type — REST or GraphQL. */
  resourceType: BodyResourceType;
  /** GraphQL payload filter — key, operator, value (only when resourceType is 'graphql'). */
  graphqlFilter?: {
    key: string;
    operator: 'Equals' | 'Contains';
    value: string;
  };
}

export interface BodyRule extends RuleBase {
  type: 'body';
  action: BodyAction;
}

// ── Inject rule (script/CSS injection) ─────────────────────────────

export type InjectType = 'script' | 'css';

/** 'code' = inline code. 'url' = load from external URL. */
export type InjectSource = 'code' | 'url';

export interface InjectAction {
  injectType: InjectType;
  /** Inline code (when source is 'code'). */
  code: string;
  /** External URL to load script/CSS from (when source is 'url'). */
  sourceUrl?: string;
  /** Code source mode. Defaults to 'code'. */
  source: InjectSource;
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

// ── Mock rule (Modify API Response) ──────────────────────────────

/** 'static' = fixed response body. 'dynamic' = JS function that receives request context and returns modified response. */
export type MockBodyType = 'static' | 'dynamic';

export interface MockAction {
  statusCode: number;
  responseHeaders: Record<string, string>;
  /** For static mode: the literal response body. For dynamic mode: the JavaScript function code. */
  responseBody: string;
  contentType: string;
  /** Response body mode. Defaults to 'static'. */
  bodyType: MockBodyType;
}

export interface MockRule extends RuleBase {
  type: 'mock';
  action: MockAction;
}

// ── Query Param rule ──────────────────────────────────────────────

export type QueryParamOperation = 'add' | 'override' | 'remove' | 'remove-all';

export interface QueryParamEntry {
  /** Parameter name. Supports {{VAR}}. Not needed for 'remove-all'. */
  param: string;
  /** Parameter value. Not needed for 'remove' or 'remove-all'. Supports {{VAR}}. */
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
