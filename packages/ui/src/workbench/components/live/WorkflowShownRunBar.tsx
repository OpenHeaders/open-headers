/**
 * WorkflowShownRunBar — the line at the head of the workflow view's
 * panel while the view draws a run picked from the workflow's History
 * (the workflows redesign, History): which run it is — when it began,
 * how it ended — and the way back to the latest.
 */

import { runVerdict, type WorkflowRunRecord } from '@openheaders/core/live';
import { useLocale } from '@openheaders/ui/context/LocaleContext';
import type React from 'react';
import { describeRunVerdict, formatRunWhen } from './run-display';
import { STEP_MARK_INK } from './StepGlyph';
import { usePanelSizes } from './use-panel-sizes';

interface Props {
  /** The picked run. */
  record: WorkflowRunRecord;
  onBackToLatest: () => void;
}

const WorkflowShownRunBar: React.FC<Props> = ({ record, onBackToLatest }) => {
  const { locale, t } = useLocale();
  const { fontSize } = usePanelSizes();
  const verdict = runVerdict(record);
  return (
    <div className="oh-wf-shown-run" data-testid="wf-shown-run" data-run-id={record.runId} style={{ fontSize }}>
      <span className="oh-wf-shown-run-which">
        {t('workbench.editors.live.history.shownRun', {
          when: formatRunWhen(record.startedAt, Date.now(), locale),
        })}
        {' · '}
        <b style={{ color: STEP_MARK_INK[verdict] }}>{describeRunVerdict(verdict, t)}</b>
      </span>
      <button
        type="button"
        className="oh-wf-shown-run-latest"
        data-testid="wf-shown-run-latest"
        onClick={onBackToLatest}
      >
        {t('workbench.editors.live.history.backToLatest')}
      </button>
    </div>
  );
};

export default WorkflowShownRunBar;
