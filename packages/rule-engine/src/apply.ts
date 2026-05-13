/**
 * Rule-engine apply layer — pushes compiled DNR rules into Chrome.
 *
 * Owns the transactional shape of an apply (read existing → remove +
 * add) and the cache-bypass-preservation rule for the session layer.
 * Does NOT decide which rules to compile, when to apply, or how to
 * react to errors — that's the orchestrator's job.
 *
 * The `DnrClient` parameter is the engine's only handle on the host's
 * declarativeNetRequest API. The host (extension SW) wraps Chrome's
 * promise/callback split and passes the wrapper in. `null` means the
 * host has no DNR access — applies degrade to logged no-ops.
 */

import { logger } from '@openheaders/core/utils';
import type { DnrRule } from './builders';
import { CACHE_BYPASS_ID_BASE } from './reserved-ids';

/**
 * The subset of `chrome.declarativeNetRequest` the engine actually uses.
 * Session-rule methods are optional — Firefox doesn't expose them, and
 * the engine treats their absence as "session layer disabled" rather
 * than an error.
 */
export interface DnrClient {
  getDynamicRules(): Promise<chrome.declarativeNetRequest.Rule[]>;
  updateDynamicRules(options: chrome.declarativeNetRequest.UpdateRuleOptions): Promise<void>;
  getSessionRules?(): Promise<chrome.declarativeNetRequest.Rule[]>;
  updateSessionRules?(options: chrome.declarativeNetRequest.UpdateRuleOptions): Promise<void>;
}

export type ApplyResult = { ok: true } | { ok: false; error: string };

export function applyDynamicRules(dnr: DnrClient | null, newRules: DnrRule[]): Promise<ApplyResult> {
  if (!dnr) {
    return Promise.resolve({ ok: false, error: 'declarativeNetRequest API unavailable' });
  }
  return dnr
    .getDynamicRules()
    .then((existingRules) => {
      const removeRuleIds = existingRules.map((r) => r.id);
      return dnr.updateDynamicRules({
        removeRuleIds,
        addRules: newRules as chrome.declarativeNetRequest.Rule[],
      });
    })
    .then((): ApplyResult => {
      logger.debug('DnrEngine', `Applied ${newRules.length} dynamic DNR rules`);
      return { ok: true };
    })
    .catch((e: Error): ApplyResult => {
      const error = e.message || 'Unknown error';
      logger.error('DnrEngine', 'Error updating dynamic rules:', error);
      return { ok: false, error };
    });
}

export function applySessionRules(dnr: DnrClient | null, newRules: DnrRule[]): Promise<ApplyResult> {
  if (!dnr?.updateSessionRules || !dnr.getSessionRules) {
    if (newRules.length > 0) {
      logger.info('DnrEngine', 'updateSessionRules unavailable — session rules will not be applied');
    }
    // Absent API is not a failure — treat as no-op success so the
    // Status pill doesn't show red on Firefox's session-rule-less
    // codepath. Users on browsers without session rules never expect
    // delay-tab scoping to work anyway.
    return Promise.resolve({ ok: true });
  }
  return dnr
    .getSessionRules()
    .then((existing) => {
      // Preserve cache-bypass session rules (installed by the inspector
      // panel's "Disable Cache" toggle) — they have their own lifecycle
      // and shouldn't be nuked by a user-rule rebuild. See
      // `modules/cache-bypass.ts`.
      const removeRuleIds = existing.filter((r) => r.id < CACHE_BYPASS_ID_BASE).map((r) => r.id);
      return dnr.updateSessionRules!({
        removeRuleIds,
        addRules: newRules as chrome.declarativeNetRequest.Rule[],
      });
    })
    .then((): ApplyResult => {
      logger.debug('DnrEngine', `Applied ${newRules.length} session DNR rules`);
      return { ok: true };
    })
    .catch((e: Error): ApplyResult => {
      const error = e.message || 'Unknown error';
      logger.error('DnrEngine', 'Error updating session rules:', error);
      return { ok: false, error };
    });
}

export function clearAllDynamicRules(dnr: DnrClient | null): void {
  if (!dnr) return;
  dnr
    .getDynamicRules()
    .then((existingRules) => {
      const removeIds = existingRules.map((r) => r.id);
      return dnr.updateDynamicRules({ removeRuleIds: removeIds, addRules: [] });
    })
    .then(() => {
      logger.debug('DnrEngine', 'All dynamic rules cleared');
    });
}

export function clearAllSessionRules(dnr: DnrClient | null): void {
  if (!dnr?.updateSessionRules || !dnr.getSessionRules) return;
  dnr
    .getSessionRules()
    .then((existing) => {
      const removeIds = existing.map((r) => r.id);
      return dnr.updateSessionRules!({ removeRuleIds: removeIds, addRules: [] });
    })
    .then(() => {
      logger.debug('DnrEngine', 'All session rules cleared');
    });
}
