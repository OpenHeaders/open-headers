/**
 * StepOverviewRow — a step as a row of the workflow's own panel (the
 * workflows redesign, Workflow panel): its state glyph and its name, the
 * protocol it speaks and its kind, then one line — what the last run made
 * of it, or what it does while no run has reached any step — and under
 * them the sentence a failure, a skip or a session left. A press opens
 * the step.
 */

import type React from 'react';
import type { RequestKind } from '../../request-kind-menu';
import type { RunRowDisplay } from './run-display';
import StepGlyph, { STEP_MARK_INK } from './StepGlyph';
import { KindTag, ProtocolTag } from './StepTags';
import type { StepDoes } from './step-facts';
import type { StepMark } from './step-mark';

const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';

type SubTone = NonNullable<RunRowDisplay['sub']>['tone'];

const SUB_INK: Record<SubTone, string> = {
  secondary: 'var(--oh-wf-text-secondary)',
  danger: 'var(--oh-wf-failure)',
  warning: 'var(--oh-wf-blocked)',
};

/** What a row says of the step it stands for. */
export interface OverviewStepFacts {
  id: string;
  uid: string;
  mark: StepMark;
  protocol: RequestKind | null;
  /** The step's kind in a word — its raw action where the model does not know it. */
  kind: string;
  /** What the last run made of the step, in the run's own words — empty while none has reached it. */
  result: string;
  does: StepDoes;
  /** The sentence under the row. */
  sub?: { text: string; tone: SubTone };
}

interface Props {
  step: OverviewStepFacts;
  /** The row's line is the step's last result; what the step does where no run has reached any step. */
  showResult: boolean;
  /** What stands in the line for a step no run has reached, beside steps one has. */
  idleWord: string;
  onOpen: (stepUid: string) => void;
  testId: string;
  /** Names the line's own element for a test. */
  lineTestId?: string;
  /** What sits at the row's end, outside the press that opens the step. */
  extra?: React.ReactNode;
}

const StepOverviewRow: React.FC<Props> = ({ step, showResult, idleWord, onOpen, testId, lineTestId, extra }) => {
  const { does } = step;
  return (
    <div className="oh-wf-steps-row">
      <button
        type="button"
        className="oh-wf-steps-open oh-wf-steps-grid"
        data-testid={testId}
        data-run-state={step.mark.kind}
        onClick={() => onOpen(step.uid)}
      >
        <span className="oh-wf-steps-name">
          <StepGlyph kind={step.mark.kind} label={step.mark.label} size={14} />
          <b className="oh-wf-mini-name">{step.id}</b>
        </span>
        <span className="oh-wf-steps-tags">
          {step.protocol !== null && <ProtocolTag kind={step.protocol} size="panel" />}
          <KindTag size="panel">{step.kind}</KindTag>
        </span>
        {showResult ? (
          <span
            className="oh-wf-steps-line"
            data-testid={lineTestId}
            style={{ color: step.result === '' ? 'var(--oh-wf-text-secondary)' : STEP_MARK_INK[step.mark.kind] }}
          >
            {step.result === '' ? idleWord : step.result}
          </span>
        ) : (
          <span
            className={does.muted === true ? 'oh-wf-steps-line oh-wf-quiet' : 'oh-wf-steps-line'}
            data-testid={lineTestId}
          >
            {does.lead !== undefined && does.lead !== '' && <b className="oh-wf-label">{does.lead} </b>}
            <span style={does.mono === true ? { fontFamily: MONO } : undefined}>{does.text}</span>
          </span>
        )}
        {step.sub !== undefined && (
          <span className="oh-wf-row-line" style={{ color: SUB_INK[step.sub.tone] }}>
            {step.sub.text}
          </span>
        )}
      </button>
      {extra}
    </div>
  );
};

export default StepOverviewRow;
