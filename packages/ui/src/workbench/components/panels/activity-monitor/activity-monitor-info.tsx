/**
 * `(i)` info-popover content for the activity monitor — the network
 * table's column-info idiom on the shared example card. Every popover
 * leads with the same example panel, one line per thing the panel
 * shows, and lights its own slice: a column its figure on the process
 * line, a group its lines. The card is worded by the panel's own
 * catalog keys and formatters, on the reading host's CPU convention,
 * so it reads as the panel beside it does. Under the card: a sentence
 * or two, never more — the panel explains itself here and on no hover.
 */

import {
  type ActivityMonitorServiceRow,
  type ActivityMonitorSnapshot,
  type ActivityMonitorSortColumn,
  cpuPercentConvention,
  formatCpuPercent,
  formatMemory,
  formatSpan,
  formatStartTime,
} from '@openheaders/core/activity-monitor';
import type { Translate } from '@openheaders/ui/context/LocaleContext';
import {
  EXAMPLE_CARD_POPOVER_WIDTH,
  ExampleCard,
  type ExampleCardLine,
  type InfoPopoverContent,
} from '@openheaders/ui/shared/info-popover';
import { FACT_SEPARATOR, SERVICE_NAME_KEYS, serviceFacts } from './service-rows';

/** What carries an `(i)`: the four figure columns and the three groups. */
export type ActivityMonitorInfoKey = ActivityMonitorSortColumn | 'overview' | 'processes' | 'running';

/** What of the reading host words the card and picks the copy. */
export type ActivityMonitorInfoHost = Pick<ActivityMonitorSnapshot, 'platform' | 'logicalCores' | 'memoryKind'>;

type TokenId =
  | 'overview.cpu'
  | 'overview.memory'
  | 'overview.count'
  | 'overview.uptime'
  | 'process.name'
  | 'process.cpu'
  | 'process.memory'
  | 'process.started'
  | 'process.pid'
  | 'beneath.name'
  | 'beneath.cpu'
  | 'beneath.memory'
  | 'ended.name'
  | 'ended.at'
  | 'ended.peak'
  | 'running.name'
  | 'running.facts';

const MB = 1024 * 1024;

const SYNC_SERVER: ActivityMonitorServiceRow = {
  kind: 'sync-server',
  state: 'on',
  host: '127.0.0.1',
  port: 8137,
  peers: [],
};

/**
 * The one afternoon every popover illustrates: the app up seven
 * minutes, a terminal holding most of a core through the program it
 * runs, another terminal closed a few minutes ago. Clock times are
 * local, so the card reads the same in every time zone.
 */
const EX = {
  now: new Date(2026, 0, 15, 17, 0).getTime(),
  uptimeMs: 7 * 60_000,
  processCount: 8,
  totalCpuRate: 0.423,
  totalMemoryBytes: 3.28 * 1024 * MB,
  cpuRate: 0.402,
  memoryBytes: 218 * MB,
  startedAt: new Date(2026, 0, 15, 16, 52).getTime(),
  pid: 61_044,
  beneathName: 'node',
  beneathMemoryBytes: 164 * MB,
  endedAt: new Date(2026, 0, 15, 16, 54).getTime(),
  peakRate: 0.788,
} as const;

/** Which tokens of the example each `(i)` lights. */
const LIT: Record<ActivityMonitorInfoKey, readonly TokenId[]> = {
  cpu: ['process.cpu', 'beneath.cpu'],
  memory: ['process.memory', 'beneath.memory'],
  started: ['process.started'],
  pid: ['process.pid'],
  overview: ['overview.cpu', 'overview.memory', 'overview.count', 'overview.uptime'],
  processes: [
    'process.name',
    'process.cpu',
    'process.memory',
    'process.started',
    'process.pid',
    'beneath.name',
    'beneath.cpu',
    'beneath.memory',
    'ended.name',
    'ended.at',
    'ended.peak',
  ],
  running: ['running.name', 'running.facts'],
};

