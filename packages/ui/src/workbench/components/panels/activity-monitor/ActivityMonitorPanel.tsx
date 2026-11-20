/**
 * ActivityMonitorPanel — the workbench Activity Monitor tool-window
 * body (the activity monitor plan §8): three groups that fold, each
 * under the shell's own section head — Overview, the totals on one
 * row; Processes, the app's own processes named in the interface's
 * words, with what each costs and its history; Running, what the engine
 * keeps going, as facts. The host owns every read; this panel asks while it
 * is looked at and formats the answer. Values change in place on the
 * two-second beat and what could not be read reads as a dash. No row
 * moves under the pointer (the plan §6, law 10): a sort is applied on
 * the click and again when a history beat arrives, never while the
 * pointer is over the table.
 */

import { CaretRightOutlined } from '@ant-design/icons';
import {
  ACTIVITY_MONITOR_UNREADABLE,
  type ActivityMonitorProcessKind,
  type ActivityMonitorProcessRow,
  type ActivityMonitorServiceKind,
  type ActivityMonitorServiceState,
  type ActivityMonitorSnapshot,
  type ActivityMonitorSort,
  type ActivityMonitorSortColumn,
  arrangeProcessRows,
  compareProcessOrder,
  countProcesses,
  cpuPercentConvention,
  cpuScaleTop,
  formatCpuPercent,
  formatMemory,
  formatSpan,
  formatStartTime,
  holdProcessOrder,
  nextProcessSort,
  sortedProcessIds,
  sumReadable,
} from '@openheaders/core/activity-monitor';
import type { StatusLevel } from '@openheaders/core/types';
import type { MessageKey } from '@openheaders/i18n';
import { Tooltip } from 'antd';
import type React from 'react';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { type Translate, useLocale } from '@openheaders/ui/context/LocaleContext';
import { createPanelHeaderWiring, PanelHeader } from '@openheaders/ui/shared/dock-layout';
import { useStatus } from '@openheaders/ui/shared/hooks/useStatus';
import type { InfoPopoverContent } from '@openheaders/ui/shared/info-popover';
import { buildHistoryGraphs, type HistoryGraphs, ROW_GRAPH, SUMMARY_GRAPH } from './history-graphs';
import { SERVICE_REVEAL_TARGETS } from './service-reveal';
import { FACT_SEPARATOR, SERVICE_NAME_KEYS, SERVICE_STATUS_SUBSYSTEM, serviceFacts } from './service-rows';
import { SectionHeader } from '../../sidebar/SectionHeader';
import { useActivityMonitorSnapshot } from './use-activity-monitor-snapshot';
import './activity-monitor.css';

interface ActivityMonitorPanelProps {
  /** Title-bar `(i)` popover copy. */
  info: InfoPopoverContent;
  /**
   * Whether this window is its dock's active tab. The keep-alive body
   * stack keeps the panel mounted across tab switches and close/reopen,
   * so "someone is looking" is this flag, never the mount — the pull
   * keys on it.
   */
  active: boolean;
  onHide: () => void;
  /** Front the surface that owns a service (the plan §7, fork 6) — nothing is confirmed and nothing ends. */
  onRevealService: (kind: ActivityMonitorServiceKind) => void;
  /**
   * The label of the tab that holds a terminal session (the plan §6,
   * law 12: a terminal's row carries its tab's label); null where no
   * tab of this document holds it.
   */
  terminalLabel: (sessionId: string) => string | null;
}

const PROCESS_NAME_KEYS: Record<Exclude<ActivityMonitorProcessKind, 'other'>, MessageKey> = {
  window: 'workbench.activityMonitor.process.window',
  engine: 'workbench.activityMonitor.process.engine',
  graphics: 'workbench.activityMonitor.process.graphics',
  network: 'workbench.activityMonitor.process.network',
  'script-sandbox': 'workbench.activityMonitor.process.scriptSandbox',
  'script-runtime': 'workbench.activityMonitor.process.scriptRuntime',
  terminal: 'workbench.toolWindows.terminal',
  git: 'workbench.activityMonitor.service.git',
  'http3-helper': 'workbench.activityMonitor.process.http3Helper',
};

