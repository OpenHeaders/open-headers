/**
 * StepLastRunCard — the first card of a step's panel (the workflows
 * redesign, Step panel): what the last run made of the step. The state
 * in a word, one sentence, the figures the run holds, and under them, for
 * a step that waits under a deadline, a bar of how far into it the wait
 * went — live while it waits.
 */

import { useT } from '@openheaders/ui/context/LocaleContext';
import type React from 'react';
import { STEP_MARK_INK } from './StepGlyph';
import type { LastRunTiming, StepLastRun } from './step-last-run';
import WorkflowCard from './WorkflowCard';

const BAR_FILL: Record<LastRunTiming['tone'], string> = {
  met: 'var(--oh-wf-success)',
  missed: 'var(--oh-wf-timeout)',
  going: 'var(--oh-wf-accent)',
};

const StepLastRunCard: React.FC<{ lastRun: StepLastRun }> = ({ lastRun }) => {
  const t = useT();
  const ink = STEP_MARK_INK[lastRun.kind];
  return (
    <WorkflowCard
      testId="wf-step-last-run"
      title={t('workbench.editors.live.panel.lastRun')}
      description={lastRun.sentence}
      extra={
        <span
          className="oh-wf-card-state"
          data-testid="wf-step-last-run-state"
          data-run-state={lastRun.kind}
          style={{ color: ink }}
        >
          {lastRun.word}
        </span>
      }
    >
      <div className="oh-wf-figures">
        {lastRun.figures.map((figure) => (
          <div key={figure.key} className="oh-wf-figure" data-testid={`wf-step-last-run-${figure.key}`}>
            <div className="oh-wf-label">{figure.label}</div>
            <div className="oh-wf-figure-value" style={figure.key === 'status' ? { color: ink } : undefined}>
              {figure.value}
            </div>
          </div>
        ))}
      </div>
      {lastRun.timing !== undefined && (
        <div className="oh-wf-timing" data-testid="wf-step-last-run-timing" data-tone={lastRun.timing.tone}>
          <div className="oh-wf-timing-track" aria-hidden="true">
            <div
              className="oh-wf-timing-fill"
              style={{ width: `${lastRun.timing.fraction * 100}%`, background: BAR_FILL[lastRun.timing.tone] }}
            />
          </div>
          <div className="oh-wf-timing-words">
            <span>{lastRun.timing.note}</span>
            <span className="oh-wf-quiet">{lastRun.timing.limit}</span>
          </div>
        </div>
      )}
    </WorkflowCard>
  );
};

export default StepLastRunCard;
