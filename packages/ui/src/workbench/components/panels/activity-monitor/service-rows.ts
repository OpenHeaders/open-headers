/**
 * The RUNNING group's words (the activity monitor plan §8): a service
 * row's name and its line of facts. The host sends structured fields —
 * an address, counts, a time — and every word a person reads is put
 * together here from the catalogs.
 */

import {
  ACTIVITY_MONITOR_UNREADABLE,
  type ActivityMonitorPeer,
  type ActivityMonitorServiceKind,
  type ActivityMonitorServiceRow,
  formatTimeUntil,
} from '@openheaders/core/activity-monitor';
import type { StatusSubsystem } from '@openheaders/core/types';
import { BROWSER_DISPLAY_NAME } from '@openheaders/core/utils';
import type { MessageKey } from '@openheaders/i18n';
import type { Translate } from '@openheaders/ui/context/LocaleContext';

export const SERVICE_NAME_KEYS: Record<ActivityMonitorServiceKind, MessageKey> = {
  'sync-server': 'workbench.activityMonitor.service.syncServer',
  workflows: 'workbench.activityMonitor.service.workflows',
  git: 'workbench.activityMonitor.service.git',
  'mcp-server': 'workbench.activityMonitor.service.mcpServer',
  'proxy-capture': 'workbench.activityMonitor.service.proxyCapture',
};

/**
 * The status subsystem that already answers "is anything wrong" for a
 * service (the plan §6, law 4) — its dot wears that subsystem's colour.
 * A service with no subsystem of its own has no entry.
 */
export const SERVICE_STATUS_SUBSYSTEM: Partial<Record<ActivityMonitorServiceKind, StatusSubsystem>> = {
  'sync-server': 'sync',
  workflows: 'live',
};

const FACT_SEPARATOR = ' · ';

const listFormatters = new Map<string, Intl.ListFormat>();

function formatNames(names: string[], locale: string): string {
  let formatter = listFormatters.get(locale);
  if (formatter === undefined) {
    formatter = new Intl.ListFormat(locale, { style: 'short', type: 'unit' });
    listFormatters.set(locale, formatter);
  }
  return formatter.format(names);
}

/** A peer in the interface's words; a role the interface has no word for reads as the registry gave it. */
function peerName(peer: ActivityMonitorPeer, t: Translate): string {
  switch (peer.role) {
    case 'extension':
      return peer.browser === null || peer.browser === 'unknown'
        ? t('workbench.activityMonitor.peer.extensionUnknown')
        : t('workbench.activityMonitor.peer.extension', { browser: BROWSER_DISPLAY_NAME[peer.browser] });
    case 'cli':
      return t('shared.chrome.addons.cli');
    case 'desktop':
      return t('shared.chrome.addons.groupDesktopApp');
    case 'daemon':
      return t('shared.chrome.addons.server');
    case 'web':
      return t('shared.awareness.group.web');
    default:
      return peer.role;
  }
}

/** A service's line of facts. `now` is the host's clock at the answer the row came in. */
export function serviceFacts(row: ActivityMonitorServiceRow, now: number, t: Translate, locale: string): string {
  if (row.state === 'unreadable') return ACTIVITY_MONITOR_UNREADABLE;
  switch (row.kind) {
    case 'sync-server': {
      if (row.host === null || row.port === null) return ACTIVITY_MONITOR_UNREADABLE;
      const address = `${row.host}:${row.port}`;
      if (row.state === 'off') return t('workbench.activityMonitor.facts.notListening', { address });
      const peers =
        row.peers.length === 0
          ? t('workbench.activityMonitor.facts.peersNone')
          : t('workbench.activityMonitor.facts.peersConnected', {
              count: row.peers.length,
              names: formatNames(
                row.peers.map((peer) => peerName(peer, t)),
                locale,
              ),
            });
      return [address, peers].join(FACT_SEPARATOR);
    }
    case 'workflows': {
      if (row.state === 'off') return t('workbench.activityMonitor.facts.workflowsNone');
      const scheduled = t('workbench.activityMonitor.facts.workflowsScheduled', { count: row.scheduled });
      if (row.nextFireAt === null) return scheduled;
      const next = t('workbench.activityMonitor.facts.workflowsNext', {
        when: formatTimeUntil(row.nextFireAt, now, locale),
      });
      return [scheduled, next].join(FACT_SEPARATOR);
    }
    case 'git': {
      if (row.state === 'off') return t('workbench.activityMonitor.facts.gitNone');
      const bound = t('workbench.activityMonitor.facts.gitBound', { count: row.bound });
      const watching =
        row.watching === row.bound
          ? t('workbench.activityMonitor.facts.gitWatching')
          : t('workbench.activityMonitor.facts.gitWatchingCount', { count: row.watching });
      return [bound, watching].join(FACT_SEPARATOR);
    }
    case 'mcp-server':
      return t(row.state === 'on' ? 'workbench.activityMonitor.facts.on' : 'workbench.activityMonitor.facts.off');
    case 'proxy-capture': {
      if (row.state === 'off') return t('workbench.activityMonitor.facts.off');
      const on = t('workbench.activityMonitor.facts.on');
      return row.port === null
        ? on
        : [on, t('workbench.activityMonitor.facts.port', { port: row.port })].join(FACT_SEPARATOR);
    }
  }
}
