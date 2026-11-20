/**
 * ActivityMonitorPanel — the workbench Activity Monitor tool-window
 * body (the activity monitor plan §8): three groups that fold, each
 * under the shell's own section head — Overview, the totals on one
 * row; Processes, the app's own processes named in the interface's
 * words, with what each costs and its history; Running, what the engine
 * keeps going, as facts. An owner's row — a terminal, the git reader,
 * the helper — carries its total, opens to what runs beneath it (live
 * figures, the program's name alone), and a terminal's leads to its
 * tab. What ended inside the hour sits under one folded line at the
 * foot of Processes, off the live rows. Nothing explains itself on
 * hover: each figure column and each group carries an `(i)` whose
 * popover lights its slice of one shared example. The host owns every
 * read; this panel asks while it is looked at and formats the answer.
 * Values change in place on the two-second beat and what could not be
 * read reads as a dash. No row moves under the pointer (the plan §6,
 * law 10): a sort is applied on the click and again when a history
 * beat arrives, never while the pointer is over the table.
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
import { Fragment, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type Translate, useLocale } from '@openheaders/ui/context/LocaleContext';
import { createPanelHeaderWiring, PanelHeader } from '@openheaders/ui/shared/dock-layout';
import { useStatus } from '@openheaders/ui/shared/hooks/useStatus';
import { type InfoPopoverContent, InfoTrigger } from '@openheaders/ui/shared/info-popover';
import { activityMonitorInfo } from './activity-monitor-info';
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
  /** Front the tab that holds a terminal session (the plan §7, fork 6) — nothing is confirmed and nothing ends. */
  onRevealTerminal: (sessionId: string) => void;
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
  /** The row's last hour of CPU, as a path; empty before its first beat. null where the row has no history — a process beneath an owner. */
  graph: string | null;
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
      {graph === null ? (
        <span aria-hidden />
      ) : (
        <Sparkline path={graph} width={ROW_GRAPH.width} height={ROW_GRAPH.height} />
      )}
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

/** A row's name as the fold of what sits beneath it. */
const FoldName: React.FC<{ label: string; open: boolean; onToggle: () => void }> = ({ label, open, onToggle }) => (
  <button type="button" className="oh-am-name oh-am-toggle" aria-expanded={open} onClick={onToggle}>
    <CaretRightOutlined aria-hidden className={open ? 'oh-am-caret oh-am-caret--open' : 'oh-am-caret'} />
    <span>{label}</span>
  </button>
);

interface OwnerRowProps {
  id: string;
  name: string;
  cpu: string;
  graph: string;
  memory: string;
  started: string;
  pid: number;
  /** Whether what runs beneath the owner is shown; null where nothing does. */
  open: boolean | null;
  onToggle: (id: string) => void;
  /** The terminal session whose tab the arrow fronts; null where the row has no tab of this document to lead to. */
  revealSessionId: string | null;
  revealLabel: string;
  onReveal: (sessionId: string) => void;
}

