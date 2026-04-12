/**
 * Shared types and constants for declarativeNetRequest rule builders.
 *
 * Each rule type has its own compiler module that implements RuleCompiler.
 * The dnr-manager coordinator dispatches to the appropriate builder
 * and collects the resulting DnrRule[] for atomic application.
 */

import type { V5 } from '@openheaders/core/types';

// ── DNR rule shape ───────────────────────────────────────────────

/** Chrome DNR condition — maps to chrome.declarativeNetRequest.RuleCondition. */
export interface DnrCondition {
  urlFilter?: string;
  regexFilter?: string;
  isUrlFilterCaseSensitive?: boolean;
  resourceTypes?: chrome.declarativeNetRequest.ResourceType[];
  excludedResourceTypes?: chrome.declarativeNetRequest.ResourceType[];
  requestDomains?: string[];
  excludedRequestDomains?: string[];
  initiatorDomains?: string[];
  excludedInitiatorDomains?: string[];
  requestMethods?: string[];
  excludedRequestMethods?: string[];
  domainType?: 'firstParty' | 'thirdParty';
  requestHeaders?: Array<{ header: string; values?: string[]; excludedValues?: string[] }>;
  excludedRequestHeaders?: Array<{ header: string; values?: string[] }>;
  responseHeaders?: Array<{ header: string; values?: string[]; excludedValues?: string[] }>;
  excludedResponseHeaders?: Array<{ header: string; values?: string[] }>;
  /** Restrict the rule to specific tabs. Used by the test-runner for session rules. */
  tabIds?: number[];
  /** Exclude specific tabs. Used by the test-runner to hide dynamic rules from test tabs. */
  excludedTabIds?: number[];
}

/** A fully built chrome.declarativeNetRequest rule ready for application. */
export interface DnrRule {
  id: number;
  priority: number;
  action: {
    type: string;
    requestHeaders?: DnrHeaderModification[];
    responseHeaders?: DnrHeaderModification[];
    redirect?: DnrRedirect;
  };
  condition: DnrCondition;
}

export interface DnrHeaderModification {
  header: string;
  operation: 'set' | 'remove' | 'append';
  /** Required for set/append operations. Must be omitted for remove — Chrome DNR rejects remove with a value. */
  value?: string;
}

export interface DnrRedirect {
  url?: string;
  regexSubstitution?: string;
  transform?: {
    query?: string;
    queryTransform?: {
      addOrReplaceParams?: Array<{ key: string; value: string; replaceOnly?: boolean }>;
      removeParams?: string[];
    };
  };
}

// ── Compilation plan ─────────────────────────────────────────────
//
// Every rule compiles into a plan that tells us what DNR rules to install
// for it. The plan has two output lists:
//
//   - dynamicRules: installed via updateDynamicRules, most rules
//   - sessionRules: installed via updateSessionRules, for rules that need
//     per-tab scoping via tabIds/excludedTabIds (Chrome only supports
//     those fields on session-scoped rules)
//
// In-page script injections are NOT part of the plan. inject-manager
// consumes V5 rules from the rule store directly and handles its own
// per-navigation injection lifecycle — the two concerns have different
// cadences (DNR: lives for the rule's lifetime; scriptable: runs per
// page load) and stay cleanly decoupled.
//
// A single V5 rule can contribute rules to both layers. Delay rules emit
// sessionRules (because they need excludedTabIds for loop-prevention
// bypass). Inject rules with bypassCSP emit dynamicRules (to strip CSP
// headers). Header rules with set/append/remove ops emit dynamicRules.
// The same rule may ALSO run a scriptable injection — inject-manager
// decides that from the rule itself, independently of this plan.
//
// Each DnrRule is tagged with its source V5 uid by dnr-manager after
// compilation so id→uid lookups stay correct for telemetry.

// ── Scriptable injection shapes ──────────────────────────────────
//
// A scriptable injection is whatever inject-manager can apply via the
// chrome.scripting API. Two shapes:
//
//   1. `func` — a real TypeScript function serialized via Function.toString,
//      executed in the page's MAIN world by chrome.scripting.executeScript.
//      CSP-safe because it does NOT create an inline <script> tag.
//   2. `inline-script` — a string of JavaScript wrapped in a <script> tag
//      injected into the page's DOM. Subject to the page's CSP — used for
//      rules that embed arbitrary user JS (dynamic body/mock) which can't
//      be embedded inside a closed TypeScript function.
//
// The func signature uses `never` as the parameter type because it's
// serialized and executed in the page; calling it directly from the
// background would be a type error, which is what we want.

