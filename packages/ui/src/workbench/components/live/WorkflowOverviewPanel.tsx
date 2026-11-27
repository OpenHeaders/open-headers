/**
 * WorkflowOverviewPanel — the workflow view's docked panel while no step
 * is selected (the workflows redesign, Workflow panel): the workflow as
 * a whole — what is wrong with its structure, its description, its last
 * run as rows that open their step, and when it runs.
 */

import { InfoCircleOutlined } from '@ant-design/icons';
import type { DraftWorkflow } from '@openheaders/core/live';
import type { LiveWorkflow } from '@openheaders/core/types';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { LIVE_WORKFLOW_FIELD } from '@openheaders/ui/shared/awareness/live-paths';
import { InfoTrigger } from '@openheaders/ui/shared/info-popover';
import { Alert, ConfigProvider, Switch, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useEffect, useRef } from 'react';
import { InlineDescription, LIVE_FORM_PAD_X, Section } from './layout';
import RefreshPolicyEditor from './RefreshPolicyEditor';
import type { WorkflowFormModel } from './use-workflow-form-model';
import type { ShownWorkflowRun } from './use-workflow-run';
import WorkflowRunRows from './WorkflowRunRows';

const { Text } = Typography;

interface Props {
  draft: DraftWorkflow;
  setDraft: (next: DraftWorkflow) => void;
  model: WorkflowFormModel;
  /** The workflow is read-only here: every control is off but the Enabled switch. */
  readOnly: boolean;
  onSelectStep: (stepUid: string) => void;
  /** The saved workflow on a surface that runs workflows — absent where there is no run to show. */
  workflow?: LiveWorkflow;
  run?: ShownWorkflowRun | null;
  /** The header's schedule word was pressed: bring the setting of when the workflow runs to the panel's top. */
  revealSettings?: boolean;
  onSettingsRevealed?: () => void;
}

const WorkflowOverviewPanel: React.FC<Props> = ({
  draft,
  setDraft,
  model,
  readOnly,
  onSelectStep,
  workflow,
  run,
  revealSettings = false,
  onSettingsRevealed,
}) => {
  const { token } = theme.useToken();
  const t = useT();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!revealSettings) return;
    const scroller = scrollerRef.current;
    const settings = settingsRef.current;
    if (scroller && settings) {
      scroller.scrollTop += settings.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
    }
    onSettingsRevealed?.();
  }, [revealSettings, onSettingsRevealed]);

  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: `8px ${LIVE_FORM_PAD_X}px`,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          flexShrink: 0,
        }}
      >
        <Text type="secondary" style={{ flex: 1, minWidth: 0, fontSize: 12 }}>
          {t('workbench.editors.live.panel.noStep')}
        </Text>
      </div>
      <div ref={scrollerRef} className="oh-persistent-scroll" style={{ flex: 1, minHeight: 0 }}>
        <ConfigProvider componentDisabled={readOnly}>
          <div style={{ padding: `16px ${LIVE_FORM_PAD_X}px`, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {model.workflowLevelErrors.length > 0 && (
              <Alert
                type="error"
                showIcon
                title={t('workbench.editors.live.form.structuralIssues')}
                description={
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {model.workflowLevelErrors.map((err) => (
                      <li key={`${err.issue}:${err.stepId ?? ''}:${err.referencedStepId ?? ''}`} style={{ fontSize: 12 }}>
                        {err.message}
                      </li>
                    ))}
                  </ul>
                }
              />
            )}

            <div data-field-path={LIVE_WORKFLOW_FIELD.description}>
              <InlineDescription
                description={draft.description}
                onChangeDescription={(description) => setDraft({ ...draft, description })}
              />
            </div>

            {workflow !== undefined && (
              <Section title={t('workbench.editors.live.panel.lastRun')}>
                <WorkflowRunRows workflow={workflow} run={run ?? null} onSelectStep={onSelectStep} />
              </Section>
            )}

            <div ref={settingsRef} data-field-path={LIVE_WORKFLOW_FIELD.refresh} data-testid="wf-panel-policy">
              <Section
                title={
                  <>
                    {t('workbench.editors.live.form.runsSection')}
                    {model.holdsSession && (
                      <InfoTrigger
                        content={{
                          title: t('workbench.editors.live.form.runsSection'),
                          summary: t('workbench.editors.live.form.sessionPolicyInfo'),
                        }}
                      />
                    )}
                  </>
                }
              >
                {/* Fixed at Manual while the workflow holds a session step; a
                    policy that is not Manual yet stays open so it can be set. */}
                <RefreshPolicyEditor
                  value={draft.refresh}
                  onChange={(refresh) => setDraft({ ...draft, refresh })}
                  availableCaptures={model.availableCaptures}
                  disabled={model.holdsSession && draft.refresh.kind === 'manual'}
                />
                {model.holdsSession && (
                  <Text type="secondary" style={{ fontSize: 11 }} data-testid="wf-form-session-verdict">
                    {t('workbench.editors.live.form.sessionNoLiveVariables')}
                  </Text>
                )}
              </Section>
            </div>

            <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
              <div data-field-path={LIVE_WORKFLOW_FIELD.enabled} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {/* A read-only workflow can still be switched off. */}
                <ConfigProvider componentDisabled={false}>
                  <Switch
                    size="small"
                    aria-label={t('workbench.editors.live.form.enabledAria')}
                    checked={draft.enabled}
                    onChange={(enabled) => setDraft({ ...draft, enabled })}
                  />
                </ConfigProvider>
                <Text style={{ fontSize: 12 }}>
                  {draft.enabled ? t('workbench.editors.live.form.enabled') : t('workbench.editors.live.form.disabled')}
                </Text>
              </div>
              <Tooltip title={t('workbench.editors.live.form.parallelTooltip')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Switch
                    aria-label={t('workbench.editors.live.form.parallelLabel')}
                    size="small"
                    checked={false}
                    disabled
                  />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {t('workbench.editors.live.form.parallelLabel')}
                  </Text>
                  <InfoCircleOutlined style={{ fontSize: 11, color: token.colorTextTertiary }} />
                </div>
              </Tooltip>
            </div>
          </div>
        </ConfigProvider>
      </div>
    </>
  );
};

export default WorkflowOverviewPanel;
