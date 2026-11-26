/**
 * UnknownStepCard — a step this build does not know, in the workflow
 * form (the workflow runs plan, Laws — "A reader assumes only `uid`,
 * `id` and `action`").
 *
 * It shows the step's id, the one sentence and its raw action, and
 * offers nothing to edit: a request picked here would turn the step
 * into a call. Where the workflow runs on this surface the sentence
 * says so (the workflow runs plan, Decisions log, S11).
 */

import type { UnknownWorkflowStep } from '@openheaders/core/types';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { Tag, Typography, theme } from 'antd';
import type React from 'react';
import { useScrollCardIntoView } from './use-scroll-card-into-view';

const { Text } = Typography;

interface Props {
  step: UnknownWorkflowStep;
  index: number;
  /** The workflow runs on this surface; the step is still not edited here. */
  runsHere?: boolean;
  selected?: boolean;
  scrollRequested?: boolean;
  onScrollDone?: () => void;
}

const UnknownStepCard: React.FC<Props> = ({
  step,
  index,
  runsHere = false,
  selected = false,
  scrollRequested = false,
  onScrollDone,
}) => {
  const { token } = theme.useToken();
  const t = useT();
  const cardRef = useScrollCardIntoView(scrollRequested, onScrollDone);
  const edgeColor = selected ? token.colorPrimary : token.colorWarningBorder;

  return (
    <div
      ref={cardRef}
      data-step-card={step.id}
      data-step-needs-update="true"
      data-selected={selected ? 'true' : undefined}
      style={{
        border: `1px solid ${edgeColor}`,
        boxShadow: selected ? `0 0 0 1px ${token.colorPrimary}` : undefined,
        borderRadius: 6,
        padding: 12,
        marginBottom: 12,
        background: token.colorBgContainer,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <Text strong style={{ fontSize: 12 }}>
          {t('workbench.editors.live.step.title', { number: index + 1 })}
        </Text>
        <Text code style={{ fontSize: 12 }}>
          {step.id}
        </Text>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {t(runsHere ? 'workbench.editors.live.step.runsHereReadOnly' : 'workbench.editors.live.step.needsUpdate')}
        </Text>
        <Tag style={{ fontSize: 10, lineHeight: '18px', margin: 0, fontFamily: "'SF Mono', monospace" }}>
          {step.action}
        </Tag>
      </div>
    </div>
  );
};

export default UnknownStepCard;