export interface FuncInjection {
  kind: 'func';
  func: (cfg: never) => void;
  args: [unknown];
}

export interface InlineScriptInjection {
  kind: 'inline-script';
  code: string;
}

export type Injection = FuncInjection | InlineScriptInjection;

/**
 * The output of compiling a single V5 rule. All fields are arrays so
 * compilers can emit zero, one, or many of each. Missing arrays default
 * to empty — compilers may return a partial object.
 */
export interface CompilationPlan {
  /** DNR rules installed in the dynamic layer (most common). */
  dynamicRules?: DnrRule[];
  /** DNR rules installed in the session layer (needed for per-tab scope). */
  sessionRules?: DnrRule[];
}

/**
 * Context passed to every compiler. `allocateId` returns a unique DnrRule id
 * each call — compilers don't manage id allocation themselves.
 */
export interface CompilerContext {
  allocateId(): number;
}

/**
 * A per-type compiler that turns a V5 rule into a CompilationPlan.
 * Returns a plan with empty arrays if the rule is invalid or should be skipped.
 */
export interface RuleCompiler<T extends V5.Rule> {
  ruleType: V5.RuleType;
  compile(rule: T, ctx: CompilerContext): CompilationPlan;
}

// ── Condition builder ────────────────────────────────────────────

/** Resource type mapping: our names → Chrome DNR names. */
const RESOURCE_TYPE_MAP: Record<string, string> = {
  page: 'main_frame',
  xhr: 'xmlhttprequest',
  script: 'script',
  stylesheet: 'stylesheet',
  image: 'image',
  font: 'font',
  media: 'media',
  websocket: 'websocket',
  other: 'other',
};

/**
 * Convert V5 RuleCondition[] into a Chrome DNR condition object.
 *
 * Each condition type maps 1:1 to a Chrome DNR field — no translation,
 * no approximation. What the user configures is what Chrome executes.
 */
export function buildDnrCondition(conditions: V5.RuleCondition[]): {
  base: DnrCondition;
  domains: string[];
  useRegex: boolean;
  urlPattern?: string;
} {
  const base: DnrCondition = {};
  const domains: string[] = [];
  let useRegex = false;
  let urlPattern: string | undefined;

  for (const cond of conditions) {
    const vals = cond.values.filter((v) => v.trim());
    if (vals.length === 0 && cond.type !== 'domain-type') continue;

    switch (cond.type) {
      // ── URL matching (one per rule) ──
      case 'url-filter':
        urlPattern = vals[0];
        break;
      case 'url-regex':
        useRegex = true;
        urlPattern = vals[0];
        break;

      // ── Domain filtering ──
      case 'request-domains':
        domains.push(...vals);
        base.requestDomains = [...(base.requestDomains ?? []), ...vals];
        break;
      case 'exclude-request-domains':
        base.excludedRequestDomains = [...(base.excludedRequestDomains ?? []), ...vals];
        break;
      case 'initiator-domains':
        base.initiatorDomains = [...(base.initiatorDomains ?? []), ...vals];
        break;
      case 'exclude-initiator-domains':
        base.excludedInitiatorDomains = [...(base.excludedInitiatorDomains ?? []), ...vals];
        break;

      // ── Request filtering ──
      case 'request-methods':
        base.requestMethods = [...(base.requestMethods ?? []), ...vals.map((v) => v.toLowerCase())];
        break;
      case 'exclude-request-methods':
        base.excludedRequestMethods = [...(base.excludedRequestMethods ?? []), ...vals.map((v) => v.toLowerCase())];
        break;
      case 'resource-types':
        base.resourceTypes = [
          ...(base.resourceTypes ?? []),
          ...vals.map((v) => RESOURCE_TYPE_MAP[v] ?? v).filter(Boolean),
        ] as chrome.declarativeNetRequest.ResourceType[];
        break;
      case 'exclude-resource-types':
        base.excludedResourceTypes = [
          ...(base.excludedResourceTypes ?? []),
          ...vals.map((v) => RESOURCE_TYPE_MAP[v] ?? v).filter(Boolean),
        ] as chrome.declarativeNetRequest.ResourceType[];
        break;
      case 'domain-type':
        if (vals[0]) base.domainType = vals[0] as 'firstParty' | 'thirdParty';
        break;

      // ── Header matching (Chrome 128+) ──
      case 'request-header':
        if (cond.headerName) {
          base.requestHeaders = [
            ...(base.requestHeaders ?? []),
            { header: cond.headerName, values: vals.length > 0 ? vals : undefined },
          ];
        }
        break;
      case 'exclude-request-header':
        if (cond.headerName) {
          base.excludedRequestHeaders = [
            ...(base.excludedRequestHeaders ?? []),
            { header: cond.headerName, values: vals.length > 0 ? vals : undefined },
          ];
        }
        break;
      case 'response-header':
        if (cond.headerName) {
          base.responseHeaders = [
            ...(base.responseHeaders ?? []),
            { header: cond.headerName, values: vals.length > 0 ? vals : undefined },
          ];
        }
        break;
      case 'exclude-response-header':
        if (cond.headerName) {
          base.excludedResponseHeaders = [
            ...(base.excludedResponseHeaders ?? []),
            { header: cond.headerName, values: vals.length > 0 ? vals : undefined },
          ];
        }
        break;
    }
  }

  // Note: we intentionally do NOT default `resourceTypes` here. The resolver
  // (`resolveResourceTypes`) is the single source of truth for which resource
  // types end up on the emitted rule, and it handles defaulting from each
  // builder's capability set. Defaulting here would conflate "user said
  // nothing" with "user explicitly listed everything" and would also let the
  // default leak past builders that strip-and-replace.

  return { base, domains, useRegex, urlPattern };
}

