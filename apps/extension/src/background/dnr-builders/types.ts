/**
 * Shared types and constants for declarativeNetRequest rule builders.
 *
 * Each rule type has its own builder module that implements DnrBuilder.
 * The dnr-manager coordinator dispatches to the appropriate builder
 * and collects the resulting DnrRule[] for atomic application.
 */

import type { V5 } from '@openheaders/core/types';

// ── DNR rule shape ───────────────────────────────────────────────

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
  condition: {
    urlFilter?: string;
    regexFilter?: string;
    resourceTypes?: chrome.declarativeNetRequest.ResourceType[];
    requestDomains?: string[];
  };
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

// ── Condition extraction helpers ─────────────────────────────────

/**
 * Extract host/domain values from a rule's conditions array.
 * Returns the values from 'host' conditions (non-exclude).
 * This is the primary condition used for DNR urlFilter generation.
 */
export function extractDomains(rule: V5.Rule): string[] {
  return rule.conditions
    .filter((c) => c.type === 'host' && !c.exclude)
    .flatMap((c) => c.values)
    .filter((v) => v.trim());
}

/**
 * Extract URL filter values from a rule's conditions array.
 * Returns the values from 'url' conditions (non-exclude).
 */
export function extractUrlFilters(rule: V5.Rule): string[] {
  return rule.conditions
    .filter((c) => c.type === 'url' && !c.exclude)
    .flatMap((c) => c.values)
    .filter((v) => v.trim());
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
