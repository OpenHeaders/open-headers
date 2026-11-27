/**
 * WorkflowHistoryCard — a workflow's History (the workflows redesign,
 * Workflow panel): the runs of the workflow this page saw, the newest
 * first. A row says when the run began and in which environment, how it
 * ended, how its steps ended, how long it took and what started it. The
 * run the graph draws is the highlighted one.
 *
 * Built from the page's kept runs alone: a run this page did not see is
 * not listed, and a reload empties the list.
 */

import { type RunTrigger, runVerdict } from '@openheaders/core/live';
import type { MessageKey } from '@openheaders/i18n';
import { useLocale } from '@openheaders/ui/context/LocaleContext';
import type React from 'react';
import type { KeptWorkflowRun } from '../../data/workflow-run-store';
import { formatDurationRolled } from '../request-editor/response/response-meta';
import { describeRunSteps, describeRunVerdict, formatRunWhen } from './run-display';
import { STEP_MARK_INK } from './StepGlyph';
import { useEnvironmentName } from './use-environment-name';
import WorkflowCard from './WorkflowCard';

const TRIGGER_WORD: Record<RunTrigger, MessageKey> = {
  manual: 'workbench.editors.live.history.triggerManual',
  schedule: 'workbench.editors.live.history.triggerSchedule',
  agent: 'workbench.editors.live.history.triggerAgent',
};

/** A cell with nothing to say. */
const NONE = '—';

interface Props {
  /** The workflow's kept runs, the newest first. */
  runs: readonly KeptWorkflowRun[];
  /** The run the view draws, by its id. */
  shownRunId: string | null;
}

const WorkflowHistoryCard: React.FC<Props> = ({ runs, shownRunId }) => {
  const { locale, t } = useLocale();
  const environmentName = useEnvironmentName();
  const title = t('workbench.editors.live.history.title');

  if (runs.length === 0) {
    return (
      <WorkflowCard
        testId="wf-history"
        title={title}
        description={
          <span data-testid="wf-history-empty">
            {t('workbench.editors.live.run.empty', { button: t('workbench.editors.live.workflow.run') })}
          </span>
        }
      />
    );
  }

  const now = Date.now();
  return (
    <WorkflowCard
      testId="wf-history"
      title={title}
      description={t('workbench.editors.live.history.description')}
      footer={t('workbench.editors.live.history.shownNote')}
    >
      <div className="oh-wf-card-columns oh-wf-history-grid">
        <span>{t('workbench.editors.live.history.colWhen')}</span>
        <span>{t('workbench.editors.live.history.colResult')}</span>
        <span>{t('workbench.editors.live.overview.stepsTitle')}</span>
        <span>{t('workbench.editors.live.lastRun.duration')}</span>
        <span>{t('workbench.editors.live.history.colTrigger')}</span>
      </div>
      {runs.map(({ record }) => {
        const verdict = runVerdict(record);
        const going = record.ended === null;
        return (
          <div
            key={record.runId}
            className="oh-wf-card-row oh-wf-history-grid"
            data-testid={`wf-history-row-${record.runId}`}
            data-run-verdict={verdict}
            data-shown={record.runId === shownRunId ? 'true' : undefined}
          >
            <span className="oh-wf-history-when">
              <span className="oh-wf-mini-name">
                {going ? t('workbench.editors.live.history.now') : formatRunWhen(record.startedAt, now, locale)}
              </span>
              <span className="oh-wf-history-environment">{environmentName(record.environmentId)}</span>
            </span>
            <span className="oh-wf-history-result" style={{ color: STEP_MARK_INK[verdict] }}>
              {describeRunVerdict(verdict, t)}
            </span>
            <span className="oh-wf-history-steps">{describeRunSteps(record, t)}</span>
            <span className="oh-wf-history-cell">
              {record.ended === null || verdict === 'cannot-run'
                ? NONE
                : formatDurationRolled(record.ended.durationMs)}
            </span>
            <span className="oh-wf-history-cell">
              {record.trigger === undefined ? NONE : t(TRIGGER_WORD[record.trigger])}
            </span>
          </div>
        );
      })}
    </WorkflowCard>
  );
};

export default WorkflowHistoryCard;
