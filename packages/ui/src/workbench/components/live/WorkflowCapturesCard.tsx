/**
 * WorkflowCapturesCard — every capture of a workflow (the workflows
 * redesign, Workflow panel): its name, the step that captures it, and
 * the steps that read it.
 */

import { useT } from '@openheaders/ui/context/LocaleContext';
import type React from 'react';
import WorkflowCard from './WorkflowCard';

/** A capture of the workflow, and who reads it. */
export interface OverviewCapture {
  stepId: string;
  name: string;
  /** The ids of the steps that read it. */
  readers: readonly string[];
}

const WorkflowCapturesCard: React.FC<{ captures: readonly OverviewCapture[] }> = ({ captures }) => {
  const t = useT();
  return (
    <WorkflowCard
      testId="wf-captures"
      title={t('workbench.editors.live.captures.title')}
      description={t('workbench.editors.live.overview.capturesDescription')}
    >
      {captures.length === 0 ? (
        <div className="oh-wf-card-note">{t('workbench.editors.live.overview.capturesNone')}</div>
      ) : (
        <>
          <div className="oh-wf-card-columns oh-wf-overview-captures-grid">
            <span>{t('workbench.editors.live.captures.colName')}</span>
            <span>{t('workbench.editors.live.overview.colCapturedBy')}</span>
            <span>{t('workbench.editors.live.captures.colUsedBy')}</span>
          </div>
          {captures.map((capture) => (
            <div
              key={`${capture.stepId}\n${capture.name}`}
              className="oh-wf-card-row oh-wf-overview-captures-grid"
              data-testid={`wf-capture-${capture.stepId}-${capture.name}`}
            >
              <span className="oh-wf-capture-token oh-wf-code">{capture.name}</span>
              <span className="oh-wf-capture-readers">{capture.stepId}</span>
              <span className="oh-wf-capture-readers oh-wf-quiet">
                {capture.readers.length > 0 ? capture.readers.join(', ') : '—'}
              </span>
            </div>
          ))}
        </>
      )}
    </WorkflowCard>
  );
};

export default WorkflowCapturesCard;