/** An owner of processes the host started itself: one row for it and everything beneath it. */
const OwnerRow = memo(function OwnerRow({
  id,
  name,
  cpu,
  graph,
  memory,
  started,
  pid,
  open,
  onToggle,
  revealSessionId,
  revealLabel,
  onReveal,
}: OwnerRowProps) {
  return (
    <div className="oh-am-row" role="row" data-testid="activity-monitor-row">
      {open === null ? (
        <span className="oh-am-name" role="cell">
          {name}
        </span>
      ) : (
        <FoldName label={name} open={open} onToggle={() => onToggle(id)} />
      )}
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
      {revealSessionId !== null && (
        <Tooltip title={revealLabel} placement="left">
          <button
            type="button"
            className="oh-am-reveal"
            aria-label={revealLabel}
            onClick={() => onReveal(revealSessionId)}
          >
            <span aria-hidden>↗</span>
          </button>
        </Tooltip>
      )}
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

/** A process that ended inside the hour, beneath the Ended line: its name, a dash for CPU, the hour it left behind, when it ended. */
const EndedRow = memo(function EndedRow({ name, graph, note }: { name: string; graph: string; note: string }) {
  return (
    <div className="oh-am-row oh-am-row--child oh-am-row--ended" role="row" data-testid="activity-monitor-ended">
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
  /** The column's `(i)`, shown while the pointer is on this head; absent before the first answer. */
  info: InfoPopoverContent | undefined;
  sort: ActivityMonitorSort | null;
  onSort: (column: ActivityMonitorSortColumn) => void;
}

const SortHead: React.FC<SortHeadProps> = ({ column, label, info, sort, onSort }) => {
  const direction = sort?.column === column ? sort.direction : null;
  return (
    <span
      className="oh-am-col oh-info-hover-host"
      role="columnheader"
      aria-sort={direction === null ? undefined : direction === 'asc' ? 'ascending' : 'descending'}
    >
      {info !== undefined && <InfoTrigger content={info} className="oh-info-trigger--hover" placement="bottomRight" />}
      <button type="button" className="oh-am-sort" onClick={() => onSort(column)}>
        {label}
        {direction !== null && <span aria-hidden>{direction === 'asc' ? ' ▴' : ' ▾'}</span>}
      </button>
    </span>
  );
};

/** The Overview group's one row: every process added up, how many there are, how long the app has run. */
const Summary: React.FC<{ snapshot: ActivityMonitorSnapshot; graphs: HistoryGraphs }> = ({ snapshot, graphs }) => {
  const { t, locale } = useLocale();
  const engine = snapshot.processes.find((row) => row.kind === 'engine');
  const count = t('workbench.activityMonitor.summary.processCount', { count: countProcesses(snapshot.processes) });
  return (
    <div className="oh-am-summary" data-testid="activity-monitor-summary">
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
      <span className="oh-am-stat">
        {t('workbench.activityMonitor.column.memory')}
        <strong>{formatMemory(sumReadable(snapshot.processes.map((row) => row.memoryBytes)))}</strong>
        <Sparkline path={graphs.memoryTotal} width={SUMMARY_GRAPH.width} height={SUMMARY_GRAPH.height} />
      </span>
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
  info: InfoPopoverContent | undefined;
  actions?: React.ReactNode;
  testid: string;
}> = ({ title, open, onToggle, info, actions, testid }) => (
  <div className="oh-am-group-head">
    <SectionHeader title={title} expanded={open} onToggle={onToggle} info={info} actions={actions} testid={testid} />
  </div>
);

const ActivityMonitorPanel: React.FC<ActivityMonitorPanelProps> = ({
  info,
  active,
  onHide,
  onRevealService,
  terminalLabel,
  onRevealTerminal,
}) => {
  const { t, locale } = useLocale();
  const wiring = useMemo(() => createPanelHeaderWiring({ onHide }), [onHide]);
  const { snapshot, unreadable, history } = useActivityMonitorSnapshot(active);
  const { snapshot: status } = useStatus();
  const [overviewOpen, setOverviewOpen] = useState(true);
  const [processesOpen, setProcessesOpen] = useState(true);
  const [runningOpen, setRunningOpen] = useState(true);
  const [otherOpen, setOtherOpen] = useState(false);
  const [endedOpen, setEndedOpen] = useState(false);
  /** The owners whose rows are open, by row identity — folded at first, not remembered. */
  const [openOwners, setOpenOwners] = useState<ReadonlySet<string>>(() => new Set());
  const toggleOwner = useCallback((id: string) => {
    setOpenOwners((open) => {
      const next = new Set(open);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }, []);
  const [sort, setSort] = useState<ActivityMonitorSort | null>(null);
  /** The order the sort gave when it was last applied; rows hold it until the next application. */
  const [heldOrder, setHeldOrder] = useState<readonly string[] | null>(null);
  const pointerOverTable = useRef(false);

  const cpuTop = snapshot === null ? 1 : cpuScaleTop(snapshot.platform, snapshot.logicalCores);
  const graphs = useMemo(() => buildHistoryGraphs(history, cpuTop), [history, cpuTop]);

  const platform = snapshot?.platform;
  const logicalCores = snapshot?.logicalCores;
  const memoryKind = snapshot?.memoryKind;
  /** Every `(i)` of the panel, worded for this host; none before the first answer says what the host is. */
  const infos = useMemo(
    () =>
      platform === undefined || logicalCores === undefined || memoryKind === undefined
        ? undefined
        : activityMonitorInfo(t, locale, { platform, logicalCores, memoryKind }),
    [t, locale, platform, logicalCores, memoryKind],
  );

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
  ): React.ReactNode => {
    const name = processName(row, t, terminalLabel);
    const cpu = formatCpuPercent(row.cpuRate, answer.platform, answer.logicalCores);
    const graph = graphs.processes.get(row.id)?.path ?? '';
    const memory = formatMemory(row.memoryBytes);
    const started = formatStartTime(row.startedAt, answer.sampledAt, locale);
    if (row.processCount === undefined) {
      return (
        <ProcessRow
          key={row.id}
          name={name}
          cpu={cpu}
          graph={graph}
          memory={memory}
          started={started}
          pid={row.pid}
          child={child}
        />
      );
    }

    const beneath = row.children ?? [];
    const open = beneath.length === 0 ? null : openOwners.has(row.id);
    const sessionId = row.terminalSessionId;
    return (
      <Fragment key={row.id}>
        <OwnerRow
          id={row.id}
          name={name}
          cpu={cpu}
          graph={graph}
          memory={memory}
          started={started}
          pid={row.pid}
          open={open}
          onToggle={toggleOwner}
          revealSessionId={sessionId !== undefined && terminalLabel(sessionId) !== null ? sessionId : null}
          revealLabel={t('workbench.activityMonitor.reveal', { target: name })}
          onReveal={onRevealTerminal}
        />
        {open === true &&
          beneath.map((process) => (
            <ProcessRow
              key={`${process.pid}:${process.startedAt}`}
              name={process.name ?? t('workbench.activityMonitor.process.unknown')}
              cpu={formatCpuPercent(process.cpuRate, answer.platform, answer.logicalCores)}
              graph={null}
              memory={formatMemory(process.memoryBytes)}
              started={formatStartTime(process.startedAt, answer.sampledAt, locale)}
              pid={process.pid}
              child
            />
          ))}
      </Fragment>
    );
  };

  const overviewGroup = snapshot !== null && (
    <div className="oh-am-group">
      <GroupHead
        title={t('workbench.activityMonitor.group.overview')}
        open={overviewOpen}
        onToggle={() => setOverviewOpen((open) => !open)}
        testid="activity-monitor-group-overview"
        info={infos?.overview}
        actions={
          graphs.spanMs > 0 && (
            <span className="oh-am-range">
              {t('workbench.activityMonitor.summary.range', { duration: formatSpan(graphs.spanMs, locale) })}
            </span>
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
        info={infos?.processes}
        actions={
          processesOpen && (
            <div className="oh-am-cols" role="row">
              <SortHead
                column="cpu"
                label={t('workbench.activityMonitor.column.cpu')}
                info={infos?.cpu}
                sort={sort}
                onSort={onSort}
              />
              <span aria-hidden />
              <SortHead
                column="memory"
                label={t('workbench.activityMonitor.column.memory')}
                info={infos?.memory}
                sort={sort}
                onSort={onSort}
              />
              <SortHead
                column="started"
                label={t('workbench.activityMonitor.column.started')}
                info={infos?.started}
                sort={sort}
                onSort={onSort}
              />
              <SortHead
                column="pid"
                label={t('workbench.activityMonitor.column.pid')}
                info={infos?.pid}
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
              <FoldName
                label={t('workbench.activityMonitor.process.other', { count: arranged.other.length })}
                open={otherOpen}
                onToggle={() => setOtherOpen((open) => !open)}
              />
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
          {ended.length > 0 && (
            <div className="oh-am-row oh-am-row--ended" role="row" data-testid="activity-monitor-ended-fold">
              <FoldName
                label={t('workbench.activityMonitor.process.ended', { count: ended.length })}
                open={endedOpen}
                onToggle={() => setEndedOpen((open) => !open)}
              />
            </div>
          )}
          {endedOpen &&
            ended.map((process) => {
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
        info={infos?.running}
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