function processName(
  row: Pick<ActivityMonitorProcessRow, 'kind' | 'runtimeName' | 'terminalSessionId'>,
  t: Translate,
  terminalLabel: (sessionId: string) => string | null,
): string {
  if (row.kind === 'other') return row.runtimeName ?? '';
  const name = t(PROCESS_NAME_KEYS[row.kind]);
  const label = row.terminalSessionId === undefined ? null : terminalLabel(row.terminalSessionId);
  return label === null ? name : [name, label].join(FACT_SEPARATOR);
}

/** One graph is one path (the plan §6, law 11); it redraws only when its path changes — once a beat. */
const Sparkline = memo(function Sparkline({ path, width, height }: { path: string; width: number; height: number }) {
  return (
    <svg className="oh-am-spark" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <path d={path} />
    </svg>
  );
});

interface ProcessRowProps {
  name: string;
  cpu: string;
  /** The row's last hour of CPU, as a path; empty before its first beat. */
  graph: string;
  memory: string;
  started: string;
  pid: number;
  child?: boolean;
}

const ProcessRow = memo(function ProcessRow({
  name,
  cpu,
  graph,
  memory,
  started,
  pid,
  child = false,
}: ProcessRowProps) {
  return (
    <div className={child ? 'oh-am-row oh-am-row--child' : 'oh-am-row'} role="row" data-testid="activity-monitor-row">
      <span className="oh-am-name" role="cell">
        {name}
      </span>
      <span className="oh-am-num" role="cell">
        {cpu}
      </span>
      <Sparkline path={graph} width={ROW_GRAPH.width} height={ROW_GRAPH.height} />
      <span className="oh-am-num" role="cell">
        {memory}
      </span>
      <span className="oh-am-started" role="cell">
        {started}
      </span>
      <span className="oh-am-pid" role="cell">
        {pid}
      </span>
    </div>
  );
});

interface ServiceRowProps {
  kind: ActivityMonitorServiceKind;
  name: string;
  facts: string;
  state: ActivityMonitorServiceState;
  /** The owning status subsystem's level; undefined where the service has none or it has not reported. */
  level: StatusLevel | undefined;
  revealLabel: string;
  onReveal: (kind: ActivityMonitorServiceKind) => void;
}

const ServiceRow = memo(function ServiceRow({ kind, name, facts, state, level, revealLabel, onReveal }: ServiceRowProps) {
  const on = state === 'on';
  return (
    <div
      className={on ? 'oh-am-service' : 'oh-am-service oh-am-service--idle'}
      role="row"
      data-testid="activity-monitor-service"
      data-service={kind}
    >
      <span className="oh-am-dot" data-level={on ? (level ?? 'green') : undefined} aria-hidden />
      <span className="oh-am-service-name" role="cell">
        {name}
      </span>
      <span className="oh-am-facts" role="cell">
        {facts}
      </span>
      <Tooltip title={revealLabel} placement="left">
        <button type="button" className="oh-am-reveal" aria-label={revealLabel} onClick={() => onReveal(kind)}>
          <span aria-hidden>↗</span>
        </button>
      </Tooltip>
    </div>
  );
});

/** A process that ended inside the hour: its name, a dash for CPU, the hour it left behind, when it ended. */
const EndedRow = memo(function EndedRow({ name, graph, note }: { name: string; graph: string; note: string }) {
  return (
    <div className="oh-am-row oh-am-row--ended" role="row" data-testid="activity-monitor-ended">
      <span className="oh-am-name" role="cell">
        {name}
      </span>
      <span className="oh-am-num" role="cell">
        {ACTIVITY_MONITOR_UNREADABLE}
      </span>
      <Sparkline path={graph} width={ROW_GRAPH.width} height={ROW_GRAPH.height} />
      <span className="oh-am-ended-note" role="cell">
        {note}
      </span>
    </div>
  );
});

interface SortHeadProps {
  column: ActivityMonitorSortColumn;
  label: string;
  hover?: string;
  sort: ActivityMonitorSort | null;
  onSort: (column: ActivityMonitorSortColumn) => void;
}

