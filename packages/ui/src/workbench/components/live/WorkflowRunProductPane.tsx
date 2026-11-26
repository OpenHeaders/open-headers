/**
 * WorkflowRunProductPane — what the selected step of a run produced
 * (the workflow runs plan, The Run view). A call opens to its exchange,
 * a `send` or an `expect` to its messages; a step with nothing to open
 * says so in one line.
 */

import type { StepProduct } from '@openheaders/core/live';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { Typography, theme } from 'antd';
import type React from 'react';
import { lazy, Suspense } from 'react';
import type { KeptProductState } from '../../data/workflow-run-store';

const { Text } = Typography;

const WorkflowRunResponse = lazy(() => import('./WorkflowRunResponse'));
const WorkflowRunMessage = lazy(() => import('./WorkflowRunMessage'));

interface Props {
  /** The selected step's id — `null` when no step is selected. */
  stepId: string | null;
  /** Where the step's product stands on this page — absent when its settle named none. */
  state: KeptProductState | undefined;
  product: StepProduct | null;
  /** The step whose start opened the selected `expect`'s window. */
  trigger?: string;
}

const WorkflowRunProductPane: React.FC<Props> = ({ stepId, state, product, trigger }) => {
  const { token } = theme.useToken();
  const t = useT();

  const note =
    stepId === null
      ? t('workbench.editors.live.run.pane.select')
      : product !== null
        ? null
        : state === 'asked'
          ? t('workbench.editors.live.status.loading')
          : state === undefined
            ? t('workbench.editors.live.run.pane.none')
            : t('workbench.editors.live.run.pane.gone');

  return (
    <div
      data-testid="wf-run-product"
      data-step={stepId ?? undefined}
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        minWidth: 0,
        background: token.colorBgContainer,
      }}
    >
      {product !== null && note === null ? (
        <Suspense fallback={null}>
          {product.kind === 'response' ? (
            <WorkflowRunResponse snapshot={product.snapshot} />
          ) : (
            <WorkflowRunMessage product={product} trigger={trigger} />
          )}
        </Suspense>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Text type="secondary" style={{ fontSize: 12, textAlign: 'center' }}>
            {note ?? ''}
          </Text>
        </div>
      )}
    </div>
  );
};

export default WorkflowRunProductPane;
