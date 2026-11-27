/**
 * WorkflowSettingsCard — the last card of the workflow's own panel (the
 * workflows redesign, Workflow panel): when the workflow runs, whether
 * it is enabled, and the switch for parallel steps, shown off until the
 * runner has them.
 *
 * A workflow that holds a session step runs by hand: its Runs field is
 * fixed there, the card's head says why, and its foot says what such a
 * workflow gives. A policy that is not Manual yet stays open so it can
 * be set.
 */

import { InfoCircleOutlined } from '@ant-design/icons';
import type { RefreshPolicy } from '@openheaders/core/types';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { LIVE_WORKFLOW_FIELD } from '@openheaders/ui/shared/awareness/live-paths';
import { InfoTrigger } from '@openheaders/ui/shared/info-popover';
import { ConfigProvider, Switch, Tooltip } from 'antd';
import type React from 'react';
import RefreshPolicyEditor from './RefreshPolicyEditor';
import type { WorkflowFormModel } from './use-workflow-form-model';
import WorkflowCard from './WorkflowCard';

interface Props {
  refresh: RefreshPolicy;
  onRefreshChange: (next: RefreshPolicy) => void;
  enabled: boolean;
  onEnabledChange: (next: boolean) => void;
  availableCaptures: WorkflowFormModel['availableCaptures'];
  /** The workflow holds a session step. */
  holdsSession: boolean;
  ref?: React.Ref<HTMLElement>;
}

const WorkflowSettingsCard: React.FC<Props> = ({
  refresh,
  onRefreshChange,
  enabled,
  onEnabledChange,
  availableCaptures,
  holdsSession,
  ref,
}) => {
  const t = useT();
  const parallelLabel = t('workbench.editors.live.form.parallelLabel');

  return (
    <WorkflowCard
      ref={ref}
      testId="wf-panel-policy"
      title={t('workbench.editors.live.overview.settingsTitle')}
      description={t('workbench.editors.live.overview.settingsDescription')}
      extra={
        holdsSession && (
          <InfoTrigger
            content={{
              title: t('workbench.editors.live.form.runsSection'),
              summary: t('workbench.editors.live.form.sessionPolicyInfo'),
            }}
          />
        )
      }
      footer={
        holdsSession ? (
          <span data-testid="wf-form-session-verdict">
            {t('workbench.editors.live.form.sessionNoLiveVariables')}
          </span>
        ) : undefined
      }
    >
      <div className="oh-wf-card-body oh-wf-fields">
        <span data-field-path={LIVE_WORKFLOW_FIELD.refresh} style={{ display: 'contents' }}>
          <RefreshPolicyEditor
            value={refresh}
            onChange={onRefreshChange}
            availableCaptures={availableCaptures}
            disabled={holdsSession && refresh.kind === 'manual'}
          />
        </span>
        <div className="oh-wf-switches">
          <span className="oh-wf-check" data-field-path={LIVE_WORKFLOW_FIELD.enabled}>
            {/* A read-only workflow can still be switched off. */}
            <ConfigProvider componentDisabled={false}>
              <Switch
                size="small"
                aria-label={t('workbench.editors.live.form.enabledAria')}
                checked={enabled}
                onChange={onEnabledChange}
              />
            </ConfigProvider>
            <span>
              {enabled ? t('workbench.editors.live.form.enabled') : t('workbench.editors.live.form.disabled')}
            </span>
          </span>
          <Tooltip title={t('workbench.editors.live.form.parallelTooltip')}>
            <span className="oh-wf-check oh-wf-quiet">
              <Switch size="small" aria-label={parallelLabel} checked={false} disabled />
              <span>{parallelLabel}</span>
              <InfoCircleOutlined />
            </span>
          </Tooltip>
        </div>
      </div>
    </WorkflowCard>
  );
};

export default WorkflowSettingsCard;
