/**
 * Rule types for the git-based workspace format.
 *
 * Rules define how the browser extension modifies HTTP traffic.
 * On disk, each rule is a folder containing rule.yaml + optional scripts.js,
 * organized in the same collection/folder/item hierarchy as requests.
 *
 * Rule types: header, redirect, body, inject, block, delay, mock.
 * Header rules have static values with {{VAR}} interpolation.
 * Dynamic value linking (to requests) is deferred to a later phase.
 */

import type { HttpMethod } from './request';

// ── Rule types ─────────────────────────────────────────────────────

export type RuleType = 'header' | 'redirect' | 'body' | 'inject' | 'block' | 'delay' | 'mock' | 'query-param';

/** Rule types supported by the browser extension (no proxy needed). */
export type ExtensionRuleType = 'header' | 'block' | 'redirect' | 'query-param' | 'inject';

/** Rule types that require the desktop app (proxy-based). */
export type DesktopOnlyRuleType = 'body' | 'delay' | 'mock';

// ── Base rule ──────────────────────────────────────────────────────

export interface RuleBase {
  /** 4-char uid from folder name suffix. */
  uid: string;
  /** Relative path within workspace. */
  path: string;
  name: string;
  type: RuleType;
  enabled: boolean;
  /** Tags for grouping (e.g. ["dev-overrides"]). */
  tags: string[];
  /** Domain patterns with glob support (e.g. "*.openheaders.io"). Supports {{VAR}}. */
  domains: string[];
  /** URL path patterns (optional, for finer matching). */
  urlPatterns?: string[];
  /** Filter by HTTP method (optional). */
  methods?: HttpMethod[];
  /** Filter by resource type (optional). */
  resourceTypes?: ResourceType[];
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
  /** Static value template. Supports {{VAR}} interpolation. */
  staticValue?: string;
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

export type Rule = HeaderRule | RedirectRule | BodyRule | InjectRule | BlockRule | DelayRule | MockRule | QueryParamRule;
