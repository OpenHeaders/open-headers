/**
 * UnknownStepCard — a step of an action the model does not know, in the
 * workflow's step panel (the workflow runs plan, Laws — "A reader
 * assumes only `uid`, `id` and `action`").
 *
 * The panel's head names the step and its raw action; this says the one
 * sentence and offers nothing to edit: a request picked here would turn
 * the step into a call.
 */

import { useT } from '@openheaders/ui/context/LocaleContext';
import type React from 'react';

const UnknownStepCard: React.FC = () => {
  const t = useT();
  return (
    <section className="oh-wf-card">
      <div className="oh-wf-card-note">{t('workbench.editors.live.step.needsUpdate')}</div>
    </section>
  );
};

export default UnknownStepCard;