const SortHead: React.FC<SortHeadProps> = ({ column, label, hover, sort, onSort }) => {
  const direction = sort?.column === column ? sort.direction : null;
  return (
    <Tooltip title={hover} placement="top">
      <span
        className="oh-am-col"
        role="columnheader"
        aria-sort={direction === null ? undefined : direction === 'asc' ? 'ascending' : 'descending'}
      >
        <button type="button" className="oh-am-sort" onClick={() => onSort(column)}>
          {label}
          {direction !== null && <span aria-hidden>{direction === 'asc' ? ' ▴' : ' ▾'}</span>}
        </button>
      </span>
    </Tooltip>
  );
};

/** The Overview group's one row: every process added up, how many there are, how long the app has run. */
const Summary: React.FC<{ snapshot: ActivityMonitorSnapshot; graphs: HistoryGraphs }> = ({ snapshot, graphs }) => {
  const { t, locale } = useLocale();
  const engine = snapshot.processes.find((row) => row.kind === 'engine');
  const count = t('workbench.activityMonitor.summary.processCount', { count: countProcesses(snapshot.processes) });
  return (
    <div className="oh-am-summary" data-testid="activity-monitor-summary">
      <Tooltip title={t('workbench.activityMonitor.summary.cpuHover')} placement="bottom">
        <span className="oh-am-stat">
          {t('workbench.activityMonitor.column.cpu')}
          <strong>
            {formatCpuPercent(
              sumReadable(snapshot.processes.map((row) => row.cpuRate)),
              snapshot.platform,
              snapshot.logicalCores,
            )}
          </strong>
          <Sparkline path={graphs.cpuTotal} width={SUMMARY_GRAPH.width} height={SUMMARY_GRAPH.height} />
        </span>
      </Tooltip>
      <Tooltip
        title={t(
          snapshot.memoryKind === 'footprint'
            ? 'workbench.activityMonitor.summary.memoryHoverFootprint'
            : 'workbench.activityMonitor.summary.memoryHover',
        )}
        placement="bottom"
      >
        <span className="oh-am-stat">
          {t('workbench.activityMonitor.column.memory')}
          <strong>{formatMemory(sumReadable(snapshot.processes.map((row) => row.memoryBytes)))}</strong>
          <Sparkline path={graphs.memoryTotal} width={SUMMARY_GRAPH.width} height={SUMMARY_GRAPH.height} />
        </span>
      </Tooltip>
      <span className="oh-am-count">
        {engine === undefined
          ? count
          : [
              count,
              t('workbench.activityMonitor.summary.uptime', {
                duration: formatSpan(snapshot.sampledAt - engine.startedAt, locale),
              }),
            ].join(FACT_SEPARATOR)}
      </span>
    </div>
  );
};

/** A group's head, pinned over its own rows while they scroll under it. */
const GroupHead: React.FC<{
  title: string;
  open: boolean;
  onToggle: () => void;
  actions?: React.ReactNode;
  testid: string;
}> = ({ title, open, onToggle, actions, testid }) => (
  <div className="oh-am-group-head">
    <SectionHeader title={title} expanded={open} onToggle={onToggle} actions={actions} testid={testid} />
  </div>
);

