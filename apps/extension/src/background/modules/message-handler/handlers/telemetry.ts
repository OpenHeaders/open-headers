/** Per-tab telemetry + active-rules RPCs. */

import { doesUrlMatchEntry, getRuleMatchPatterns } from '@openheaders/core/utils';
import { getRules } from '@openheaders/oracle/entity/rule-store';
import { getResolvedRules } from '@openheaders/oracle/rule-engine/variables-resolver';
import { logger } from '@utils/logger';
import type { PerfResourceEntry } from '@/types/perf';
import { getActiveRulesForTab, ingestPerfEntries } from '../../request-tracker';
import { getTabSnapshot, recordScriptableFire } from '../../tab-telemetry';
import type { HandlerMap } from '../types';

/** Resolve the URL-condition pattern a scriptable rule matched against. */
function findMatchingPattern(ruleUid: string, url: string): string | undefined {
  // Match against the resolved rule — raw `{{VAR}}` tokens in URL
  // conditions would never match a real request URL. Fall through to
  // the raw rule-store view if the resolver snapshot hasn't been
  // populated yet (pre-first-compile edge case).
  const resolved = getResolvedRules();
  const pool = resolved.length > 0 ? resolved : getRules();
  const rule = pool.find((r) => r.uid === ruleUid);
  if (!rule) return undefined;
  for (const entry of getRuleMatchPatterns(rule)) {
    if (doesUrlMatchEntry(url, entry)) return entry.pattern;
  }
  return undefined;
}

export const telemetryHandlers: HandlerMap = {
  getActiveRulesForTab: ({ message, respond }) => {
    const result = getActiveRulesForTab(message.tabId as number, message.tabUrl as string);
    respond({ activeRules: result.activeRules });
  },

  getTabTelemetry: ({ message, respond }) => {
    const tabId = message.tabId as number;
    respond(getTabSnapshot(tabId));
  },

  perfResourceEntries: ({ message, sender, respond, ctx }) => {
    const tabId = sender.tab?.id;
    const entries = (message.entries as PerfResourceEntry[] | undefined) ?? [];
    if (typeof tabId === 'number' && entries.length > 0) {
      const matched = ingestPerfEntries(tabId, entries);
      if (matched > 0) ctx.updateBadgeCallback();
    }
    respond({ success: true });
  },

  tabFire: ({ message, sender, respond }) => {
    const tabId = sender.tab?.id;
    if (typeof tabId === 'number') {
      const ruleUid = message.ruleUid as string;
      const url = message.url as string;
      const t = message.t as number;
      logger.info('TabFire', `tab ${tabId} scriptable ${ruleUid} ${url}`);
      const pattern = findMatchingPattern(ruleUid, url) ?? '*';
      recordScriptableFire(tabId, ruleUid, url, t, { pattern, resourceType: 'xmlhttprequest' });
    }
    respond({ success: true });
  },
};
