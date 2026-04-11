/**
 * Client-side URL matching for "This Page" rule filtering.
 *
 * Evaluates rule conditions against a tab URL to determine if the rule
 * would potentially fire on that page. Only evaluates URL/domain conditions —
 * resource-type and method conditions can't be checked without a request context.
 */

import type { V5 } from '@openheaders/core/types';

/**
 * Check if a rule's conditions match a given tab URL.
 * Returns true if the rule could fire on this page.
 *
 * Rules with no URL/domain conditions always match (they apply globally).
 * Rules with only resource-type/method conditions also match (can't filter without request context).
 */
export function ruleMatchesUrl(rule: V5.Rule, tabUrl: string): boolean {
  if (rule.conditions.length === 0) return true;

  let url: URL;
  try {
    url = new URL(tabUrl);
  } catch {
    return false;
  }

  // Only check URL/domain conditions — others are request-level and always pass at page level
  for (const condition of rule.conditions) {
    switch (condition.type) {
      case 'url-filter': {
        const pattern = condition.values[0];
        if (pattern && !matchUrlFilter(tabUrl, pattern)) return false;
        break;
      }
      case 'url-regex': {
        const regex = condition.values[0];
        if (regex) {
          try {
            if (!new RegExp(regex).test(tabUrl)) return false;
          } catch {
            return false;
          }
        }
        break;
      }
      case 'request-domains': {
        if (condition.values.length > 0 && !matchesDomain(url.hostname, condition.values)) return false;
        break;
      }
      case 'exclude-request-domains': {
        if (condition.values.length > 0 && matchesDomain(url.hostname, condition.values)) return false;
        break;
      }
      case 'initiator-domains':
      case 'exclude-initiator-domains':
      case 'request-methods':
      case 'exclude-request-methods':
      case 'resource-types':
      case 'exclude-resource-types':
      case 'domain-type':
      case 'request-header':
      case 'exclude-request-header':
      case 'response-header':
      case 'exclude-response-header':
        // Can't evaluate these without a request context — assume match
        break;
    }
  }

  return true;
}

/**
 * Simplified Chrome urlFilter pattern matching.
 * Supports: * (wildcard), || (domain anchor), | (start/end anchor), ^ (separator).
 */
function matchUrlFilter(url: string, pattern: string): boolean {
  // Convert Chrome urlFilter pattern to regex
  let regex = '';
  let i = 0;

  // || at start = domain anchor (matches scheme + any subdomain)
  if (pattern.startsWith('||')) {
    regex += '^https?://([a-z0-9-]+\\.)*';
    i = 2;
  } else if (pattern.startsWith('|')) {
    regex += '^';
    i = 1;
  }

  for (; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === '*') {
      regex += '.*';
    } else if (ch === '^') {
      regex += '[^a-zA-Z0-9_.%-]';
    } else if (ch === '|' && i === pattern.length - 1) {
      regex += '$';
    } else {
      regex += ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
  }

  try {
    return new RegExp(regex, 'i').test(url);
  } catch {
    return false;
  }
}

/** Chrome domain matching: 'a.com' matches 'a.com' and '*.a.com'. */
function matchesDomain(hostname: string, domains: string[]): boolean {
  return domains.some((d) => {
    const domain = d.toLowerCase();
    const host = hostname.toLowerCase();
    return host === domain || host.endsWith(`.${domain}`);
  });
}
