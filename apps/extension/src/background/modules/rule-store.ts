/**
 * Rule Store — single source of truth for V5 rules in the extension.
 *
 * Authority hierarchy:
 *   1. WebSocket (desktop app) — authoritative, overwrites everything
 *   2. storage.local — persistence for offline/restart
 *   3. In-memory cache — fast reads
 *
 * Rules arrive pre-resolved from the desktop (no {{VAR}} templates).
 */

import type { V5 } from '@openheaders/core/types';
import { storage } from '@utils/browser-api';
import { logger } from '@utils/logger';

const STORAGE_KEY = 'v5Rules';

let rules: V5.Rule[] = [];

/**
 * Get current rules from memory.
 */
export function getRules(): V5.Rule[] {
  return rules;
}

/**
 * Get only enabled header rules (the subset that affects network traffic).
 */
export function getEnabledHeaderRules(): V5.HeaderRule[] {
  return rules.filter((r): r is V5.HeaderRule => r.type === 'header' && r.enabled);
}

/**
 * Update rules from WebSocket. Persists to storage for offline restart.
 */
export function setRulesFromApp(incoming: V5.Rule[]): void {
  rules = incoming;
  storage.local.set({ [STORAGE_KEY]: incoming }, () => {
    logger.debug('RuleStore', `Persisted ${incoming.length} rules to storage`);
  });
}

/**
 * Hydrate from storage on startup (before WebSocket connects).
 * Returns the restored rules.
 */
export function hydrateFromStorage(): Promise<V5.Rule[]> {
  return new Promise((resolve) => {
    storage.local.get([STORAGE_KEY], (result: Record<string, unknown>) => {
      const stored = result[STORAGE_KEY] as V5.Rule[] | undefined;
      if (Array.isArray(stored) && stored.length > 0) {
        rules = stored;
        logger.info('RuleStore', `Hydrated ${stored.length} rules from storage`);
        resolve(stored);
      } else {
        resolve([]);
      }
    });
  });
}
