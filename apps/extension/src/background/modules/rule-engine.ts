/**
 * RuleEngine — single owner of declarativeNetRequest rule updates.
 *
 * All modules call scheduleUpdate(reason) instead of updateNetworkRules()
 * directly. The engine coalesces rapid calls, deduplicates by hash, and ensures
 * exactly one updateNetworkRules() call per logical change.
 */

import { logger } from '@utils/logger';
import { updateNetworkRules } from '@/background/header-manager';
import { getRules } from './rule-store';
import { generateRulesHash } from './utils';

interface ScheduleOptions {
  immediate?: boolean;
}

const DEBOUNCE_MS = 150;
const FORCED_REASONS = new Set(['pause', 'init', 'rules', 'rulesUpdated', 'tagGroups']);

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let forcedPending = false;
let lastRulesHash = '';

/**
 * Schedule a rule update. Rapid calls within DEBOUNCE_MS are coalesced
 * into a single updateNetworkRules() call.
 */
export function scheduleUpdate(reason: string, options: ScheduleOptions = {}): void {
  if (options.immediate) {
    forcedPending = false;
    flushUpdate(reason, FORCED_REASONS.has(reason));
    return;
  }

  if (FORCED_REASONS.has(reason)) {
    forcedPending = true;
  }

  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    const forced = forcedPending;
    forcedPending = false;
    flushUpdate(reason, forced);
  }, DEBOUNCE_MS);
}

function flushUpdate(reason: string, forced?: boolean): void {
  const rules = getRules();
  const currentHash = generateRulesHash(rules);

  if (currentHash === lastRulesHash && !forced) {
    logger.debug('RuleEngine', `Rule update skipped (${reason}) — hash unchanged`);
    return;
  }

  logger.info('RuleEngine', `Updating network rules (${reason}), ${rules.length} rules`);
  updateNetworkRules(rules);
  lastRulesHash = currentHash;
}

// ── Hash tracking ─────────────────────────────────────────────────

export function getLastRulesHash(): string {
  return lastRulesHash;
}

export function setLastRulesHash(hash: string): void {
  lastRulesHash = hash;
}