// ── Resource-type resolution ─────────────────────────────────────
//
// Chrome DNR rejects any rule where the same resource type appears in both
// `resourceTypes` and `excludedResourceTypes` ("includes and excludes the
// same resource"). It also defaults `resourceTypes` to `['main_frame']` when
// neither field is set, which is almost never what we want.
//
// Every builder solves the same problem: take its capability set (the
// resource types its action can meaningfully apply to) and reconcile that
// with whatever `resource-types` / `exclude-resource-types` conditions the
// user authored, then emit a SINGLE canonical `resourceTypes` array on the
// final rule with no `excludedResourceTypes` field at all.
//
// `resolveResourceTypes` does that fold; `stripResourceTypeFields` removes
// both raw fields from `base` so they can never leak through a `...base`
// spread into the emitted condition.

/**
 * Fold a builder's capability set with the user's resource-type conditions.
 *
 * @param capability  resource types the emitted rule can meaningfully act on
 * @param userInclude user's `resource-types` condition (undefined or empty = no include filter)
 * @param userExclude user's `exclude-resource-types` condition (undefined or empty = no exclude filter)
 * @returns the resolved list, or `null` if the intersection is empty (caller should skip)
 */
export function resolveResourceTypes(
  capability: chrome.declarativeNetRequest.ResourceType[],
  userInclude: chrome.declarativeNetRequest.ResourceType[] | undefined,
  userExclude: chrome.declarativeNetRequest.ResourceType[] | undefined,
): chrome.declarativeNetRequest.ResourceType[] | null {
  const include = userInclude && userInclude.length > 0 ? new Set(userInclude) : null;
  const exclude = new Set(userExclude ?? []);
  const out = capability.filter((t) => !exclude.has(t) && (!include || include.has(t)));
  return out.length === 0 ? null : out;
}

/**
 * Strip the raw resource-type fields from a base condition. Builders call
 * this before spreading `base` into the emitted condition so the resolved
 * `resourceTypes` from `resolveResourceTypes` is the only resource-type
 * field on the wire.
 */
export function stripResourceTypeFields(
  condition: DnrCondition,
): Omit<DnrCondition, 'resourceTypes' | 'excludedResourceTypes'> {
  const { resourceTypes: _rt, excludedResourceTypes: _ert, ...rest } = condition;
  return rest;
}

// ── Shared resource type constants ───────────────────────────────

export const ALL_RESOURCE_TYPES: chrome.declarativeNetRequest.ResourceType[] = [
  'main_frame',
  'sub_frame',
  'stylesheet',
  'script',
  'image',
  'font',
  'object',
  'xmlhttprequest',
  'websocket',
  'other',
] as chrome.declarativeNetRequest.ResourceType[];

export const SUB_RESOURCE_TYPES: chrome.declarativeNetRequest.ResourceType[] = [
  'sub_frame',
  'stylesheet',
  'script',
  'image',
  'font',
  'xmlhttprequest',
  'websocket',
  'other',
] as chrome.declarativeNetRequest.ResourceType[];
