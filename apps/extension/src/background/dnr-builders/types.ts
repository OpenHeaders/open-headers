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
