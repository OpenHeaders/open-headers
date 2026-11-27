/**
 * StepProductCard — the last card of a step's panel (the workflows
 * redesign, Step panel): what the step produced in the run this page
 * last saw. A call opens to its exchange, a send to its message and the
 * reply, a wait to the messages of its window. The card is there only
 * for a step whose run named something to show; while that is on its
 * way, or once the page no longer keeps it, the card says so in a line.
 *
 * The viewers are loaded when a card first holds one: the workflow
 * editor carries neither the response viewer nor the code editor.
 */

import type { StepProduct } from '@openheaders/core/live';
import { useT } from '@openheaders/ui/context/LocaleContext';
import type React from 'react';
import { lazy, Suspense } from 'react';
import type { KeptProductState } from '../../data/workflow-run-store';
import type { RunStepAction } from './run-display';
import WorkflowCard from './WorkflowCard';

const WorkflowRunResponse = lazy(() => import('./WorkflowRunResponse'));
const WorkflowRunMessage = lazy(() => import('./WorkflowRunMessage'));

/** What the card holds: a call's exchange, a send's message, the messages of a wait's window. */
type ProductFace = 'response' | 'sent' | 'window';

const FACE_WORDS = {
  response: {
    title: 'workbench.editors.live.panel.response',
    description: 'workbench.editors.live.panel.responseDescription',
    gone: 'workbench.editors.live.run.pane.gone',
  },
  sent: {
    title: 'workbench.editors.live.panel.message',
    description: 'workbench.editors.live.panel.sentDescription',
    gone: 'workbench.editors.live.run.pane.goneMessages',
  },
  window: {
    title: 'workbench.editors.live.panel.message',
    description: 'workbench.editors.live.panel.messagesDescription',
    gone: 'workbench.editors.live.run.pane.goneMessages',
  },
} as const;

/** The product says what it is; until it is here, the step's action does. */
function faceOf(product: StepProduct | null, action: RunStepAction | undefined): ProductFace {
  if (product !== null) {
    if (product.kind === 'response') return 'response';
    return product.window !== undefined ? 'window' : 'sent';
  }
  if (action === 'call') return 'response';
  return action === 'send' ? 'sent' : 'window';
}

interface Props {
  /** The step's id in the run. */
  stepId: string;
  action: RunStepAction | undefined;
  /** Where the step's product stands on this page. */
  state: KeptProductState;
  product: StepProduct | null;
  /** The step whose start opened a wait's window. */
  trigger?: string;
}

const StepProductCard: React.FC<Props> = ({ stepId, action, state, product, trigger }) => {
  const t = useT();
  const words = FACE_WORDS[faceOf(product, action)];
  return (
    <WorkflowCard testId="wf-step-product" title={t(words.title)} description={t(words.description)}>
      {product !== null ? (
        <div
          className={
            product.kind === 'response' ? 'oh-wf-card-product oh-wf-card-product--response' : 'oh-wf-card-product'
          }
          data-testid="wf-run-product"
          data-step={stepId}
        >
          <Suspense fallback={null}>
            {product.kind === 'response' ? (
              <WorkflowRunResponse snapshot={product.snapshot} />
            ) : (
              <WorkflowRunMessage product={product} trigger={trigger} />
            )}
          </Suspense>
        </div>
      ) : (
        <div className="oh-wf-card-note" data-testid="wf-run-product" data-step={stepId}>
          {t(state === 'asked' ? 'workbench.editors.live.status.loading' : words.gone)}
        </div>
      )}
    </WorkflowCard>
  );
};

export default StepProductCard;
