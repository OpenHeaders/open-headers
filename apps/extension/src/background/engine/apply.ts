/**
 * Rule-engine apply layer — pushes compiled DNR rules into Chrome.
 *
 * Owns the transactional shape of an apply (read existing → remove +
 * add) and the cache-bypass-preservation rule for the session layer.
 * Does NOT decide which rules to compile, when to apply, or how to
 * react to errors — that's the orchestrator's job.
 *
 * Today this calls `declarativeNetRequest` directly via the existing
 * `@utils/browser-api` wrapper. When the engine moves to its own
 * package, the `browserApi` becomes an injected dependency so the
 * package stays host-agnostic.
 */

import { declarativeNetRequest } from '@utils/browser-api';
import { logger } from '@utils/logger';
import { CACHE_BYPASS_ID_BASE } from '../modules/cache-bypass';
import type { DnrRule } from '../dnr-builders';

export type ApplyResult = { ok: true } | { ok: false; error: string };

export function applyDynamicRules(newRules: DnrRule[]): Promise<ApplyResult> {
  return declarativeNetRequest!
    .getDynamicRules()
    .then((existingRules) => {
      const removeRuleIds = existingRules.map((r) => r.id);
      return declarativeNetRequest!.updateDynamicRules({
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

export function applySessionRules(newRules: DnrRule[]): Promise<ApplyResult> {
  const dnr = declarativeNetRequest;
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

export function clearAllDynamicRules(): void {
  declarativeNetRequest!
    .getDynamicRules()
    .then((existingRules) => {
      const removeIds = existingRules.map((r) => r.id);
      return declarativeNetRequest!.updateDynamicRules({ removeRuleIds: removeIds, addRules: [] });
    })
    .then(() => {
      logger.debug('DnrEngine', 'All dynamic rules cleared');
    });
}

export function clearAllSessionRules(): void {
  const dnr = declarativeNetRequest;
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