const ActivityMonitorPanel: React.FC<ActivityMonitorPanelProps> = ({
  info,
  active,
  onHide,
  onRevealService,
  terminalLabel,
}) => {
  const { t, locale } = useLocale();
  const wiring = useMemo(() => createPanelHeaderWiring({ onHide }), [onHide]);
  const { snapshot, unreadable, history } = useActivityMonitorSnapshot(active);
  const { snapshot: status } = useStatus();
  const [overviewOpen, setOverviewOpen] = useState(true);
  const [processesOpen, setProcessesOpen] = useState(true);
  const [runningOpen, setRunningOpen] = useState(true);
  const [otherOpen, setOtherOpen] = useState(false);
  const [sort, setSort] = useState<ActivityMonitorSort | null>(null);
  /** The order the sort gave when it was last applied; rows hold it until the next application. */
  const [heldOrder, setHeldOrder] = useState<readonly string[] | null>(null);
  const pointerOverTable = useRef(false);

  const cpuTop = snapshot === null ? 1 : cpuScaleTop(snapshot.platform, snapshot.logicalCores);
  const graphs = useMemo(() => buildHistoryGraphs(history, cpuTop), [history, cpuTop]);

  const arranged = useMemo(() => {
    if (snapshot === null) return null;
    const fixed = arrangeProcessRows(snapshot.processes);
    return heldOrder === null
      ? fixed
      : { named: holdProcessOrder(fixed.named, heldOrder), other: holdProcessOrder(fixed.other, heldOrder) };
  }, [snapshot, heldOrder]);
  const ended = useMemo(() => (snapshot === null ? [] : [...snapshot.ended].sort(compareProcessOrder)), [snapshot]);

  const onSort = (column: ActivityMonitorSortColumn): void => {
    const next = nextProcessSort(sort, column);
    setSort(next);
    setHeldOrder(next === null || snapshot === null ? null : sortedProcessIds(snapshot.processes, next));
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: `history` is the slow beat — its identity changes when a beat arrives, and only at that edge is the sort applied again, over the figures of the same answer
  useEffect(() => {
    if (sort === null || snapshot === null || pointerOverTable.current) return;
    setHeldOrder(sortedProcessIds(snapshot.processes, sort));
  }, [history]);

  const renderRow = (
    row: ActivityMonitorProcessRow,
    answer: ActivityMonitorSnapshot,
    child: boolean,
  ): React.ReactNode => (
    <ProcessRow
      key={row.id}
      name={processName(row, t, terminalLabel)}
      cpu={formatCpuPercent(row.cpuRate, answer.platform, answer.logicalCores)}
      graph={graphs.processes.get(row.id)?.path ?? ''}
      memory={formatMemory(row.memoryBytes)}
      started={formatStartTime(row.startedAt, answer.sampledAt, locale)}
      pid={row.pid}
      child={child}
    />
  );

  const overviewGroup = snapshot !== null && (
    <div className="oh-am-group">
      <GroupHead
        title={t('workbench.activityMonitor.group.overview')}
        open={overviewOpen}
        onToggle={() => setOverviewOpen((open) => !open)}
        testid="activity-monitor-group-overview"
        actions={
          graphs.spanMs > 0 && (
            <Tooltip
              title={t(
                cpuPercentConvention(snapshot.platform) === 'per-core'
                  ? 'workbench.activityMonitor.summary.scalePerCore'
                  : 'workbench.activityMonitor.summary.scaleMachineShare',
              )}
              placement="bottomRight"
            >
              <span className="oh-am-range">
                {t('workbench.activityMonitor.summary.range', { duration: formatSpan(graphs.spanMs, locale) })}
              </span>
            </Tooltip>
          )
        }
      />
      {overviewOpen && <Summary snapshot={snapshot} graphs={graphs} />}
    </div>
  );

  const processesGroup = (
    <div className="oh-am-group">
      <GroupHead
        title={t('workbench.activityMonitor.group.processes')}
        open={processesOpen}
        onToggle={() => setProcessesOpen((open) => !open)}
        testid="activity-monitor-group-processes"
        actions={
          processesOpen && (
            <div className="oh-am-cols" role="row">
              <SortHead
                column="cpu"
                label={t('workbench.activityMonitor.column.cpu')}
                hover={
                  snapshot === null
                    ? undefined
                    : t(
                        cpuPercentConvention(snapshot.platform) === 'per-core'
                          ? 'workbench.activityMonitor.column.cpuHoverPerCore'
                          : 'workbench.activityMonitor.column.cpuHoverMachineShare',
                      )
                }
                sort={sort}
                onSort={onSort}
              />
              <span aria-hidden />
              <SortHead
                column="memory"
                label={t('workbench.activityMonitor.column.memory')}
                hover={
                  snapshot === null
                    ? undefined
                    : t(
                        snapshot.memoryKind === 'footprint'
                          ? 'workbench.activityMonitor.column.memoryHoverFootprint'
                          : 'workbench.activityMonitor.column.memoryHover',
                      )
                }
                sort={sort}
                onSort={onSort}
              />
              <SortHead
                column="started"
                label={t('workbench.activityMonitor.column.started')}
                sort={sort}
                onSort={onSort}
              />
              <SortHead
                column="pid"
                label={t('workbench.activityMonitor.column.pid')}
                hover={t('workbench.activityMonitor.column.pidHover')}
                sort={sort}
                onSort={onSort}
              />
            </div>
          )
        }
      />
      {processesOpen && unreadable && <div className="oh-am-note">{t('workbench.activityMonitor.unreadable')}</div>}
      {processesOpen && snapshot !== null && arranged !== null && (
        <>
          {arranged.named.map((row) => renderRow(row, snapshot, false))}
          {arranged.other.length > 0 && (
            <div className="oh-am-row" role="row" data-testid="activity-monitor-other">
              <button
                type="button"
                className="oh-am-name oh-am-toggle"
                aria-expanded={otherOpen}
                onClick={() => setOtherOpen((open) => !open)}
              >
                <CaretRightOutlined aria-hidden className={otherOpen ? 'oh-am-caret oh-am-caret--open' : 'oh-am-caret'} />
                <span>{t('workbench.activityMonitor.process.other', { count: arranged.other.length })}</span>
              </button>
              <span className="oh-am-num" role="cell">
                {formatCpuPercent(
                  sumReadable(arranged.other.map((row) => row.cpuRate)),
                  snapshot.platform,
                  snapshot.logicalCores,
                )}
              </span>
              <span aria-hidden />
              <span className="oh-am-num" role="cell">
                {formatMemory(sumReadable(arranged.other.map((row) => row.memoryBytes)))}
              </span>
            </div>
          )}
          {otherOpen && arranged.other.map((row) => renderRow(row, snapshot, true))}
          {ended.map((process) => {
            const graph = graphs.processes.get(process.id);
            const endedAt = t('workbench.activityMonitor.ended', {
              time: formatStartTime(process.endedAt, snapshot.sampledAt, locale),
            });
            return (
              <EndedRow
                key={process.id}
                name={processName(process, t, terminalLabel)}
                graph={graph?.path ?? ''}
                note={
                  graph === undefined || graph.peak === null
                    ? endedAt
                    : [
                        endedAt,
                        t('workbench.activityMonitor.peak', {
                          percent: formatCpuPercent(graph.peak, snapshot.platform, snapshot.logicalCores),
                        }),
                      ].join(FACT_SEPARATOR)
                }
              />
            );
          })}
        </>
      )}
    </div>
  );

  const runningGroup = snapshot !== null && snapshot.services.length > 0 && (
    <div className="oh-am-group">
      <GroupHead
        title={t('workbench.activityMonitor.group.running')}
        open={runningOpen}
        onToggle={() => setRunningOpen((open) => !open)}
        testid="activity-monitor-group-running"
      />
      {runningOpen &&
        snapshot.services.map((service) => {
          const subsystem = SERVICE_STATUS_SUBSYSTEM[service.kind];
          return (
            <ServiceRow
              key={service.kind}
              kind={service.kind}
              name={t(SERVICE_NAME_KEYS[service.kind])}
              facts={serviceFacts(service, snapshot.sampledAt, t, locale)}
              state={service.state}
              level={subsystem === undefined ? undefined : status[subsystem]?.state}
              revealLabel={t('workbench.activityMonitor.reveal', {
                target: t(SERVICE_REVEAL_TARGETS[service.kind].labelKey),
              })}
              onReveal={onRevealService}
            />
          );
        })}
    </div>
  );

  return (
    <div className="rules-bottom-panel" data-testid="activity-monitor-panel">
      <PanelHeader wiring={wiring} title={<strong>{t('workbench.toolWindows.activityMonitor')}</strong>} info={info} />
      {/* biome-ignore lint/a11y/noStaticElementInteractions: the pointer is only watched — a sort is held while it is over the table */}
      <div
        className="oh-am-body"
        role="table"
        aria-label={t('workbench.toolWindows.activityMonitor')}
        onMouseEnter={() => {
          pointerOverTable.current = true;
        }}
        onMouseLeave={() => {
          pointerOverTable.current = false;
        }}
      >
        <div className="oh-am-groups">
          {overviewGroup}
          {processesGroup}
          {runningGroup}
        </div>
      </div>
    </div>
  );
};

export default ActivityMonitorPanel;
