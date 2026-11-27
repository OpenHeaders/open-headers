/**
 * WorkflowEnvironmentsCard — how a workflow's last run left each
 * environment (the workflows redesign, Workflow panel): the active
 * environment first, there even before its first run, then every other
 * environment that holds a run, newest first. A row says when the run
 * was, when the workflow runs again or its values expire, what its
 * circuit is doing, the error the last attempt ended on, and whether an
 * edit since made the values need another run.
 *
 * Distinct from `WorkflowStatusPanel`, the circuit dashboard over every
 * workflow: this card is one workflow's.
 */

import type { LiveWorkflowRunSnapshot } from '@openheaders/core/bridge';
import type { RefreshPolicy } from '@openheaders/core/types';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { useEnvironments } from '@openheaders/ui/shared/hooks/readers/useEnvironments';
import { Tooltip } from 'antd';
import type React from 'react';
import { Fragment, useEffect, useState } from 'react';
import {
  classifyRun,
  describeCircuit,
  describeRunSchedule,
  formatCountdown,
  type PerEnvRunSummary,
  statusColor,
  summarizeRunsByEnv,
} from './live-display';
import { useEnvironmentName } from './use-environment-name';
import WorkflowCard from './WorkflowCard';

const WARNING_INK = 'var(--oh-wf-blocked)';
const DANGER_INK = 'var(--oh-wf-failure)';

interface Fact {
  key: string;
  node: React.ReactNode;
}

interface RowProps {
  entry: PerEnvRunSummary;
  name: string;
  refresh: RefreshPolicy;
  /** The workflow gives a verdict and publishes no live variable. */
  verdictOnly: boolean;
}

const EnvironmentRow: React.FC<RowProps> = ({ entry, name, refresh, verdictOnly }) => {
  const t = useT();
  const { run } = entry;
  const circuit = describeCircuit(run, t);
  // A paused circuit counts down to its next attempt; nothing else ticks.
  const [, setNow] = useState(Date.now());
  const counting = circuit.nextAttemptAt !== null && circuit.nextAttemptAt > Date.now();
  useEffect(() => {
    if (!counting) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [counting]);

  const facts: Fact[] = [];
  if (run === null) {
    facts.push({
      key: 'never',
      node: (
        <span style={{ color: WARNING_INK }}>
          {t(
            verdictOnly ? 'workbench.editors.live.status.notRunYet' : 'workbench.editors.live.status.neverRunForEnv',
          )}
        </span>
      ),
    });
  } else {
    for (const chunk of describeRunSchedule(run, refresh, t)) {
      facts.push({
        key: chunk.text,
        node: <span style={chunk.tone === 'warning' ? { color: WARNING_INK } : undefined}>{chunk.text}</span>,
      });
    }
    // A healthy circuit says nothing: the row's dot already does.
    if (circuit.level === 'red' || circuit.level === 'yellow') {
      const countdown = circuit.nextAttemptAt !== null ? formatCountdown(circuit.nextAttemptAt) : '';
      facts.push({
        key: 'circuit',
        node: (
          <Tooltip title={circuit.hint}>
            <span style={{ color: circuit.level === 'red' ? DANGER_INK : WARNING_INK }}>
              {circuit.label}
              {countdown !== '' ? ` · ${t('workbench.editors.live.status.nextAttempt', { countdown })}` : ''}
            </span>
          </Tooltip>
        ),
      });
    }
    if (run.lastErrorMessage) {
      facts.push({
        key: 'error',
        node: (
          <span style={{ color: DANGER_INK }}>
            {run.lastErrorMessage}
            {run.lastErrorStepId ? ` (${run.lastErrorStepId})` : ''}
          </span>
        ),
      });
    }
    if (run.definitionallyStale === true) {
      facts.push({
        key: 'stale',
        node: (
          <Tooltip title={t('workbench.editors.live.status.needsReRunTooltip')}>
            <span style={{ color: WARNING_INK }}>{t('workbench.editors.live.status.needsReRun')}</span>
          </Tooltip>
        ),
      });
    }
  }

  return (
    <div
      className="oh-wf-card-row oh-wf-env-grid"
      data-testid={`wf-env-${entry.environmentId ?? 'none'}`}
      data-active={entry.isActive ? 'true' : undefined}
    >
      <span className="oh-wf-env-name">
        <span className="oh-wf-env-dot" style={{ background: statusColor(classifyRun(run)) }} />
        <span className={entry.isActive ? 'oh-wf-mini-name' : 'oh-wf-capture-readers oh-wf-quiet'}>
          {name}
          {entry.isActive ? ` ${t('workbench.editors.live.status.activeSuffix')}` : ''}
        </span>
      </span>
      <span className="oh-wf-env-facts">
        {facts.map((fact, index) => (
          <Fragment key={fact.key}>
            {index > 0 && ' · '}
            {fact.node}
          </Fragment>
        ))}
      </span>
    </div>
  );
};

interface Props {
  /** Every environment's cache row of the workflow. */
  runs: LiveWorkflowRunSnapshot[];
  refresh: RefreshPolicy;
  /** How many live variables read the workflow. */
  boundCount: number;
  /** The workflow gives a verdict and publishes no live variable: the card says nothing of bindings. */
  verdictOnly: boolean;
}

const WorkflowEnvironmentsCard: React.FC<Props> = ({ runs, refresh, boundCount, verdictOnly }) => {
  const t = useT();
  const { activeEnvironmentId } = useEnvironments();
  const nameOf = useEnvironmentName();
  const entries = summarizeRunsByEnv(runs, activeEnvironmentId ?? null);

  return (
    <WorkflowCard
      testId="wf-run-status-strip"
      title={t('workbench.editors.live.overview.environmentsTitle')}
      description={t('workbench.editors.live.overview.environmentsDescription')}
      extra={
        !verdictOnly && (
          <span className="oh-wf-label" data-testid="wf-env-bound">
            {t('workbench.editors.live.status.boundCount', { count: boundCount })}
          </span>
        )
      }
    >
      {entries.map((entry) => (
        <EnvironmentRow
          key={entry.environmentId ?? '__none__'}
          entry={entry}
          name={nameOf(entry.environmentId)}
          refresh={refresh}
          verdictOnly={verdictOnly}
        />
      ))}
    </WorkflowCard>
  );
};

export default WorkflowEnvironmentsCard;
