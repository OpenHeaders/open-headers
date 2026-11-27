/**
 * StepMiniRow — a step standing in a row of another step's panel (the
 * workflows redesign, Step panel): its state glyph, its name, the
 * protocol it speaks and, once a run has reached it, how that went in a
 * word. A press opens that step.
 *
 * A name that is no step of the workflow — a dependency left behind by
 * a step that was removed — is a row that opens nothing.
 */

import { useT } from '@openheaders/ui/context/LocaleContext';
import type React from 'react';
import type { RequestKind } from '../../request-kind-menu';
import StepGlyph, { STEP_MARK_INK } from './StepGlyph';
import { ProtocolTag } from './StepTags';
import { stepStateWord } from './step-last-run';
import type { StepMark } from './step-mark';

/** What a row says of the step it stands for. */
export interface StepMiniFacts {
  id: string;
  /** The step's uid — absent where the name is no step of the workflow. */
  uid?: string;
  mark: StepMark;
  protocol: RequestKind | null;
}

interface Props {
  step: StepMiniFacts;
  onGo: (stepUid: string) => void;
  testId?: string;
  /** What sits at the row's end, outside the press that opens the step. */
  extra?: React.ReactNode;
}

const StepMiniRow: React.FC<Props> = ({ step, onGo, testId, extra }) => {
  const t = useT();
  const { uid } = step;
  return (
    <div className="oh-wf-mini-row" data-testid={testId}>
      <button
        type="button"
        className="oh-wf-mini-step"
        disabled={uid === undefined}
        onClick={uid !== undefined ? () => onGo(uid) : undefined}
      >
        <StepGlyph kind={step.mark.kind} label={step.mark.label} size={14} />
        <b className="oh-wf-mini-name">{step.id}</b>
        {step.protocol !== null && <ProtocolTag kind={step.protocol} size="panel" />}
        <span style={{ flex: 1 }} />
        {step.mark.kind !== 'idle' && (
          <span className="oh-wf-mini-outcome" style={{ color: STEP_MARK_INK[step.mark.kind] }}>
            {stepStateWord(step.mark.kind, t)}
          </span>
        )}
      </button>
      {extra}
    </div>
  );
};

export default StepMiniRow;
