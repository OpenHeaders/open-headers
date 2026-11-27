/**
 * WorkflowLastRunCard — the first card of the workflow's own panel (the
 * workflows redesign, Workflow panel): the last run of the workflow seen
 * on this page. Its verdict in a word, one sentence on what happened, and
 * its figures — how many steps ended each way, how long it took, the
 * environment it ran in.
 *
 * The figures come from the run's step events, never from the cache row
 * or a run report. A workflow that holds a step of an action the model
 * does not know has no run to show: the record says no step ran.
 */

import { runTotals, runVerdict } from '@openheaders/core/live';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { useEnvironments } from '@openheaders/ui/shared/hooks/readers/useEnvironments';
import type React from 'react';
import { formatDurationRolled } from '../request-editor/response/response-meta';
import { describeRunSentence, describeRunVerdict } from './run-display';
import { STEP_MARK_INK } from './StepGlyph';
import type { ShownWorkflowRun } from './use-workflow-run';
import WorkflowCard from './WorkflowCard';

interface Figure {
  /** Names the figure for a test; never shown. */
  key: string;
  label: string;
  value: string;
}

const WorkflowLastRunCard: React.FC<{ run: ShownWorkflowRun | null }> = ({ run }) => {
  const t = useT();
  const { environments } = useEnvironments();
  const title = t('workbench.editors.live.panel.lastRun');

  if (run === null) {
    return (
      <WorkflowCard
        testId="wf-last-run"
        title={title}
        description={
          <span data-testid="wf-run-empty">
            {t('workbench.editors.live.run.empty', { button: t('workbench.editors.live.workflow.run') })}
          </span>
        }
      />
    );
  }

  const { record } = run;
  const verdict = runVerdict(record);
  const totals = runTotals(record);
  const environment =
    record.environmentId === null
      ? t('workbench.editors.live.status.noEnvironment')
      : (environments.find((each) => each.uid === record.environmentId)?.name ??
        t('workbench.editors.live.status.unknownEnv'));
  const figures: Figure[] = [
    { key: 'passed', label: t('workbench.editors.live.run.verdict.passed'), value: String(totals.passed) },
    { key: 'failed', label: t('workbench.editors.live.run.verdict.failed'), value: String(totals.failed) },
    ...(totals.skipped > 0
      ? [{ key: 'skipped', label: t('workbench.editors.live.run.row.skipped'), value: String(totals.skipped) }]
      : []),
    ...(totals.notRun > 0
      ? [{ key: 'not-run', label: t('workbench.editors.live.run.row.notRun'), value: String(totals.notRun) }]
      : []),
    ...(totals.cannotRun > 0
      ? [{ key: 'cannot-run', label: t('workbench.editors.live.run.row.cannotRun'), value: String(totals.cannotRun) }]
      : []),
    ...(!run.refused && record.ended !== null
      ? [
          {
            key: 'duration',
            label: t('workbench.editors.live.lastRun.duration'),
            value: formatDurationRolled(record.ended.durationMs),
          },
        ]
      : []),
    ...(!run.refused
      ? [{ key: 'environment', label: t('workbench.editors.live.overview.environment'), value: environment }]
      : []),
  ];

  return (
    <WorkflowCard
      testId="wf-last-run"
      title={title}
      description={describeRunSentence(record, t)}
      extra={
        <span className="oh-wf-card-state" data-testid="wf-run-verdict" style={{ color: STEP_MARK_INK[verdict] }}>
          {describeRunVerdict(verdict, t)}
        </span>
      }
      footer={verdict === 'failed' ? t('workbench.editors.live.run.footer.failed') : undefined}
    >
      <div className="oh-wf-figures">
        {figures.map((figure) => (
          <div key={figure.key} className="oh-wf-figure" data-testid={`wf-last-run-${figure.key}`}>
            <div className="oh-wf-label">{figure.label}</div>
            <div className="oh-wf-figure-value">{figure.value}</div>
          </div>
        ))}
      </div>
    </WorkflowCard>
  );
};

export default WorkflowLastRunCard;
