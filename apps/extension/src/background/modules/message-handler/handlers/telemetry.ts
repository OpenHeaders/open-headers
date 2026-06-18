/** Per-tab telemetry + active-rules RPCs. */

import type { InspectorRequestSnapshot, InspectorResponseSnapshot } from '@openheaders/core/request-lifecycle';
import type { PerfResourceEntry } from '@/types/perf';
import { overrideEventSource } from '../../../correlator-host/override-source';
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

  // Page-relayed two-sided response capture (a response rule's served / original
  // bytes). The injection wrapper holds both at the moment it acts and relays
  // them here; the heuristic correlator joins by `(url, method, start)` since
  // the page never knows the requestId. `sender.tab.id` is the request's tab.
  tabResponseOverride: ({ message, sender, respond }) => {
    const tabId = sender.tab?.id;
    if (typeof tabId === 'number') {
      const original = message.original as InspectorResponseSnapshot | undefined;
      overrideEventSource.push({
        tabId,
        url: message.url as string,
        method: (message.method as string) || 'GET',
        startedAtMs: message.startedAt as number,
        response: {
          ruleUid: message.ruleUid as string,
          served: message.served as InspectorResponseSnapshot,
          ...(original !== undefined ? { original } : {}),
        },
      });
    }
    respond({ success: true });
  },

  // Page-relayed two-sided request-body capture (sent / original). The
  // request-side twin of `tabResponseOverride`.
  tabRequestOverride: ({ message, sender, respond }) => {
    const tabId = sender.tab?.id;
    if (typeof tabId === 'number') {
      const original = message.original as InspectorRequestSnapshot | undefined;
      overrideEventSource.push({
        tabId,
        url: message.url as string,
        method: (message.method as string) || 'GET',
        startedAtMs: message.startedAt as number,
        request: {
          ruleUid: message.ruleUid as string,
          sent: message.sent as InspectorRequestSnapshot,
          ...(original !== undefined ? { original } : {}),
        },
      });
    }
    respond({ success: true });
  },
};
