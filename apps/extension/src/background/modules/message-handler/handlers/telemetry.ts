/** Per-tab telemetry + active-rules RPCs. */

import type { PerfResourceEntry } from '@/types/perf';
import { getActiveRulesForTab, ingestPerfEntries } from '../../request-tracker';
import { getTabSnapshot, recordReportedFire } from '../../tab-telemetry';
import type { HandlerMap } from '../types';

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
      recordReportedFire(tabId, message.ruleUid as string, message.url as string, message.t as number);
    }
    respond({ success: true });
  },
};
