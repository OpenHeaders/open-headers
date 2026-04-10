/**
 * Shared types and constants for declarativeNetRequest rule builders.
 *
 * Each rule type has its own builder module that implements DnrBuilder.
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
  value: string;
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

// ── Builder interface ────────────────────────────────────────────

/**
 * A per-type builder that converts a V5 rule into declarativeNetRequest rules.
 * Returns [] if the rule is invalid or should be skipped.
 */
export interface DnrBuilder<T extends V5.Rule> {
  ruleType: V5.RuleType;
  build(rule: T, startId: number): DnrRule[];
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

  // Default resource types if none specified
  if (!base.resourceTypes && !base.excludedResourceTypes) {
    base.resourceTypes = ALL_RESOURCE_TYPES;
  }

  return { base, domains, useRegex, urlPattern };
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
