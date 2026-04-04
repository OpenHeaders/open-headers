/**
 * Rule types for v5.
 *
 * Rules define how the proxy/extension modifies HTTP traffic.
 * Key changes from v4:
 * - Rules own the relationship to Requests (replaces Source linking)
 * - New rule types: redirect, inject, block, delay, mock
 * - Tags are arrays (rules can belong to multiple groups)
 * - Proxy rules merged into main rules (proxyEnabled flag)
 */

// ── Value source ───────────────────────────────────────────────────

/**
 * Where a rule gets its value from.
 * - 'static': value is a template string, may contain {{VAR}} references
 * - 'request': value is extracted from a linked Request's response
 */
export type ValueSource = 'static' | 'request';

// ── Request source (replaces v4 Source + isDynamic/sourceId) ───────

export type RefreshMode = 'manual' | 'interval' | 'on-expire';

export type ExtractTarget = 'body' | 'header' | 'status';

/**
 * Configuration for extracting a value from a Request's response.
 * This replaces the v4 pattern of Source.jsonFilter + Rule.isDynamic/sourceId/prefix/suffix.
 */
export interface RequestSource {
  /** ID of a Request in Collections. */
  requestId: string;
  /** JSONPath expression to extract value (e.g. "$.access_token"). */
  responseExtract: string;
  /** Which part of the response to extract from. */
  extractTarget: ExtractTarget;
  /**
   * Template for the final value. Use {value} as placeholder for the extracted value.
   * Example: "Bearer {value}" wraps the extracted token.
   * If omitted, the raw extracted value is used.
   */
  valueTemplate?: string;
  /** How the value is refreshed. */
  refreshMode: RefreshMode;
  /** Seconds between refreshes (when refreshMode is 'interval'). */
  refreshInterval?: number;
  /** Optionally also store the extracted value as an environment variable. */
  storeAsVariable?: string;

  // ── Runtime state (not synced via Git) ───────────────────────────
  lastRefreshed?: string;
  lastValue?: string | null;
  nextRefresh?: string;
}

// ── Rule types ─────────────────────────────────────────────────────

export type RuleType = 'header' | 'redirect' | 'body' | 'inject' | 'block' | 'delay' | 'mock';

// ── Base rule ──────────────────────────────────────────────────────

export interface RuleBase {
  id: string;
  name: string;
  type: RuleType;
  enabled: boolean;
  /** Tags for grouping (e.g. ["backend"]). Replaces v4 singular `tag` string. */
  tags: string[];
  /** Domain patterns with glob support (e.g. "*.example.com"). Supports {{VAR}} interpolation. */
  domains: string[];
  /** URL path patterns (optional, for finer matching). */
  urlPatterns?: string[];
  /** Filter by HTTP method (optional). */
  methods?: HttpMethod[];
  /** Filter by resource type (optional). */
  resourceTypes?: ResourceType[];
  /** Whether this rule also applies in the proxy server. Replaces v4 proxy-rules.json. */
  proxyEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

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

// ── Header rule ────────────────────────────────────────────────────

export type HeaderOperation = 'add' | 'override' | 'remove';

export interface HeaderAction {
  operation: HeaderOperation;
  headerName: string;
  isResponse: boolean;
}

export interface HeaderRule extends RuleBase {
  type: 'header';
  action: HeaderAction;
  valueSource: ValueSource;
  /**
   * Static value template. Supports {{VAR}} interpolation.
   * Used when valueSource is 'static'.
   * Example: "{{MC2_VOS_X_TENANT_ID}}" or "Bearer {{TOKEN}}"
   */
  staticValue?: string;
  /**
   * Request-sourced value configuration.
   * Used when valueSource is 'request'.
   */
  requestSource?: RequestSource;
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

// ── Body rule (replaces v4 PayloadRule) ────────────────────────────

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

// ── Union ──────────────────────────────────────────────────────────

export type Rule = HeaderRule | RedirectRule | BodyRule | InjectRule | BlockRule | DelayRule | MockRule;
