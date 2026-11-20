/**
 * ActivityMonitorPanel — the workbench Activity Monitor tool-window
 * body (the activity monitor plan §8): one table of the app's own
 * processes, named in the interface's words, with what each costs. The
 * host owns every read; this panel asks while it is looked at and
 * formats the answer. Values change in place on the two-second beat —
 * no row moves — and what could not be read reads as a dash.
 */

import { CaretRightOutlined } from '@ant-design/icons';
import {
  type ActivityMonitorProcessKind,
  type ActivityMonitorProcessRow,
  type ActivityMonitorSnapshot,
  arrangeProcessRows,
  cpuPercentConvention,
  formatCpuPercent,
  formatMemory,
  formatStartTime,
  sumReadable,
} from '@openheaders/core/activity-monitor';
import type { MessageKey } from '@openheaders/i18n';
import { Tooltip } from 'antd';
import type React from 'react';
import { memo, useMemo, useState } from 'react';
import { type Translate, useLocale } from '@openheaders/ui/context/LocaleContext';
import { createPanelHeaderWiring, PanelHeader } from '@openheaders/ui/shared/dock-layout';
import type { InfoPopoverContent } from '@openheaders/ui/shared/info-popover';
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
}

const PROCESS_NAME_KEYS: Record<Exclude<ActivityMonitorProcessKind, 'other'>, MessageKey> = {
  window: 'workbench.activityMonitor.process.window',
  engine: 'workbench.activityMonitor.process.engine',
  graphics: 'workbench.activityMonitor.process.graphics',
  network: 'workbench.activityMonitor.process.network',
  'script-sandbox': 'workbench.activityMonitor.process.scriptSandbox',
  'script-runtime': 'workbench.activityMonitor.process.scriptRuntime',
};

function processName(row: ActivityMonitorProcessRow, t: Translate): string {
  return row.kind === 'other' ? (row.runtimeName ?? '') : t(PROCESS_NAME_KEYS[row.kind]);
}

interface ProcessRowProps {
  name: string;
  cpu: string;
  memory: string;
  started: string;
  pid: number;
  child?: boolean;
}

const ProcessRow = memo(function ProcessRow({ name, cpu, memory, started, pid, child = false }: ProcessRowProps) {
  return (
    <div className={child ? 'oh-am-row oh-am-row--child' : 'oh-am-row'} role="row" data-testid="activity-monitor-row">
      <span className="oh-am-name" role="cell">
        {name}
      </span>
      <span className="oh-am-num" role="cell">
        {cpu}
      </span>
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

const ColumnHead: React.FC<{ label: string; hover?: string }> = ({ label, hover }) => (
  <Tooltip title={hover} placement="top">
    <span className="oh-am-col" role="columnheader">
      {label}
    </span>
  </Tooltip>
);

const ActivityMonitorPanel: React.FC<ActivityMonitorPanelProps> = ({ info, active, onHide }) => {
  const { t, locale } = useLocale();
  const wiring = useMemo(() => createPanelHeaderWiring({ onHide }), [onHide]);
  const { snapshot, unreadable } = useActivityMonitorSnapshot(active);
  const [otherOpen, setOtherOpen] = useState(false);
  const arranged = useMemo(() => (snapshot === null ? null : arrangeProcessRows(snapshot.processes)), [snapshot]);

  const renderRow = (
    row: ActivityMonitorProcessRow,
    answer: ActivityMonitorSnapshot,
    child: boolean,
  ): React.ReactNode => (
    <ProcessRow
      key={row.id}
      name={processName(row, t)}
      cpu={formatCpuPercent(row.cpuRate, answer.platform, answer.logicalCores)}
      memory={formatMemory(row.memoryBytes)}
      started={formatStartTime(row.startedAt, answer.sampledAt, locale)}
      pid={row.pid}
      child={child}
    />
  );

  return (
    <div className="rules-bottom-panel" data-testid="activity-monitor-panel">
      <PanelHeader wiring={wiring} title={<strong>{t('workbench.toolWindows.activityMonitor')}</strong>} info={info} />
      <div className="oh-am-body" role="table" aria-label={t('workbench.toolWindows.activityMonitor')}>
        <div className="oh-am-row oh-am-head" role="row">
          <span className="oh-am-group" role="columnheader">
            {t('workbench.activityMonitor.group.processes')}
          </span>
          <ColumnHead
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
          />
          <ColumnHead
            label={t('workbench.activityMonitor.column.memory')}
            hover={t('workbench.activityMonitor.column.memoryHover')}
          />
          <ColumnHead label={t('workbench.activityMonitor.column.started')} />
          <ColumnHead
            label={t('workbench.activityMonitor.column.pid')}
            hover={t('workbench.activityMonitor.column.pidHover')}
          />
        </div>
        {unreadable && <div className="oh-am-note">{t('workbench.activityMonitor.unreadable')}</div>}
        {snapshot !== null && arranged !== null && (
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
                  <CaretRightOutlined
                    aria-hidden
                    className={otherOpen ? 'oh-am-caret oh-am-caret--open' : 'oh-am-caret'}
                  />
                  <span>{t('workbench.activityMonitor.process.other', { count: arranged.other.length })}</span>
                </button>
                <span className="oh-am-num" role="cell">
                  {formatCpuPercent(
                    sumReadable(arranged.other.map((row) => row.cpuRate)),
                    snapshot.platform,
                    snapshot.logicalCores,
                  )}
                </span>
                <span className="oh-am-num" role="cell">
                  {formatMemory(sumReadable(arranged.other.map((row) => row.memoryBytes)))}
                </span>
              </div>
            )}
            {otherOpen && arranged.other.map((row) => renderRow(row, snapshot, true))}
          </>
        )}
      </div>
    </div>
  );
};

export default ActivityMonitorPanel;
