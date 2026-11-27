/**
 * WorkflowAttentionCard — what in a workflow needs a look (the workflows
 * redesign, Workflow panel): what is wrong with its structure first, then
 * the steps the last run left failed, timed out, skipped or unable to
 * run, each with its reason. A row opens its step.
 */

import type { StructuralError } from '@openheaders/core/live';
import { useT } from '@openheaders/ui/context/LocaleContext';
import type React from 'react';
import StepOverviewRow, { type OverviewStepFacts } from './StepOverviewRow';
import type { StepMarkKind } from './step-mark';
import WorkflowCard from './WorkflowCard';

const NEEDS_ATTENTION: ReadonlySet<StepMarkKind> = new Set(['failed', 'timed-out', 'skipped', 'cannot-run']);

/** How far the last run got, for the line of a card with nothing to list. */
export type AttentionPhase = 'never-run' | 'running' | 'done';

interface Props {
  steps: readonly OverviewStepFacts[];
  /** The issues no step owns. */
  issues: readonly StructuralError[];
  phase: AttentionPhase;
  onOpen: (stepUid: string) => void;
}

const WorkflowAttentionCard: React.FC<Props> = ({ steps, issues, phase, onOpen }) => {
  const t = useT();
  const listed = steps.filter((step) => NEEDS_ATTENTION.has(step.mark.kind));
  const emptyLine =
    phase === 'never-run'
      ? t('workbench.editors.live.overview.attentionIdle')
      : phase === 'running'
        ? t('workbench.editors.live.overview.attentionRunning')
        : t('workbench.editors.live.overview.attentionNone');

  return (
    <WorkflowCard
      testId="wf-attention"
      title={t('workbench.editors.live.overview.attentionTitle')}
      description={t('workbench.editors.live.overview.attentionDescription')}
    >
      {issues.map((issue) => (
        <div
          key={`${issue.issue}:${issue.stepId ?? ''}:${issue.referencedStepId ?? ''}`}
          className="oh-wf-card-note oh-wf-card-note--error"
        >
          {issue.message}
        </div>
      ))}
      {listed.map((step) => (
        <StepOverviewRow
          key={step.uid}
          step={step}
          showResult
          idleWord=""
          onOpen={onOpen}
          testId={`wf-attention-${step.id}`}
        />
      ))}
      {issues.length === 0 && listed.length === 0 && <div className="oh-wf-card-note">{emptyLine}</div>}
    </WorkflowCard>
  );
};

export default WorkflowAttentionCard;
