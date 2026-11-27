/**
 * The "Used from other steps" card of a step's panel (the workflows
 * redesign, Step panel): the captures of other steps this one reads,
 * where it reads each, and a way to the step that captured it.
 */

import type { MessageKey } from '@openheaders/i18n';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { Button } from 'antd';
import type React from 'react';
import type { CaptureUse, CaptureUsePlace } from './capture-uses';
import WorkflowCard from './WorkflowCard';

/** Where a capture is read, by the name of the card that reads it. */
const PLACE_WORD: Record<CaptureUsePlace, MessageKey> = {
  request: 'workbench.editors.live.request.title',
  connection: 'workbench.editors.live.connection.title',
  topic: 'workbench.editors.live.expect.topic',
  match: 'workbench.editors.live.criteria.matchTitle',
  criteria: 'workbench.editors.live.sections.successCriteria',
  condition: 'workbench.editors.live.sections.runCondition',
  priority: 'workbench.editors.live.sections.priority',
};

interface Props {
  index: number;
  uses: readonly CaptureUse[];
  /** Selects the step a value was captured by — `undefined` where the draft holds no such step. */
  goToStep: (stepId: string) => (() => void) | undefined;
}

const StepUsesCard: React.FC<Props> = ({ index, uses, goToStep }) => {
  const t = useT();
  return (
    <WorkflowCard
      testId={`wf-step-${index}-uses`}
      title={t('workbench.editors.live.uses.title')}
      description={t('workbench.editors.live.uses.description')}
    >
      {uses.length === 0 ? (
        <div className="oh-wf-card-note">{t('workbench.editors.live.uses.none')}</div>
      ) : (
        <div className="oh-wf-card-columns oh-wf-uses-grid">
          <span>{t('workbench.editors.live.uses.colValue')}</span>
          <span>{t('workbench.editors.live.uses.colUsedIn')}</span>
        </div>
      )}
      {uses.map((use, row) => {
        const go = goToStep(use.stepId);
        const token = `${use.stepId}.${use.captureName}`;
        return (
          <div
            key={`${use.place}/${use.stepId}/${use.captureName}`}
            className="oh-wf-card-row oh-wf-uses-grid"
            data-testid={`wf-step-${index}-use-${row}`}
          >
            <span className="oh-wf-code oh-wf-capture-token" title={token}>
              {token}
            </span>
            <span className="oh-wf-quiet">{t(PLACE_WORD[use.place])}</span>
            {/* It edits nothing, so it is told by its own `disabled`, never a read-only form's. */}
            <Button disabled={go === undefined} onClick={go}>
              {t('workbench.editors.live.uses.goToStep')}
            </Button>
          </div>
        );
      })}
    </WorkflowCard>
  );
};

export default StepUsesCard;
