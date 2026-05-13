/**
 * RuleEngine — single owner of declarativeNetRequest rule updates.
 *
 * All modules call scheduleUpdate(reason) instead of updateNetworkRules()
 * directly. The engine coalesces rapid calls, deduplicates by hash, and ensures
 * exactly one updateNetworkRules() call per logical change.
 */

import { logger } from '@utils/logger';
import { updateNetworkRules } from '@/background/dnr-manager';
import { get as getSetting } from '@/workbench/settings/store';
import { getRules } from '@openheaders/oracle/entity/rule-store';
import { generateRulesHash } from './utils';

interface ScheduleOptions {
  immediate?: boolean;
}

const FORCED_REASONS = new Set([
  'pause',
  'init',
  'rules',
  'rulesUpdated',
  'pauseMarkers',
  'prefs',
  'vars',
  'workspace',
  // Live Variables — cache writes (Phase C refresh) + LV definition
  // edits (name / manualOverride / enable) both change the resolved
  // value for `{{live.X}}` references. Treat as forced so the hash
  // guard doesn't skip a rebuild when the change is semantic rather
  // than structural.
  'live-cache',
  'live-vars',
  // TOTP — same reasoning. The raw rule text is unchanged across
  // window-flip ticks (`{{vault.X}}` doesn't mutate), but the
  // resolved value rotates every `period` seconds. Without the force
  // flag, the hash guard would skip every alarm-driven recompile and
  // DNR would keep firing the stale code from boot time.
  'totp',
  // Workspace-export import — even when imported rules land disabled,
  // the DNR ruleset still needs to refresh so the new (still-disabled)
  // rules are visible to the engine and can be enabled live without
  // a workspace switch.
  'import',
]);

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
  }, getSetting('rulesEngine.updateDebounceMs'));
}

function flushUpdate(reason: string, forced?: boolean): void {
  const rules = getRules();
  const currentHash = generateRulesHash(rules);

  if (currentHash === lastRulesHash && !forced) {
    logger.debug('RuleEngine', `Rule update skipped (${reason}) — hash unchanged`);
    return;
  }

  logger.debug('RuleEngine', `Updating network rules (${reason}), ${rules.length} rules`);
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