function exampleLines(t: Translate, locale: string, host: ActivityMonitorInfoHost): ExampleCardLine<TokenId>[] {
  const cpu = (rate: number): string => formatCpuPercent(rate, host.platform, host.logicalCores);
  const clock = (at: number): string => formatStartTime(at, EX.now, locale);
  const terminal = t('workbench.toolWindows.terminal');
  return [
    {
      opener: t('workbench.activityMonitor.group.overview'),
      tokens: [
        { id: 'overview.cpu', text: `${t('workbench.activityMonitor.column.cpu')} ${cpu(EX.totalCpuRate)}` },
        {
          id: 'overview.memory',
          text: `${t('workbench.activityMonitor.column.memory')} ${formatMemory(EX.totalMemoryBytes)}`,
        },
        {
          id: 'overview.count',
          text: t('workbench.activityMonitor.summary.processCount', { count: EX.processCount }),
        },
        {
          id: 'overview.uptime',
          text: t('workbench.activityMonitor.summary.uptime', { duration: formatSpan(EX.uptimeMs, locale) }),
        },
      ],
    },
    {
      opener: t('workbench.activityMonitor.group.processes'),
      tokens: [
        { id: 'process.name', text: [terminal, t('workbench.terminal.tabLocal')].join(FACT_SEPARATOR) },
        { id: 'process.cpu', text: cpu(EX.cpuRate) },
        { id: 'process.memory', text: formatMemory(EX.memoryBytes) },
        { id: 'process.started', text: clock(EX.startedAt) },
        { id: 'process.pid', text: String(EX.pid) },
      ],
    },
    {
      opener: '↳',
      tokens: [
        { id: 'beneath.name', text: EX.beneathName },
        { id: 'beneath.cpu', text: cpu(EX.cpuRate) },
        { id: 'beneath.memory', text: formatMemory(EX.beneathMemoryBytes) },
      ],
    },
    {
      opener: t('workbench.activityMonitor.process.ended', { count: 1 }),
      tokens: [
        { id: 'ended.name', text: terminal },
        { id: 'ended.at', text: t('workbench.activityMonitor.ended', { time: clock(EX.endedAt) }) },
        { id: 'ended.peak', text: t('workbench.activityMonitor.peak', { percent: cpu(EX.peakRate) }) },
      ],
    },
    {
      opener: t('workbench.activityMonitor.group.running'),
      tokens: [
        { id: 'running.name', text: t(SERVICE_NAME_KEYS[SYNC_SERVER.kind]) },
        { id: 'running.facts', text: serviceFacts(SYNC_SERVER, EX.now, t, locale) },
      ],
    },
  ];
}

/** Every `(i)` of the panel, for one host: the same card, each with its own slice lit. */
export function activityMonitorInfo(
  t: Translate,
  locale: string,
  host: ActivityMonitorInfoHost,
): Record<ActivityMonitorInfoKey, InfoPopoverContent> {
  const lines = exampleLines(t, locale, host);
  const caption = t('workbench.activityMonitor.info.exampleCaption');
  const card = (key: ActivityMonitorInfoKey) => ({
    kicker: t('workbench.toolWindows.activityMonitor'),
    diagram: <ExampleCard caption={caption} lines={lines} lit={new Set(LIT[key])} />,
    maxWidth: EXAMPLE_CARD_POPOVER_WIDTH,
  });
  const perCore = cpuPercentConvention(host.platform) === 'per-core';
  const footprint = host.memoryKind === 'footprint';
  const ownerTotal = t('workbench.activityMonitor.info.ownerTotal');
  return {
    cpu: {
      ...card('cpu'),
      title: t('workbench.activityMonitor.column.cpu'),
      summary: t(
        perCore ? 'workbench.activityMonitor.info.cpuPerCore' : 'workbench.activityMonitor.info.cpuMachineShare',
      ),
      description: ownerTotal,
    },
    memory: {
      ...card('memory'),
      title: t('workbench.activityMonitor.column.memory'),
      summary: t(
        footprint ? 'workbench.activityMonitor.info.memoryFootprint' : 'workbench.activityMonitor.info.memory',
      ),
      description: ownerTotal,
    },
    started: {
      ...card('started'),
      title: t('workbench.activityMonitor.column.started'),
      summary: t('workbench.activityMonitor.info.started'),
    },
    pid: {
      ...card('pid'),
      title: t('workbench.activityMonitor.column.pid'),
      summary: t('workbench.activityMonitor.info.pid'),
    },
    overview: {
      ...card('overview'),
      title: t('workbench.activityMonitor.group.overview'),
      summary: t('workbench.activityMonitor.info.overview'),
      description: (
        <>
          <p>
            {t(
              perCore
                ? 'workbench.activityMonitor.info.scalePerCore'
                : 'workbench.activityMonitor.info.scaleMachineShare',
            )}
          </p>
          {!footprint && <p>{t('workbench.activityMonitor.info.memoryUpperBound')}</p>}
        </>
      ),
    },
    processes: {
      ...card('processes'),
      title: t('workbench.activityMonitor.group.processes'),
      summary: t('workbench.activityMonitor.info.processes'),
      description: (
        <>
          <p>{ownerTotal}</p>
          <p>{t('workbench.activityMonitor.info.ended')}</p>
        </>
      ),
    },
    running: {
      ...card('running'),
      title: t('workbench.activityMonitor.group.running'),
      summary: t('workbench.activityMonitor.info.running'),
      description: t('workbench.activityMonitor.info.runningDetail'),
    },
  };
}
